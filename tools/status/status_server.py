#!/usr/bin/env python3
"""Answers "is the Drith server up?" for the website's PLAY panel.

The game is a Godot/ENet server on a UDP port. A browser has no raw sockets, so
the page can't check that port itself — it fetches JSON over HTTP instead, and
this is the thing that serves it. Run it on the same box as the game server.

    {"online": true, "address": "203.0.113.24:27015", "port": 27015,
     "checked": "2026-08-01T20:14:03Z"}

Point _config.yml's status_url at it. Stdlib only, no pip install.

    python3 status_server.py --address 203.0.113.24:27015

Probes:
  bind  (default)  try to bind the game's UDP port. If the bind is refused,
                   the game server is holding it, so it's up. Protocol
                   agnostic — it never has to speak ENet — but it only works
                   from the same machine, and it says "some process owns that
                   port", not "the game is answering players".
  tcp              connect to the port instead. Only for a TCP game port.

NOTE: a page served over HTTPS cannot fetch an http:// URL — the browser kills
it as mixed content. This needs to be reachable over HTTPS. See README.md.
"""

import argparse
import errno
import json
import socket
import ssl
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CACHE_SECONDS = 3.0     # a burst of page loads shouldn't mean a burst of probes
TCP_TIMEOUT = 1.0

# Both spellings of "that port is taken", since Windows uses the winsock codes.
IN_USE = {errno.EADDRINUSE, errno.EACCES}
for _name in ("WSAEADDRINUSE", "WSAEACCES"):
    if hasattr(errno, _name):
        IN_USE.add(getattr(errno, _name))


def probe_bind(host, port):
    """True when another process already owns the UDP port.

    No SO_REUSEADDR/SO_REUSEPORT on purpose: without them a second bind to a
    live port is refused on both Linux and Windows, which is the signal we
    want. With them the kernel might hand us the port anyway and we'd report
    a running server as offline.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind((host, port))
    except OSError as exc:
        return exc.errno in IN_USE
    finally:
        sock.close()
    return False


def probe_tcp(host, port):
    """True when something accepts a TCP connection on the port."""
    target = "127.0.0.1" if host in ("", "0.0.0.0") else host
    try:
        with socket.create_connection((target, port), TCP_TIMEOUT):
            return True
    except OSError:
        return False


PROBES = {"bind": probe_bind, "tcp": probe_tcp}


class Status:
    """The current reading, re-probed at most every CACHE_SECONDS."""

    def __init__(self, opts):
        self.opts = opts
        self.probe = PROBES[opts.probe]
        self.online = False
        self.checked = 0.0

    def read(self):
        now = time.time()
        if now - self.checked >= CACHE_SECONDS:
            self.online = self.probe(self.opts.game_host, self.opts.game_port)
            self.checked = now
        return {
            "online": self.online,
            "address": self.opts.address or None,
            "port": self.opts.game_port,
            "checked": time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                     time.gmtime(self.checked)),
        }


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    status = None       # set in main()
    opts = None

    def _headers(self, code, length=0, kind="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(length))
        # The site is a static page on another origin, so it needs CORS to read
        # the body at all. no-store keeps proxies from serving a stale reading.
        self.send_header("Access-Control-Allow-Origin", self.opts.origin)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _body(self):
        if self.path.split("?")[0].rstrip("/") not in ("", "/status"):
            return None
        return json.dumps(self.status.read()).encode()

    def do_GET(self):
        body = self._body()
        if body is None:
            self._headers(404, 0, "text/plain")
            return
        self._headers(200, len(body))
        self.wfile.write(body)

    def do_HEAD(self):
        body = self._body()
        self._headers(404 if body is None else 200, 0)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.opts.origin)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt, *args):
        if self.opts.verbose:
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game-port", type=int, default=27015,
                    help="port the game server runs on (default: 27015)")
    ap.add_argument("--game-host", default="0.0.0.0",
                    help="address the game server binds; match it or the bind "
                         "probe can miss (default: 0.0.0.0)")
    ap.add_argument("--listen", default="0.0.0.0",
                    help="address to serve status on (default: 0.0.0.0)")
    ap.add_argument("--port", type=int, default=27016,
                    help="port to serve status on (default: 27016)")
    ap.add_argument("--address", default="",
                    help="access code handed to players, e.g. 203.0.113.24:27015. "
                         "Overrides the one baked into the site at build time.")
    ap.add_argument("--origin", default="*",
                    help="Access-Control-Allow-Origin; pin it to your site's "
                         "origin to stop other pages reading this (default: *)")
    ap.add_argument("--probe", choices=sorted(PROBES), default="bind",
                    help="how to decide the server is up (default: bind)")
    ap.add_argument("--cert", help="TLS certificate (PEM) — serve HTTPS directly "
                                   "instead of putting a proxy in front")
    ap.add_argument("--key", help="TLS private key (PEM)")
    ap.add_argument("--verbose", action="store_true", help="log every request")
    opts = ap.parse_args()

    if bool(opts.cert) != bool(opts.key):
        ap.error("--cert and --key go together")

    Handler.status = Status(opts)
    Handler.opts = opts
    httpd = ThreadingHTTPServer((opts.listen, opts.port), Handler)

    scheme = "http"
    if opts.cert:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(opts.cert, opts.key)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        scheme = "https"

    sys.stderr.write("drith status: %s://%s:%d/status — %s probe on udp/%d\n"
                     % (scheme, opts.listen, opts.port, opts.probe, opts.game_port))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
