"""One-time step, run on your own computer: log in to YouTube and print a refresh token.

    python autotube/get_token.py client_secret.json

client_secret.json is the "Desktop app" OAuth client you download from Google Cloud Console.
Uses only the Python standard library, so nothing needs installing.
"""
import http.server
import json
import secrets
import sys
import urllib.parse
import urllib.request
import webbrowser

SCOPE = "https://www.googleapis.com/auth/youtube.upload"


def main(path):
    client = json.load(open(path))
    client = client.get("installed") or client.get("web")
    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if query.get("state", [""])[0] == state:
                result.update({k: v[0] for k, v in query.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h2>Done. You can close this tab and go back to the terminal.</h2>")

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect = f"http://127.0.0.1:{server.server_port}"
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client["client_id"], "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state,
    })
    print("Opening your browser. If it doesn't open, visit:\n" + url + "\n")
    webbrowser.open(url)
    while "code" not in result and "error" not in result:
        server.handle_request()
    if "error" in result:
        sys.exit(f"Login failed: {result['error']}")

    data = urllib.parse.urlencode({
        "code": result["code"], "client_id": client["client_id"], "client_secret": client["client_secret"],
        "redirect_uri": redirect, "grant_type": "authorization_code",
    }).encode()
    token = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", data))
    print("Add these three as GitHub repository secrets:\n")
    print(f"YT_CLIENT_ID      = {client['client_id']}")
    print(f"YT_CLIENT_SECRET  = {client['client_secret']}")
    print(f"YT_REFRESH_TOKEN  = {token['refresh_token']}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "client_secret.json")
