#!/usr/bin/env python3
"""Local server for claimcheck (pdf.js needs http rather than file://).
Cache-Control: no-store so changes are visible immediately."""
import http.server, functools, os

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8771
print(f"claimcheck: http://localhost:{PORT}/")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
