#!/usr/bin/env python3
import json
import os
import re
import smtplib
import ssl
import sys
import threading
import time
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 4096
MAX_NAME = 120
MAX_PHONE = 40
RATE_WINDOW = 3600
RATE_MAX = 8
PHONE_RE = re.compile(r"^[+\d][\d\s\-().]{5,38}$")
HITS = {}
HITS_LOCK = threading.Lock()


def env(name, default=""):
    return os.environ.get(name, default).strip()


def client_ip(handler):
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return handler.client_address[0]


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


def send_mail(name, phone, page):
    host = env("SMTP_HOST", "smtp.yandex.ru")
    port = int(env("SMTP_PORT", "465") or "465")
    user = env("SMTP_USER")
    password = env("SMTP_PASSWORD")
    mail_to = env("MAIL_TO") or "sorvall@mail.ru"
    if not user or not password or not mail_to:
        raise RuntimeError("smtp not configured")

    msg = EmailMessage()
    msg["Subject"] = f"Заявка с aspect-it.ru: {name}"
    msg["From"] = user
    msg["To"] = mail_to
    msg["Reply-To"] = user
    msg.set_content(
        f"Имя: {name}\nТелефон: {phone}\nСтраница: {page}\n"
    )

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
        return
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.login(user, password)
        smtp.send_message(msg)


class Handler(BaseHTTPRequestHandler):
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
            configured = bool(env("SMTP_USER") and env("SMTP_PASSWORD"))
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


def main():
    port = int(env("PORT", "8080") or "8080")
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print("mailer listening on %s" % port, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
