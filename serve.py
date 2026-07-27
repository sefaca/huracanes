#!/usr/bin/env python3
"""Servidor local de la web Huracanes con cache desactivada (para previsualizar cambios al instante)."""
import http.server, socketserver, os

PORT = 8080
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "web"))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, *a):
        pass

with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Pizzerias Huracanes -> http://localhost:{PORT}/  (Ctrl+C para parar)")
    httpd.serve_forever()
