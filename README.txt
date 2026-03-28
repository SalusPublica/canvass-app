# Canvass Coordinator

A free, open source campaign canvassing coordination tool for campaign teams.
Built to make democratic participation accessible regardless of resources.

![License](https://img.shields.io/badge/license-AGPL--3.0-red)

---

## What is this?

Canvass Coordinator helps campaign teams coordinate and track their canvassing
efforts. Volunteers can log door knocks and leaflet drops on an interactive map,
and campaign chiefs can monitor progress through a statistics dashboard.

Features:
- Interactive map for logging and tracking canvassing visits
- Log door knocks and leaflet drops with address and date
- Click directly on the map to log a visit
- 2023 Finnish parliamentary election results as optional map layers
- Voter turnout data by polling district
- Campaign statistics dashboard
- Multiple team support
- Secure team login

---

## Philosophy

This software is free because democratic participation should not be restricted
by purchasing power. Small campaign teams deserve the same tools as well-funded
ones.

This software is licensed under the GNU Affero General Public License v3.0.
Anyone who modifies and distributes this software must make their modifications
publicly available under the same license. See [LICENSE](LICENSE) for details.

---

## Requirements

- A server running Linux (Ubuntu 22.04 or later recommended)
- Node.js 20 or later
- npm
- A domain name (optional but recommended)
- Basic comfort with the command line

---

## Self-Hosting on a Cloud Server

This guide assumes you are using a Linux cloud server from a provider such as
DigitalOcean, Hetzner, Linode, or similar. Hetzner is recommended for
EU-based hosting, which is important for GDPR compliance.

### 1. Connect to your server
```bash
ssh root@YOUR-SERVER-IP
```

### 2. Create a non-root user

Running as root is a security risk. Create a dedicated user instead:
```bash
adduser canvass
usermod -aG sudo canvass
su - canvass
```

### 3. Install Node.js and npm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify the installation:
```bash
node --version
npm --version
```

### 4. Clone the repository
```bash
git clone https://github.com/SalusPublica/canvass-app.git
cd canvass-app
```

### 5. Install dependencies
```bash
npm install
```

### 6. Create your environment file
```bash
nano .env
```

Add the following, replacing the values with your own:
```
PORT=3000
ALLOWED_ORIGIN=https://yourdomain.com
```

Save with Ctrl+X, then Y, then Enter.

### 7. Set up your teams

Create a `teams.json` file:
```bash
nano teams.json
```

Add your teams in the following format:
```json
[
  { "name": "Your Team Name", "code": "your-secret-code" }
]
```

You can add as many teams as you need. Each team must have a unique name and
code. The code is hashed when the server starts so it is never stored in plain
text. Save with Ctrl+X, then Y, then Enter.

### 8. Add your election data

Copy your `districts.geojson` file to the server. This file is not included
in the repository for size reasons. Instructions for generating it are
available in [GEODATA.md](GEODATA.md).

### 9. Start the server

For testing:
```bash
node server.js
```

For production, use a process manager like PM2 to keep the server running:
```bash
sudo npm install -g pm2
pm2 start server.js --name canvass
pm2 startup
pm2 save
```

PM2 will now keep your server running and restart it automatically if it
crashes or if the server reboots.

### 10. Set up a reverse proxy with HTTPS

For production use, you should run the app behind a reverse proxy with HTTPS.
Nginx and Certbot are the standard tools for this.

Install Nginx:
```bash
sudo apt install nginx
```

Create a configuration file:
```bash
sudo nano /etc/nginx/sites-available/canvass
```

Paste the following, replacing `yourdomain.com` with your domain:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration:
```bash
sudo ln -s /etc/nginx/sites-available/canvass /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Install Certbot for free HTTPS certificates:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically configure HTTPS and renew certificates.

### 11. Update your ALLOWED_ORIGIN

Now that you have a domain and HTTPS, update your `.env` file:
```
ALLOWED_ORIGIN=https://yourdomain.com
```

Restart the app:
```bash
pm2 restart canvass
```

---

## Setting Up Teams

Teams are managed by the administrator by editing `teams.json` directly on
the server. This is intentional — it prevents unauthorised users from creating
teams and accessing campaign data.

### Adding a team

Open `teams.json` on your server:
```bash
nano teams.json
```

Add a new entry to the array:
```json
[
    { "name": "Your Team Name", "code": "your-secret-code" }
]
```

Restart the server for the changes to take effect:
```bash
pm2 restart canvass
```

### Choosing good team codes

- Use at least 12 characters
- Mix letters, numbers and symbols
- Never reuse codes between teams
- Change codes immediately if a team member leaves

### Removing a team

Remove the team's entry from `teams.json` and delete their visit data file:
```bash
rm visits_TeamName.json
```

Restart the server.

---

## GDPR Considerations

This software is designed with GDPR compliance in mind, but the administrator
is responsible for ensuring their deployment meets all applicable requirements.

### What data is collected

- **Visit logs** — street address, date, visit type (door knock or leaflet
  drop), and whether anyone answered. No names or personal details about
  contacted individuals are collected by default.
- **No voter profiling** — the software does not collect political opinions,
  sentiment, or any other special category data about individuals contacted
  during canvassing.

### Your responsibilities as a data controller

If you deploy this software for a campaign team, you are the data controller
under GDPR. Your responsibilities include:

1. **Legal basis** — ensure you have a lawful basis for processing visit data.
   For campaign canvassing, legitimate interest is the most likely basis.
2. **Data minimisation** — only collect what you genuinely need. The default
   configuration collects the minimum necessary for campaign coordination.
3. **Retention limits** — delete visit data when it is no longer needed,
   typically after the campaign ends.
4. **Security** — keep your server and software up to date. Use HTTPS in
   production. Choose strong team codes.
5. **Right to erasure** — if an individual requests deletion of data related
   to them, you must be able to comply. Visit logs can be deleted directly
   from the server.

### Hosting location

For campaigns operating within the EU, hosting on EU-based servers is strongly
recommended. This ensures your data remains subject to GDPR and does not cross
into jurisdictions with weaker data protection laws. Hetzner (Germany/Finland)
and UpCloud (Finland) are good options, but any reputable EU-based provider
will work.

---

## Updating the Software

To update to the latest version:
```bash
cd canvass-app
git pull
npm install
pm2 restart canvass
```

---

## Contributing

Contributions are welcome. This project is licensed under AGPL-3.0, which
means any modifications you distribute must be made available under the
same license.

To contribute:
1. Fork the repository
2. Make your changes
3. Submit a pull request

---

## Support

This software is provided as-is with no warranty. If you need help setting
up or hosting the app, feel free to open an issue on GitHub.

---

## License

Copyright (c) 2025 SalusPublica

Licensed under the GNU Affero General Public License v3.0.
See [LICENSE](LICENSE) for details.