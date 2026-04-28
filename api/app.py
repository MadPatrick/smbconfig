from flask import Flask, request, jsonify
import subprocess
import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
SHARES_FILE = BASE_DIR / "config" / "shares.json"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")

SAFE_NAME = re.compile(r"^[a-zA-Z0-9._-]{1,32}$")
SAFE_PATH = re.compile(r"^/[a-zA-Z0-9._/\-]{1,240}$")

def validate_name(value, field="naam"):
    if not value or not SAFE_NAME.match(value):
        raise ValueError(f"Ongeldige {field}")
    return value

def validate_path(value):
    if not value or not SAFE_PATH.match(value) or ".." in value:
        raise ValueError("Ongeldig pad")
    return value

def run_script(*args):
    cmd = ["sudo", str(BASE_DIR / "scripts" / args[0]), *args[1:]]
    completed = subprocess.run(cmd, text=True, capture_output=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip() or "Script fout")
    return completed.stdout.strip()

def load_shares_file():
    if not SHARES_FILE.exists():
        return []
    return json.loads(SHARES_FILE.read_text())

def save_shares_file(shares):
    SHARES_FILE.write_text(json.dumps(shares, indent=2))

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.errorhandler(Exception)
def handle_error(e):
    code = 400 if isinstance(e, ValueError) else 500
    return jsonify({"error": str(e)}), code

@app.get("/api/state")
def state():
    users = json.loads(run_script("smb-users", "list"))
    groups = json.loads(run_script("smb-groups", "list"))
    shares = load_shares_file()
    return jsonify({"users": users, "groups": groups, "shares": shares})

@app.post("/api/users")
def create_user():
    data = request.json or {}
    username = validate_name(data.get("username"), "gebruikersnaam")
    password = data.get("password", "")
    if len(password) < 8:
        raise ValueError("Wachtwoord moet minimaal 8 tekens zijn")
    run_script("smb-users", "create", username, password)
    return jsonify({"ok": True})

@app.post("/api/users/<username>/disable")
def disable_user(username):
    username = validate_name(username, "gebruikersnaam")
    run_script("smb-users", "disable", username)
    return jsonify({"ok": True})

@app.delete("/api/users/<username>")
def delete_user(username):
    username = validate_name(username, "gebruikersnaam")
    run_script("smb-users", "delete", username)
    return jsonify({"ok": True})

@app.post("/api/groups")
def create_group():
    data = request.json or {}
    groupname = validate_name(data.get("groupname"), "groepsnaam")
    run_script("smb-groups", "create", groupname)
    return jsonify({"ok": True})

@app.post("/api/groups/add-user")
def add_user_to_group():
    data = request.json or {}
    username = validate_name(data.get("username"), "gebruikersnaam")
    groupname = validate_name(data.get("groupname"), "groepsnaam")
    run_script("smb-groups", "add-member", username, groupname)
    return jsonify({"ok": True})

@app.post("/api/shares")
def create_share():
    data = request.json or {}
    name = validate_name(data.get("name"), "share naam")
    path = validate_path(data.get("path"))
    group = validate_name(data.get("group"), "groepsnaam")

    shares = load_shares_file()
    if any(s["name"] == name for s in shares):
        raise ValueError("Share bestaat al")

    run_script("smb-shares", "create", name, path, group)

    shares.append({
        "name": name,
        "path": path,
        "group": group,
        "configured": True
    })
    save_shares_file(shares)
    return jsonify({"ok": True})

@app.post("/api/shares/acl")
def set_acl():
    data = request.json or {}
    share = validate_name(data.get("share"), "share naam")
    group = validate_name(data.get("group"), "groepsnaam")
    mode = data.get("mode")

    if mode not in ["read", "write", "none"]:
        raise ValueError("Ongeldige ACL mode")

    shares = load_shares_file()
    match = next((s for s in shares if s["name"] == share), None)
    if not match:
        raise ValueError("Share niet gevonden")

    run_script("smb-shares", "set-acl", match["path"], group, mode)
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
