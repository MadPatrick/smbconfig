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
├── scripts/            # Root-scripts voor Samba/Linux/NFS-beheer
│   ├── smb-users         # list / create / disable / delete
│   ├── smb-groups        # list / create / add-member
│   ├── smb-shares        # create / set-acl
│   ├── smb-globalconfig  # update (globale Samba-instellingen)
│   └── nfs-shares        # list / create / update / delete
└── config/             # Configuratiebestanden
    ├── shares.json
    ├── apache-smb-webadmin.conf  # Optioneel: Apache-proxy
    ├── smb-webadmin.service
    └── sudoers-smb-webadmin
```

---

## Scripts

| Script            | Subcommando's                                                               |
|-------------------|-----------------------------------------------------------------------------|
| `smb-users`       | `list` · `create <user> <pass>` · `disable <user>` · `delete <user>`       |
| `smb-groups`      | `list` · `create <groep>` · `add-member <user> <groep>`                    |
| `smb-shares`      | `create <naam> <pad> <groep>` · `set-acl <pad> <groep> <mode>`             |
| `smb-globalconfig`| `update '<json>'`                                                           |
| `nfs-shares`      | `list` · `create <pad> <client> <opties>` · `update <pad> <client> <opties>` · `delete <pad>` |

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
- past de bestandsrechten en sudoers-configuratie opnieuw toe
- herstart de `smb-webadmin` service automatisch

---

## NFS-shares (Hikvision-camera's)

`install.sh` installeert en start `nfs-kernel-server` automatisch. Via de NFS-tab in de webinterface kun je daarna exports toevoegen, bewerken en verwijderen. De app maakt de map aan en stelt automatisch de juiste rechten in (`chown nobody:nogroup` + `chmod 777`).

**Veelgebruikte opties voor Hikvision-camera's:**

| Optie               | Betekenis                                               |
|---------------------|---------------------------------------------------------|
| `rw`                | Schrijf- en leesrechten                                 |
| `sync`              | Schrijfacties direct naar schijf (veiliger)             |
| `no_subtree_check`  | Minder overhead, aanbevolen voor grote exports          |
| `no_root_squash`    | Camera's schrijven als root op de server                |

**Voorbeeld (vier camera's op `/media/disk3`):**

| Pad                  | Client           | Opties                                      |
|----------------------|------------------|---------------------------------------------|
| `/media/disk3/cam1`  | `192.168.1.0/24` | `rw,sync,no_subtree_check,no_root_squash`   |
| `/media/disk3/cam2`  | `192.168.1.0/24` | `rw,sync,no_subtree_check,no_root_squash`   |

**Wat de app niet doet (handmatig instellen):**

- **Schijf koppelen via fstab** – gebruik `sudo blkid` om de UUID op te vragen en voeg de schijf toe aan `/etc/fstab`, daarna `sudo mount -a`.
- **Firewall (ufw)** – sta NFS-verkeer toe vanuit jouw netwerk:
  ```bash
  sudo ufw allow from 192.168.1.0/24 to any port nfs
  sudo ufw allow 111/tcp
  sudo ufw allow 111/udp
  ```

**Hikvision-camera instellen:**

1. Ga naar *Configuration → Storage → Storage Management → NetHDD*
2. Stel in: **Type** NFS · **IP** van de server · **Path** bijv. `/media/disk3/cam1`
3. Klik op **Test** en daarna **Save**
4. Ga naar *HDD Management*, selecteer de NetHDD en klik **Format**

**Controlecommando's:**

```bash
sudo exportfs -v          # Toon actieve NFS-exports
sudo exportfs -ra         # Herlaad /etc/exports
sudo systemctl status nfs-kernel-server
df -h                     # Controleer schijfgebruik
```

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

