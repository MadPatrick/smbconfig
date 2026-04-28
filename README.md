# SMB WebAdmin

Een eenvoudige webinterface om Samba/Linux-gebruikers, groepen en shares te beheren via Apache.

## Structuur

```text
smb-webadmin/
├── public/           # index.html + app.js + Bootstrap UI
├── backend/          # Flask API
├── scripts/          # root scripts voor Samba/Linux beheer
├── config/           # sudoers + systemd voorbeeld
└── logs/
```

## Installatie

Kopieer de map naar bijvoorbeeld:

```bash
sudo cp -r smb-webadmin /opt/smb-webadmin
sudo chown -R root:www-data /opt/smb-webadmin
sudo chmod -R 750 /opt/smb-webadmin
sudo chmod -R 755 /opt/smb-webadmin/public
sudo chmod 750 /opt/smb-webadmin/scripts/*
```

Maak de frontend beschikbaar in Apache:

```bash
sudo ln -s /opt/smb-webadmin/public /var/www/html/smbadmin
```

Daarna open je:

```text
http://SERVER-IP/smbadmin/
```

## Backend installeren

```bash
cd /opt/smb-webadmin/backend
sudo python3 -m venv venv
sudo ./venv/bin/pip install -r requirements.txt
```

## sudoers installeren

Controleer eerst:

```bash
sudo visudo -cf /opt/smb-webadmin/config/sudoers-smb-webadmin
```

Kopieer daarna:

```bash
sudo cp /opt/smb-webadmin/config/sudoers-smb-webadmin /etc/sudoers.d/smb-webadmin
sudo chmod 440 /etc/sudoers.d/smb-webadmin
```

## Backend starten

Test handmatig:

```bash
cd /opt/smb-webadmin/backend
sudo -u www-data ./venv/bin/python app.py
```

Of installeer systemd:

```bash
sudo cp /opt/smb-webadmin/config/smb-webadmin.service /etc/systemd/system/smb-webadmin.service
sudo systemctl daemon-reload
sudo systemctl enable --now smb-webadmin
```

## Belangrijk

Gebruik dit bij voorkeur alleen intern of via VPN. Zet Apache Basic Auth of een andere login voor `/smbadmin`.
Gebruik HTTPS als je wachtwoorden invoert.
