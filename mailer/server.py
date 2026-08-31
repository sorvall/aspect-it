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
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from socketserver import ThreadingMixIn, UnixStreamServer

MAX_BODY = 8192
MAX_NAME = 120
MAX_PHONE = 40
MAX_MESSAGE = 1200
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
    port = int(env("SMTP_PORT", "587") or "587")
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
        for family in (socket.AF_INET6, socket.AF_INET):
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


def queue_path():
    return env("QUEUE", "/tmp/aspect-mailer/leads.jsonl")


def enqueue(name, phone, page, message=""):
    path = queue_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    rec = json.dumps(
        {
            "name": name,
            "phone": phone,
            "page": page,
            "message": message,
            "ts": int(time.time()),
        },
        ensure_ascii=False,
    )
    with open(path, "a", encoding="utf-8") as f:
        f.write(rec + "\n")
        f.flush()
        os.fsync(f.fileno())


def send_smtp_message(name, phone, page, message=""):
    host, port, user, password, mail_to = smtp_settings()
    if not user or not password or not mail_to:
        raise RuntimeError("smtp not configured")
    kind = "Вопрос" if message else "Заявка"
    msg = EmailMessage()
    msg["Subject"] = "%s с aspect-it.ru: %s" % (kind, name)
    msg["From"] = user
    msg["To"] = mail_to
    msg["Reply-To"] = user
    lines = ["Имя: %s" % name, "Телефон: %s" % phone, "Страница: %s" % page]
    if message:
        lines.extend(["", "Вопрос:", message])
    msg.set_content("\n".join(lines) + "\n")
    with smtp_login(host, port, user, password) as smtp:
        smtp.send_message(msg)


def send_mail(name, phone, page, message=""):
    try:
        send_smtp_message(name, phone, page or "/", message)
        return
    except Exception as exc:
        sys.stderr.write("smtp send failed, queueing: %s: %s\n" % (type(exc).__name__, exc))
        enqueue(name, phone, page or "/", message)


def drain_file(path):
    if not os.path.isfile(path) or os.path.getsize(path) == 0:
        print("queue empty", flush=True)
        return 0
    lines = [ln.strip() for ln in open(path, encoding="utf-8") if ln.strip()]
    print("queue size=%s" % len(lines), flush=True)
    for i, line in enumerate(lines):
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            print("lead %s skipped: bad json" % i, flush=True)
            continue
        if not isinstance(data, dict):
            continue
        name = str(data.get("name") or "").strip()
        phone = str(data.get("phone") or "").strip()
        page = str(data.get("page") or "/").strip()
        message = str(data.get("message") or "").strip()
        if not name or not phone:
            print("lead %s skipped: missing fields" % i, flush=True)
            continue
        try:
            send_smtp_message(name, phone, page, message)
            print("lead %s sent" % i, flush=True)
        except Exception as exc:
            print("lead %s failed: %s" % (i, type(exc).__name__), flush=True)
            return 1
    return 0


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
        message = str(data.get("message") or "").strip()[:MAX_MESSAGE]
        if not name or len(name) > MAX_NAME:
            self._json(400, {"ok": False, "error": "name"})
            return
        if not phone or len(phone) > MAX_PHONE or not PHONE_RE.match(phone):
            self._json(400, {"ok": False, "error": "phone"})
            return
        try:
            send_mail(name, phone, page or "/", message)
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
    if len(sys.argv) > 2 and sys.argv[1] == "drain":
        sys.exit(drain_file(sys.argv[2]))
    main()
