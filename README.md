# SMB WebAdmin

Een eenvoudige webinterface om Samba/Linux-gebruikers, groepen en shares te beheren via Apache.

## Structuur

```text
/var/www/html/smbadmin/
├── index.html          # Frontend (Bootstrap UI)
├── app.js              # Frontend logica
├── api/                # Flask backend
│   ├── app.py
│   └── requirements.txt
├── scripts/            # Root-scripts voor Samba/Linux beheer
│   ├── smb-users       # list / create / disable / delete
│   ├── smb-groups      # list / create / add-member
│   └── smb-shares      # create / set-acl
└── config/             # Configuratiebestanden
    ├── shares.json
    ├── apache-smb-webadmin.conf
    ├── smb-webadmin.service
    └── sudoers-smb-webadmin
```

## Installatie

Kopieer de map naar de Apache-documentroot:

```bash
sudo cp -r . /var/www/html/smbadmin
sudo chown -R root:www-data /var/www/html/smbadmin
sudo chmod -R 750 /var/www/html/smbadmin
sudo chmod -R 755 /var/www/html/smbadmin/index.html /var/www/html/smbadmin/app.js
sudo chmod 750 /var/www/html/smbadmin/scripts/*
```

## Apache instellen

Zorg dat de modules `proxy` en `proxy_http` actief zijn en kopieer de Apache-config:

```bash
sudo a2enmod proxy proxy_http
sudo cp /var/www/html/smbadmin/config/apache-smb-webadmin.conf /etc/apache2/sites-available/smb-webadmin.conf
sudo a2ensite smb-webadmin
sudo systemctl reload apache2
```

Open daarna: `http://smb-webadmin.local/` (of vervang door het IP-adres van de server).

## Backend installeren

```bash
cd /var/www/html/smbadmin/api
sudo python3 -m venv venv
sudo ./venv/bin/pip install -r requirements.txt
```

## sudoers instellen

Controleer eerst:

```bash
sudo visudo -cf /var/www/html/smbadmin/config/sudoers-smb-webadmin
```

Kopieer daarna:

```bash
sudo cp /var/www/html/smbadmin/config/sudoers-smb-webadmin /etc/sudoers.d/smb-webadmin
sudo chmod 440 /etc/sudoers.d/smb-webadmin
```

## Backend starten

Test handmatig:

```bash
cd /var/www/html/smbadmin/api
sudo -u www-data ./venv/bin/python app.py
```

Of installeer als systemd-service:

```bash
sudo cp /var/www/html/smbadmin/config/smb-webadmin.service /etc/systemd/system/smb-webadmin.service
sudo systemctl daemon-reload
sudo systemctl enable --now smb-webadmin
```

## Scripts

De drie beheersscripts ondersteunen meerdere subcommando's:

| Script       | Subcommando's                                      |
|--------------|----------------------------------------------------|
| `smb-users`  | `list` · `create <user> <pass>` · `disable <user>` · `delete <user>` |
| `smb-groups` | `list` · `create <groep>` · `add-member <user> <groep>` |
| `smb-shares` | `create <naam> <pad> <groep>` · `set-acl <pad> <groep> <mode>` |

## Belangrijk

Gebruik dit bij voorkeur alleen intern of via VPN. Stel Apache Basic Auth of een andere login in voor de applicatie.
Gebruik HTTPS als je wachtwoorden invoert.

