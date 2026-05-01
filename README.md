# SMB WebAdmin

Een eenvoudige webinterface om Samba/Linux-gebruikers, groepen en shares te beheren.

## Installatie (één commando)

```bash
git clone https://github.com/MadPatrick/smbconfig.git
cd smbconfig
sudo bash install.sh
```

Het script installeert alles automatisch:
- Samba, Python 3 en de benodigde tools
- De Flask-backend als systemd-service
- De juiste bestandsrechten en sudoers-configuratie

Daarna open je de interface in de browser op het adres dat het script toont, bijvoorbeeld:

```
http://192.168.1.10:5000
```

---

## Structuur

```text
smbconfig/
├── index.html          # Frontend (Bootstrap UI)
├── app.js              # Frontend logica (API-calls naar Flask backend)
├── install.sh          # InstallatieScript (één commando)
├── api/                # Flask backend
│   ├── app.py          # API + statische bestanden serveren
│   └── requirements.txt
├── scripts/            # Root-scripts voor Samba/Linux beheer
│   ├── smb-users       # list / create / disable / delete
│   ├── smb-groups      # list / create / add-member
│   └── smb-shares      # create / set-acl
└── config/             # Configuratiebestanden
    ├── shares.json
    ├── apache-smb-webadmin.conf  # Optioneel: Apache-proxy
    ├── smb-webadmin.service
    └── sudoers-smb-webadmin
```

---

## Scripts

| Script       | Subcommando's                                                          |
|--------------|------------------------------------------------------------------------|
| `smb-users`  | `list` · `create <user> <pass>` · `disable <user>` · `delete <user>`  |
| `smb-groups` | `list` · `create <groep>` · `add-member <user> <groep>`               |
| `smb-shares` | `create <naam> <pad> <groep>` · `set-acl <pad> <groep> <mode>`        |

---

## Update

Om de applicatie bij te werken naar de nieuwste versie, haal je eerst de laatste wijzigingen op via Git en voer je daarna het installatiescript uit in update-modus:

```bash
cd smbconfig
git pull
sudo bash install.sh update
```

Het update-commando:
- vervangt de applicatiebestanden in `/opt/smbadmin/` door de nieuwste versie
- past de bestandsrechten opnieuw toe
- herstart de `smb-webadmin` service automatisch

> **Let op:** de sudoers-configuratie en de systemd-service worden bij een update **niet** aangepast. Voer een volledige herinstallatie uit als die bestanden zijn gewijzigd.

---

## Beheer

```bash
# Status bekijken
sudo systemctl status smb-webadmin

# Logs bekijken
sudo journalctl -u smb-webadmin -f

# Herstarten
sudo systemctl restart smb-webadmin
```

## Belangrijk

Gebruik dit bij voorkeur alleen intern of via VPN. Stel Apache Basic Auth of een andere login
in voor de applicatie (zie `config/apache-smb-webadmin.conf`). Gebruik HTTPS als je wachtwoorden invoert.

