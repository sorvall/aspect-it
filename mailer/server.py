#!/usr/bin/env python3
import json
import os
import re
import smtplib
import socket
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from socketserver import ThreadingMixIn, UnixStreamServer

MAX_BODY = 4096
MAX_NAME = 120
MAX_PHONE = 40
RATE_WINDOW = 3600
RATE_MAX = 8
SMTP_TIMEOUT = 6
PHONE_RE = re.compile(r"^[+\d][\d\s\-().]{5,38}$")
HITS = {}
HITS_LOCK = threading.Lock()


def env(name, default=""):
    return os.environ.get(name, default).strip()


def client_ip(handler):
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    addr = handler.client_address
    if isinstance(addr, tuple) and addr:
        return str(addr[0])[:64]
    return "unix"


def rate_ok(ip):
    now = time.time()
    with HITS_LOCK:
        stamps = [t for t in HITS.get(ip, []) if now - t < RATE_WINDOW]
        if len(stamps) >= RATE_MAX:
            HITS[ip] = stamps
            return False
        stamps.append(now)
        HITS[ip] = stamps
        return True


def smtp_settings():
    host = env("SMTP_HOST", "smtp.yandex.ru")
    port = int(env("SMTP_PORT", "465") or "465")
    user = env("SMTP_USER") or "sorvallsorokin@yandex.ru"
    password = env("SMTP_PASSWORD")
    mail_to = env("MAIL_TO") or "sorvall@mail.ru"
    return host, port, user, password, mail_to


def smtp_endpoints(host, preferred_port):
    ports = []
    for port in (preferred_port, 465, 587):
        if port not in ports:
            ports.append(port)
    seen = set()
    for port in ports:
        for family in (socket.AF_INET, socket.AF_INET6):
            try:
                infos = socket.getaddrinfo(host, port, family, socket.SOCK_STREAM)
            except socket.gaierror as exc:
                sys.stderr.write("smtp dns %s family=%s: %s\n" % (host, family, exc))
                continue
            for info in infos:
                ip = info[4][0]
                key = (ip, port)
                if key in seen:
                    continue
                seen.add(key)
                yield ip, port


def smtp_connect(hostname, ip, port):
    context = ssl.create_default_context()

    class ToIP_SSL(smtplib.SMTP_SSL):
        def _get_socket(self, host, port_, timeout):
            return socket.create_connection((ip, port_), timeout)

    class ToIP(smtplib.SMTP):
        def _get_socket(self, host, port_, timeout):
            return socket.create_connection((ip, port_), timeout)

    if port == 465:
        return ToIP_SSL(hostname, port, timeout=SMTP_TIMEOUT, context=context)
    smtp = ToIP(hostname, port, timeout=SMTP_TIMEOUT)
    smtp.starttls(context=context)
    smtp.ehlo()
    return smtp


def smtp_login(host, port, user, password):
    errors = []
    for ip, try_port in smtp_endpoints(host, port):
        try:
            sys.stderr.write("smtp try %s:%s via %s\n" % (host, try_port, ip))
            smtp = smtp_connect(host, ip, try_port)
            smtp.login(user, password)
            sys.stderr.write("smtp login ok %s:%s via %s\n" % (host, try_port, ip))
            return smtp
        except Exception as exc:
            errors.append("%s:%s (%s): %s: %s" % (host, try_port, ip, type(exc).__name__, exc))
            sys.stderr.write("smtp fail %s\n" % errors[-1])
    raise OSError("smtp unreachable: %s" % "; ".join(errors[:6] or ["no addresses"]))


def send_via_https(name, phone, page, mail_to):
    payload = json.dumps(
        {
            "name": name,
            "phone": phone,
            "page": page,
            "message": "Имя: %s\nТелефон: %s\nСтраница: %s" % (name, phone, page),
            "_subject": "Заявка с aspect-it.ru: %s" % name,
            "_captcha": "false",
            "_template": "table",
        },
        ensure_ascii=False,
    ).encode("utf-8")
    url = "https://formsubmit.co/ajax/%s" % mail_to
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "aspect-it-mailer",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8", "replace")
        sys.stderr.write("https mail %s %s\n" % (resp.status, body[:300]))
        if resp.status >= 400:
            raise RuntimeError("https mail failed")
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return
        success = data.get("success")
        if success is True or str(success).lower() == "true":
            return
        msg = str(data.get("message") or body)
        low = msg.lower()
        if "activat" in low or "confirm" in low or "inbox" in low:
            sys.stderr.write("https mail waiting for inbox confirmation\n")
            return
        raise RuntimeError(msg)


