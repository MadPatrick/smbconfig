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
SAFE_NFS_CLIENT = re.compile(r"^(\*|[a-zA-Z0-9.*/:_-]{1,128})$")
SAFE_NFS_OPTIONS = re.compile(r"^[a-zA-Z0-9,=_]{1,256}$")
SAFE_UUID = re.compile(r"^[0-9a-fA-F-]{1,36}$")
SAFE_FSTYPE = re.compile(r"^(ext2|ext3|ext4|xfs|btrfs|vfat|exfat|ntfs|ntfs-3g|f2fs|jfs|reiserfs|tmpfs|nfs|nfs4|cifs|auto)$")
SAFE_MOUNT_OPTIONS = re.compile(r"^[a-zA-Z0-9,=_.@-]{1,256}$")

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

@app.get("/api/sysinfo")
def sysinfo():
    def _read(path, fallback=""):
        try:
            return Path(path).read_text(errors="replace").strip()
        except OSError:
            return fallback

    def _run_safe(*cmd):
        try:
            result = subprocess.run(list(cmd), text=True, capture_output=True, timeout=5)
            return result.stdout.strip() if result.returncode == 0 else ""
        except Exception:
            return ""

    # Distro
    distro = ""
    os_release = _read("/etc/os-release")
    for line in os_release.splitlines():
        if line.startswith("PRETTY_NAME="):
            distro = line.split("=", 1)[1].strip().strip('"')
            break

    # Kernel
    kernel = _run_safe("uname", "-r")

    # Samba version
    smb_version = _run_safe("smbd", "--version")
    if not smb_version:
        smb_version = _run_safe("samba", "--version")

    # Hostname
    hostname = _run_safe("hostname")

    # Uptime (human-readable via uptime -p, fallback to raw)
    uptime = _run_safe("uptime", "-p") or _run_safe("uptime")

    # Architecture
    arch = _run_safe("uname", "-m")

    # IP address(es) – hostname -I returns space-separated list
    ip = _run_safe("hostname", "-I").split()[0] if _run_safe("hostname", "-I") else ""

    return jsonify({
        "distro": distro,
        "kernel": kernel,
        "samba": smb_version,
        "hostname": hostname,
        "uptime": uptime,
        "arch": arch,
        "ip": ip,
    })

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
    level2_oplocks = data.get("level2_oplocks", "")
    change_notify = data.get("change_notify", "")
    if read_only not in ("yes", "no"):
        raise ValueError("Ongeldige read_only waarde")
    if browseable not in ("yes", "no"):
        raise ValueError("Ongeldige browseable waarde")
    if guest_ok not in ("yes", "no"):
        raise ValueError("Ongeldige guest_ok waarde")
    if level2_oplocks not in ("yes", "no", ""):
        raise ValueError("Ongeldige level2_oplocks waarde")
    if change_notify not in ("yes", "no", ""):
        raise ValueError("Ongeldige change_notify waarde")
    shares = json.loads(run_script("smb-shares", "list"))
    if not any(s["name"] == sharename for s in shares):
        raise ValueError("Share niet gevonden")
    run_script("smb-shares", "update", sharename, group, read_only, browseable, guest_ok, level2_oplocks, change_notify)
    return jsonify({"ok": True})


@app.delete("/api/shares/<sharename>")
def delete_share(sharename):
    sharename = validate_name(sharename, "share naam")
    run_script("smb-shares", "delete", sharename)
    return jsonify({"ok": True})

def validate_nfs_client(value):
    if not value or not SAFE_NFS_CLIENT.match(value):
        raise ValueError("Ongeldige NFS client")
    return value

def validate_nfs_options(value):
    if not value or not SAFE_NFS_OPTIONS.match(value):
        raise ValueError("Ongeldige NFS opties")
    return value

@app.get("/api/nfs")
def list_nfs():
    return jsonify(json.loads(run_script("nfs-shares", "list")))

@app.post("/api/nfs")
def create_nfs():
    data = request.json or {}
    path = validate_path(data.get("path"))
    client = validate_nfs_client(data.get("client", "*"))
    options = validate_nfs_options(data.get("options", "rw,sync,no_subtree_check"))
    existing = json.loads(run_script("nfs-shares", "list"))
    if any(e["path"] == path for e in existing):
        raise ValueError("Export bestaat al")
    run_script("nfs-shares", "create", path, client, options)
    return jsonify({"ok": True})

@app.post("/api/nfs/update")
def update_nfs():
    data = request.json or {}
    path = validate_path(data.get("path"))
    client = validate_nfs_client(data.get("client", "*"))
    options = validate_nfs_options(data.get("options", "rw,sync,no_subtree_check"))
    existing = json.loads(run_script("nfs-shares", "list"))
    if not any(e["path"] == path for e in existing):
        raise ValueError("Export niet gevonden")
    run_script("nfs-shares", "update", path, client, options)
    return jsonify({"ok": True})

@app.delete("/api/nfs/<path:nfspath>")
def delete_nfs(nfspath):
    path = validate_path("/" + nfspath)
    run_script("nfs-shares", "delete", path)
    return jsonify({"ok": True})

def validate_uuid(value):
    if not value or not SAFE_UUID.match(value):
        raise ValueError("Ongeldige UUID")
    return value

def validate_fstype(value):
    if not value or not SAFE_FSTYPE.match(value):
        raise ValueError("Ongeldig bestandssysteem")
    return value

def validate_mount_options(value):
    if not value or not SAFE_MOUNT_OPTIONS.match(value):
        raise ValueError("Ongeldige mount opties")
    return value

@app.get("/api/mounts")
def list_mounts():
    return jsonify(json.loads(run_script("disk-mounts", "list")))

@app.get("/api/mounts/disks")
def list_disks():
    return jsonify(json.loads(run_script("disk-mounts", "list-disks")))

@app.post("/api/mounts")
def add_mount():
    data = request.json or {}
    uuid = validate_uuid(data.get("uuid", ""))
    mountpoint = validate_path(data.get("mountpoint", ""))
    fstype = validate_fstype(data.get("fstype", ""))
    options = validate_mount_options(data.get("options", "defaults"))
    run_script("disk-mounts", "add", uuid, mountpoint, fstype, options)
    return jsonify({"ok": True})

@app.post("/api/mounts/update")
def update_mount():
    data = request.json or {}
    uuid = validate_uuid(data.get("uuid", ""))
    mountpoint = validate_path(data.get("mountpoint", ""))
    fstype = validate_fstype(data.get("fstype", ""))
    options = validate_mount_options(data.get("options", "defaults"))
    run_script("disk-mounts", "update", uuid, mountpoint, fstype, options)
    return jsonify({"ok": True})

@app.post("/api/update")
def do_update():
    output = run_script("app-update")
    return jsonify({"ok": True, "output": output})

@app.delete("/api/mounts/<uuid>")
def remove_mount(uuid):
    uuid = validate_uuid(uuid)
    run_script("disk-mounts", "remove", uuid)
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
