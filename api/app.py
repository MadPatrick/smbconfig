from flask import Flask, request, jsonify
import os
import subprocess
import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

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

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.errorhandler(Exception)
def handle_error(e):
    code = 400 if isinstance(e, ValueError) else 500
    return jsonify({"error": str(e)}), code

SMB_CONF = Path("/etc/samba/smb.conf")
SMB_CONF_KEYS = frozenset([
    "netbios name", "workgroup", "server string",
    "unix password sync",
    "security", "ntlm auth", "guest account", "map to guest",
    "bind interfaces only", "interfaces", "socket options",
    "aio read size", "aio write size", "use sendfile", "min receivefile size",
    "max log size", "logging", "log file",
    "wins support", "local master", "preferred master", "domain master", "os level",
    "force create mode", "force directory mode",
    "server min protocol", "server max protocol",
    "pam password change", "passwd program", "passwd chat", "obey pam restrictions",
    "panic action",
])

SAFE_CONFIG_VALUE = re.compile(r"^[^\n\r\x00#;]{0,500}$")

@app.get("/api/smbconfig")
def smbconfig():
    result = {k: "" for k in SMB_CONF_KEYS}
    try:
        text = SMB_CONF.read_text(errors="replace")
    except OSError:
        return jsonify(result)
    in_global = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("["):
            section = stripped[1:].split("]")[0].strip().lower()
            in_global = section == "global"
            continue
        if not in_global or not stripped or stripped.startswith(("#", ";")):
            continue
        if "=" in stripped:
            key, _, value = stripped.partition("=")
            key = key.strip().lower()
            if key in SMB_CONF_KEYS:
                result[key] = value.strip()
    return jsonify(result)

@app.post("/api/smbconfig")
def save_smbconfig():
    data = request.json or {}
    clean = {}
    for key, value in data.items():
        if key not in SMB_CONF_KEYS:
            raise ValueError(f"Onbekende configuratiesleutel: {key}")
        value = str(value) if value is not None else ""
        if not SAFE_CONFIG_VALUE.match(value):
            raise ValueError(f"Ongeldige waarde voor '{key}'")
        clean[key] = value.strip()
    run_script("smb-globalconfig", "update", json.dumps(clean))
    return jsonify({"ok": True})

@app.get("/api/interfaces")
def list_interfaces():
    try:
        interfaces = sorted(os.listdir('/sys/class/net'))
    except OSError:
        interfaces = []
    return jsonify(interfaces)

@app.get("/api/state")
def state():
    users = json.loads(run_script("smb-users", "list"))
    groups = json.loads(run_script("smb-groups", "list"))
    shares = json.loads(run_script("smb-shares", "list"))
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

@app.post("/api/groups/remove-user")
def remove_user_from_group():
    data = request.json or {}
    username = validate_name(data.get("username"), "gebruikersnaam")
    groupname = validate_name(data.get("groupname"), "groepsnaam")
    run_script("smb-groups", "remove-member", username, groupname)
    return jsonify({"ok": True})

@app.delete("/api/groups/<groupname>")
def delete_group(groupname):
    groupname = validate_name(groupname, "groepsnaam")
    run_script("smb-groups", "delete", groupname)
    return jsonify({"ok": True})

@app.post("/api/shares")
def create_share():
    data = request.json or {}
    name = validate_name(data.get("name"), "share naam")
    path = validate_path(data.get("path"))
    group = data.get("group", "")
    if group != "none":
        group = validate_name(group, "groepsnaam")

    existing = json.loads(run_script("smb-shares", "list"))
    if any(s["name"] == name for s in existing):
        raise ValueError("Share bestaat al")

    run_script("smb-shares", "create", name, path, group)
    return jsonify({"ok": True})

@app.post("/api/shares/<sharename>/update")
def update_share(sharename):
    sharename = validate_name(sharename, "share naam")
    data = request.json or {}
    group = data.get("group", "")
    if group and group != "none":
        group = validate_name(group, "groepsnaam")
    else:
        group = "none"
    read_only = data.get("read_only", "no")
    browseable = data.get("browseable", "yes")
    guest_ok = data.get("guest_ok", "no")
    if read_only not in ("yes", "no"):
        raise ValueError("Ongeldige read_only waarde")
    if browseable not in ("yes", "no"):
        raise ValueError("Ongeldige browseable waarde")
    if guest_ok not in ("yes", "no"):
        raise ValueError("Ongeldige guest_ok waarde")
    shares = json.loads(run_script("smb-shares", "list"))
    if not any(s["name"] == sharename for s in shares):
        raise ValueError("Share niet gevonden")
    run_script("smb-shares", "update", sharename, group, read_only, browseable, guest_ok)
    return jsonify({"ok": True})


@app.delete("/api/shares/<sharename>")
def delete_share(sharename):
    sharename = validate_name(sharename, "share naam")
    run_script("smb-shares", "delete", sharename)
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
