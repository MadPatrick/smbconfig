# SMB WebAdmin

Een eenvoudige webinterface om Samba/Linux-gebruikers, groepen en shares te beheren.

## Gebruik (standalone, geen backend)

Open `index.html` rechtstreeks in de browser — geen server of installatie nodig.

```
Dubbelklik op index.html  (of open via File → Open in de browser)
```

Alle gegevens (gebruikers, groepen, shares) worden opgeslagen in `localStorage` van de browser.
Ze blijven bewaard bij het sluiten en heropenen van de pagina.

> **Let op:** de gegevens worden alleen in de browser opgeslagen. Er worden geen echte
> Linux-/Samba-commando's uitgevoerd. Gebruik de backend (zie hieronder) als je de
> configuratie ook daadwerkelijk op het systeem wilt toepassen.

---

## Structuur

```text
smbconfig/
├── index.html          # Frontend (Bootstrap UI)
├── app.js              # Frontend logica (localStorage)
├── api/                # Flask backend (optioneel)
│   ├── app.py
│   └── requirements.txt
├── scripts/            # Root-scripts voor Samba/Linux beheer (optioneel)
│   ├── smb-users       # list / create / disable / delete
│   ├── smb-groups      # list / create / add-member
│   └── smb-shares      # create / set-acl
└── config/             # Configuratiebestanden (optioneel)
    ├── shares.json
    ├── apache-smb-webadmin.conf
    ├── smb-webadmin.service
    └── sudoers-smb-webadmin
```

---

## Optioneel: backend installeren (voor echte Samba-beheer)

Als je de interface wilt gebruiken om daadwerkelijk gebruikers, groepen en shares op het
systeem te beheren, installeer dan de Flask-backend en draai de app via Apache.

### Kopieer naar Apache-documentroot

```bash
sudo cp -r . /var/www/html/smbadmin
sudo chown -R root:www-data /var/www/html/smbadmin
sudo chmod -R 750 /var/www/html/smbadmin
sudo chmod 755 /var/www/html/smbadmin/index.html /var/www/html/smbadmin/app.js
sudo chmod 750 /var/www/html/smbadmin/scripts/*
```

### Apache instellen

```bash
sudo a2enmod proxy proxy_http
sudo cp /var/www/html/smbadmin/config/apache-smb-webadmin.conf /etc/apache2/sites-available/smb-webadmin.conf
sudo a2ensite smb-webadmin
sudo systemctl reload apache2
```

### Backend installeren

```bash
cd /var/www/html/smbadmin/api
sudo python3 -m venv venv
sudo ./venv/bin/pip install -r requirements.txt
```

### sudoers instellen

```bash
sudo visudo -cf /var/www/html/smbadmin/config/sudoers-smb-webadmin
sudo cp /var/www/html/smbadmin/config/sudoers-smb-webadmin /etc/sudoers.d/smb-webadmin
sudo chmod 440 /etc/sudoers.d/smb-webadmin
```

### Backend starten

```bash
# Handmatig testen:
cd /var/www/html/smbadmin/api
sudo -u www-data ./venv/bin/python app.py

# Of als systemd-service:
sudo cp /var/www/html/smbadmin/config/smb-webadmin.service /etc/systemd/system/smb-webadmin.service
sudo systemctl daemon-reload
sudo systemctl enable --now smb-webadmin
```

Open daarna: `http://smb-webadmin.local/` (of vervang door het IP-adres van de server).

### Scripts

| Script       | Subcommando's                                                          |
|--------------|------------------------------------------------------------------------|
| `smb-users`  | `list` · `create <user> <pass>` · `disable <user>` · `delete <user>`  |
| `smb-groups` | `list` · `create <groep>` · `add-member <user> <groep>`               |
| `smb-shares` | `create <naam> <pad> <groep>` · `set-acl <pad> <groep> <mode>`        |

## Belangrijk

Gebruik dit bij voorkeur alleen intern of via VPN. Stel Apache Basic Auth of een andere login
in voor de applicatie. Gebruik HTTPS als je wachtwoorden invoert.