def send_mail(name, phone, page):
    host, port, user, password, mail_to = smtp_settings()
    if not mail_to:
        raise RuntimeError("smtp not configured")

    try:
        send_via_https(name, phone, page, mail_to)
        return
    except Exception as exc:
        sys.stderr.write("https send failed: %s: %s\n" % (type(exc).__name__, exc))

    if not user or not password:
        raise RuntimeError("smtp not configured")
    msg = EmailMessage()
    msg["Subject"] = "Заявка с aspect-it.ru: %s" % name
    msg["From"] = user
    msg["To"] = mail_to
    msg["Reply-To"] = user
    msg.set_content("Имя: %s\nТелефон: %s\nСтраница: %s\n" % (name, phone, page))
    try:
        with smtp_login(host, port, user, password) as smtp:
            smtp.send_message(msg)
    except Exception as exc:
        sys.stderr.write("smtp send failed: %s: %s\n" % (type(exc).__name__, exc))
        raise


def check_smtp():
    host, port, user, password, mail_to = smtp_settings()
    if not password:
        print("smtp login failed: SMTP_PASSWORD empty", flush=True)
        return 1
    print("smtp check host=%s port=%s user=%s to=%s" % (host, port, user, mail_to), flush=True)
    try:
        with smtp_login(host, port, user, password) as smtp:
            smtp.noop()
        print("smtp login ok", flush=True)
        return 0
    except Exception as exc:
        print("smtp login failed: %s: %s" % (type(exc).__name__, exc), flush=True)
        return 1


class Handler(BaseHTTPRequestHandler):
    def address_string(self):
        try:
            return BaseHTTPRequestHandler.address_string(self)
        except Exception:
            return "unix"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            configured = bool(env("SMTP_PASSWORD"))
            self._json(200, {"ok": True, "mail": configured})
            return
        self._json(404, {"ok": False})

    def do_POST(self):
        if self.path not in ("/lead", "/api/lead"):
            self._json(404, {"ok": False})
            return
        ip = client_ip(self)
        if not rate_ok(ip):
            self._json(429, {"ok": False, "error": "rate"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"ok": False})
            return
        if length < 2 or length > MAX_BODY:
            self._json(400, {"ok": False})
            return
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"ok": False})
            return
        if not isinstance(data, dict):
            self._json(400, {"ok": False})
            return
        if str(data.get("company") or "").strip():
            self._json(200, {"ok": True})
            return
        name = str(data.get("name") or "").strip()
        phone = str(data.get("phone") or "").strip()
        page = str(data.get("page") or "").strip()[:200]
        if not name or len(name) > MAX_NAME:
            self._json(400, {"ok": False, "error": "name"})
            return
        if not phone or len(phone) > MAX_PHONE or not PHONE_RE.match(phone):
            self._json(400, {"ok": False, "error": "phone"})
            return
        try:
            send_mail(name, phone, page or "/")
        except RuntimeError:
            self._json(503, {"ok": False, "error": "config"})
            return
        except Exception:
            self._json(502, {"ok": False, "error": "smtp"})
            return
        self._json(200, {"ok": True})


class ThreadingUnixHTTPServer(ThreadingMixIn, UnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    sock_path = env("SOCKET")
    port = int(env("PORT", "8080") or "8080")
    host, smtp_port, user, password, mail_to = smtp_settings()
    print(
        "mailer smtp=%s:%s user=%s to=%s configured=%s socket=%s"
        % (host, smtp_port, user, mail_to, bool(password), sock_path or ("tcp:%s" % port)),
        flush=True,
    )
    if sock_path:
        os.makedirs(os.path.dirname(sock_path) or ".", exist_ok=True)
        try:
            os.unlink(sock_path)
        except FileNotFoundError:
            pass
        server = ThreadingUnixHTTPServer(sock_path, Handler)
        os.chmod(sock_path, 0o666)
    else:
        server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        sys.exit(check_smtp())
    main()
