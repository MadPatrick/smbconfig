#!/bin/bash
# SMB WebAdmin – installatieScript
# Gebruik: sudo bash install.sh
set -euo pipefail

INSTALL_DIR="/opt/smbadmin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Voer dit script uit als root: sudo bash install.sh" >&2
  exit 1
fi

# Snelle update-modus: bestanden verversen zonder volledige herinstallatie
if [[ "${1:-}" == "update" ]]; then
  echo "=== SMB WebAdmin update ==="
  echo "→ Bestanden bijwerken in $INSTALL_DIR..."
  cp -r "$SCRIPT_DIR/index.html" "$SCRIPT_DIR/app.js" \
        "$SCRIPT_DIR/api" "$SCRIPT_DIR/scripts" \
        "$INSTALL_DIR/"
  chown -R root:www-data "$INSTALL_DIR/api" "$INSTALL_DIR/scripts"
  chmod -R 750 "$INSTALL_DIR/scripts/"* "$INSTALL_DIR/api"
  chmod 644 "$INSTALL_DIR/index.html" "$INSTALL_DIR/app.js"
  systemctl restart smb-webadmin
  echo "✓ Update klaar – service herstart."
  exit 0
fi

echo "=== SMB WebAdmin installatie ==="

# 1. Benodigde pakketten installeren
echo "→ Pakketten installeren (samba, python3, acl)..."
apt-get update -q
apt-get install -y -q samba python3 python3-venv acl

# 2. Bestanden kopiëren
echo "→ Bestanden kopiëren naar $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR/index.html" "$SCRIPT_DIR/app.js" \
      "$SCRIPT_DIR/api" "$SCRIPT_DIR/scripts" "$SCRIPT_DIR/config" \
      "$INSTALL_DIR/"

chown -R root:www-data "$INSTALL_DIR"
chmod -R 750 "$INSTALL_DIR"
chmod 644 "$INSTALL_DIR/index.html" "$INSTALL_DIR/app.js"
chmod 750 "$INSTALL_DIR/scripts/"*
# shares.json moet door www-data schrijfbaar zijn
touch "$INSTALL_DIR/config/shares.json"
chown www-data:www-data "$INSTALL_DIR/config/shares.json"
chmod 660 "$INSTALL_DIR/config/shares.json"

# 3. Python-omgeving aanmaken
echo "→ Python-omgeving aanmaken en Flask installeren..."
python3 -m venv "$INSTALL_DIR/api/venv"
"$INSTALL_DIR/api/venv/bin/pip" install --quiet -r "$INSTALL_DIR/api/requirements.txt"

# 4. Sudoers instellen
echo "→ Sudoers instellen..."
visudo -cf "$INSTALL_DIR/config/sudoers-smb-webadmin"
cp "$INSTALL_DIR/config/sudoers-smb-webadmin" /etc/sudoers.d/smb-webadmin
chmod 440 /etc/sudoers.d/smb-webadmin

# 5. Systemd service instellen
echo "→ Service instellen en starten..."
cp "$INSTALL_DIR/config/smb-webadmin.service" /etc/systemd/system/smb-webadmin.service
systemctl daemon-reload
systemctl enable --now smb-webadmin

# 6. Toegangs-URL tonen
IP=$(hostname -I | awk "{print \$1}")
echo ""
echo "✓ SMB WebAdmin is geïnstalleerd en actief!"
echo "  Open in de browser: http://${IP}:5000"
echo ""
echo "  Status bekijken:  sudo systemctl status smb-webadmin"
echo "  Logs bekijken:    sudo journalctl -u smb-webadmin -f"
