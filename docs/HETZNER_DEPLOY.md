# Hetzner VPS Deployment Guide

**Goal:** Get the Ooga scraper running at `https://api.haooga.com` so the
production Vercel app can reach it from any device (Mac, iPhone, anywhere).

**What you have:**
- Domain: `haooga.com` (GoDaddy)
- Hetzner account (paid, no server yet)
- Repo: `github.com/maorgalkin/Ooga` (public)

**What we're building:**
```
Your browser / iPhone
       │  HTTPS
       ▼
Vercel (galfin.vercel.app)  ──HTTPS──▶  api.haooga.com (Hetzner)
                                              │
                                         nginx (port 443)
                                              │
                                         Docker scraper (port 3001)
                                              │
                                         Supabase (your data)
```

---

## Step 1 — Move DNS to Cloudflare (free, takes 10 min)

**Why Cloudflare instead of GoDaddy DNS?**
GoDaddy DNS can take hours to propagate changes. Cloudflare propagates in
seconds. It's also a much better interface and adds free DDoS protection.
You keep the domain at GoDaddy (they're still the registrar) — you just tell
GoDaddy "use Cloudflare's nameservers instead of mine."

### 1a. Add your site to Cloudflare

1. Go to [cloudflare.com](https://cloudflare.com) → **Sign up** (free account)
2. Click **Add a site** → enter `haooga.com` → click **Continue**
3. Select the **Free** plan → **Continue**
4. Cloudflare will scan your existing GoDaddy DNS records. You'll see a list.
   - Keep whatever records exist (or delete all — for a fresh domain there's nothing important)
   - Click **Continue**
5. Cloudflare gives you **two nameservers**, like:
   ```
   kai.ns.cloudflare.com
   vada.ns.cloudflare.com
   ```
   **Copy these — you need them in the next step.**

### 1b. Update nameservers in GoDaddy

1. Go to [godaddy.com](https://godaddy.com) → **My Products** → find `haooga.com` → click **DNS**
2. Scroll down to **Nameservers** section → click **Change**
3. Select **Enter my own nameservers (advanced)**
4. Delete the existing GoDaddy nameservers, enter the two Cloudflare ones
5. Click **Save** → confirm

**Propagation:** GoDaddy says "up to 48 hours" but it usually activates within
1–2 hours. Cloudflare will email you when it's active.

> You can continue with Steps 2–4 while waiting. DNS only needs to be live by Step 6.

---

## Step 2 — Create the Hetzner Server

1. Log in to [console.hetzner.cloud](https://console.hetzner.cloud)
2. Click **+ New Project** → name it `ooga` → **Add server**
3. Configure the server:
   - **Location**: `Helsinki` (Finland)
   - **Image**: `Ubuntu 24.04` (latest LTS)
   - **Type**: scroll to `Shared vCPU (x86)` → select **`CX23`**
     - 2 AMD vCPU, 2 GB RAM, 40 GB disk
     - x86 architecture — better Puppeteer/Chromium compatibility than ARM
   - **SSH keys**: click **Add SSH key**
     - On your Mac, run: `cat ~/.ssh/id_ed25519.pub` (or `id_rsa.pub`)
     - Paste the output into Hetzner's key field → **Add**
   - **Name**: `ooga-server`
4. Click **Create & Buy now**

You'll get an **IP address** like `49.13.x.x`. Copy it.

### Test SSH access

```bash
ssh root@<your-hetzner-ip>
# You should get a root prompt. Type `exit` to leave.
```

---

## Step 3 — Add DNS Record in Cloudflare

> Do this after Cloudflare confirms the nameserver change is active.

1. In Cloudflare dashboard → click `haooga.com` → **DNS** → **Records**
2. Click **Add record**:
   - **Type**: `A`
   - **Name**: `api`
   - **IPv4 address**: `<your-hetzner-ip>`
   - **Proxy status**: click the orange cloud to turn it **grey** (DNS only)
     - *Why grey?* certbot needs to talk directly to your server for SSL verification.
       The orange (proxied) cloud routes through Cloudflare, which breaks certbot.
   - **TTL**: Auto
3. Click **Save**

This creates `api.haooga.com` → your Hetzner server.

Test that DNS resolves (can take 1–5 min after adding):
```bash
# Run on your Mac
ping api.haooga.com
# Should show your Hetzner IP
```

---

## Step 4 — Set Up the Server

SSH in:
```bash
ssh root@<your-hetzner-ip>
```

### Install Docker

Docker is what runs the scraper in an isolated container:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker    # start Docker automatically on reboot
```

### Install nginx and certbot

nginx is the web server that sits in front of the scraper.
certbot gets and renews your SSL certificate (HTTPS) for free from Let's Encrypt:

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx     # start nginx automatically on reboot
```

---

## Step 5 — Deploy the Scraper Code

Clone the repo onto the server:

```bash
git clone https://github.com/maorgalkin/Ooga.git /opt/ooga
cd /opt/ooga
```

### Create the production environment file

This file contains your secrets. It lives only on the server — never committed to git.

```bash
nano /opt/ooga/scraper/.env.scraper
```

Paste the following, filling in your real values:

```
SUPABASE_URL=https://mlrwvwdcqljzxytzustd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service role key from Supabase dashboard>
ENCRYPTION_KEY=<generate below>
SCRAPER_API_KEY=<generate below>
PORT=3001
NODE_ENV=production
```

**Generate the two secret values** (run these on the server, copy the output):
```bash
openssl rand -hex 32   # use this as ENCRYPTION_KEY
openssl rand -hex 32   # use a different run for SCRAPER_API_KEY
```

> **Where to find `SUPABASE_SERVICE_ROLE_KEY`:**
> Supabase dashboard → your project → Settings → API → `service_role` key (the long one)

Save the file: `Ctrl+O` → Enter → `Ctrl+X`

### Build and start the scraper

```bash
cd /opt/ooga
docker compose -f docker-compose.prod.yml up -d --build
```

This builds the Docker image (installs Node, Chromium — takes ~3 min first time) and starts the container.

**Verify it's running:**
```bash
docker compose -f docker-compose.prod.yml logs -f
# Should end with: "Ooga scraper service running on port 3001"
# Press Ctrl+C to stop watching logs
```

**Test the health endpoint locally:**
```bash
curl http://localhost:3001/health
# Should return: {"ok":true,"service":"ooga-scraper"}
```

---

## Step 6 — Configure nginx

Copy the nginx config from the repo:

```bash
cp /opt/ooga/scraper/nginx.conf /etc/nginx/sites-available/ooga-scraper

# Remove the default placeholder site
rm -f /etc/nginx/sites-enabled/default

# Enable the ooga site
ln -s /etc/nginx/sites-available/ooga-scraper /etc/nginx/sites-enabled/ooga-scraper

# Test the config for syntax errors
nginx -t
# Should print: "syntax is ok" and "test is successful"

# Load the new config
systemctl reload nginx
```

**Test HTTP access** (before SSL):
```bash
curl http://api.haooga.com/health
# Should return: {"ok":true,"service":"ooga-scraper"}
```

> If this fails, DNS hasn't propagated yet. Wait a few minutes and try again.

---

## Step 7 — Get SSL Certificate (HTTPS)

certbot talks to Let's Encrypt, proves you own `api.haooga.com`, gets a
certificate, and automatically updates nginx to use HTTPS:

```bash
certbot --nginx -d api.haooga.com
```

You'll be asked for:
- Your email address (for renewal reminders)
- Agree to terms of service: `A`
- Share email with EFF (optional): `N`

> If fails with SERVFAIL: It happens occasionally. Retrey: certbot --nginx -d api.haooga.com

certbot modifies `/etc/nginx/sites-available/ooga-scraper` automatically to:
- Redirect all HTTP → HTTPS
- Add SSL certificate and key paths
- Enable HTTP/2

**Enable automatic certificate renewal** (certs expire every 90 days):
```bash
systemctl enable certbot.timer
systemctl start certbot.timer

# Test renewal works (dry run — doesn't actually renew)
certbot renew --dry-run
# Should say: "All simulated renewals succeeded"
```

**Test HTTPS:**
```bash
curl https://api.haooga.com/health
# Should return: {"ok":true,"service":"ooga-scraper"}
```

---

## Step 8 — Apply Pending Migrations in Supabase

Your DB needs two new migrations before the import features work.

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Paste and run the contents of `supabase/migrations/025_bank_connections.sql`
3. Paste and run the contents of `supabase/migrations/026_import_session_tracking.sql`

---

## Step 9 — Update Vercel Environment Variables

Tell your frontend where the scraper lives:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your Ooga project
2. **Settings** → **Environment Variables**
3. Add or update these two variables:
   | Variable | Value |
   |----------|-------|
   | `VITE_SCRAPER_SERVICE_URL` | `https://api.haooga.com` |

   > **Do NOT add `VITE_SCRAPER_API_KEY`.** `VITE_*` variables are baked into the
   > public JS bundle and visible to anyone in DevTools. The scraper is protected
   > by Supabase JWT validation on every route — that is the real auth.
   > Leave `SCRAPER_API_KEY` empty in `.env.scraper` on the server.
4. Go to **Deployments** → click the three dots on the latest deployment → **Redeploy**

---

## Step 10 — End-to-End Test

1. Open [galfin.vercel.app](https://galfin.vercel.app) (after redeploy)
2. Go to **Settings → Budget Settings → Connected Accounts**
3. Add your Discount Bank credentials
4. Click **Import from Bank**
5. Watch the progress modal → should transition to the transaction review screen

---

## Ongoing Operations

### View scraper logs
```bash
ssh root@<your-hetzner-ip>
docker compose -f /opt/ooga/docker-compose.prod.yml logs -f --tail=100
```

### Redeploy after a code change
```bash
ssh root@<your-hetzner-ip>
cd /opt/ooga
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Restart the scraper (if stuck)
```bash
ssh root@<your-hetzner-ip>
cd /opt/ooga
docker compose -f docker-compose.prod.yml restart
```

### Add a future app (e.g. game backend) on the same server

1. Deploy it on a different port, e.g. `4000`
2. Create a new nginx config:
   ```bash
   nano /etc/nginx/sites-available/my-game
   ```
   ```nginx
   server {
       listen 80;
       server_name game-api.haooga.com;
       location / {
           proxy_pass http://127.0.0.1:4000;
       }
   }
   ```
3. Enable and get SSL:
   ```bash
   ln -s /etc/nginx/sites-available/my-game /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d game-api.haooga.com
   ```
4. Add DNS A record in Cloudflare: `game-api` → same Hetzner IP

No extra server cost — one machine, many services.

---

## Local Development vs Production — Key Differences

Understanding which environment you're running in matters a lot for debugging.

### Local Development (your Mac)

```
Your browser (localhost:5173)
        │
        ▼
Vite dev server (npm run dev)
        │  http
        ▼
Docker scraper on localhost:3001   (docker-compose.yml)
        │
        ▼
Supabase (cloud)
```

**How to run locally:**
```bash
# 1. Start Docker Desktop (the GUI app)
# 2. In the repo root:
docker-compose up --build      # uses docker-compose.yml (dev settings)
# 3. In another terminal:
npm run dev                    # starts Vite on localhost:5173
```

**Environment file:** `scraper/.env.scraper` (at repo root level)

**Test the scraper locally:**
```bash
curl http://localhost:3001/health
```

**`.env.local`** (frontend, not committed) must contain:
```
VITE_SCRAPER_SERVICE_URL=http://localhost:3001
```

> ⚠️ The local Docker compose (`docker-compose.yml`) exposes port `3001:3001` directly  
> (no nginx). This is fine for local dev — never expose this to the internet.

---

### Production (Hetzner + Vercel)

```
Your browser / iPhone (any device, any network)
        │  HTTPS
        ▼
Vercel (galfin.vercel.app)  ──HTTPS──▶  api.haooga.com (Hetzner)
                                              │
                                         nginx (port 443)   ← SSL terminates here
                                              │  http
                                         Docker scraper (127.0.0.1:3001)
                                              │
                                         Supabase (cloud)
```

**How the production scraper runs:**
- Docker only binds to `127.0.0.1:3001` — not reachable from the internet
- nginx listens on public ports 80/443 and proxies to Docker
- SSL certificate managed by certbot (auto-renews)
- Container restarts automatically on reboot (`restart: always`)

**Environment file:** `/opt/ooga/scraper/.env.scraper` (on the Hetzner server only)

**Test from the server (SSH'd in):**
```bash
curl http://localhost:3001/health           # tests Docker directly
curl https://api.haooga.com/health          # tests full nginx → Docker path
```

**Test from anywhere:**
```bash
curl https://api.haooga.com/health
# Should return: {"ok":true,"service":"ooga-scraper"}
```

**Vercel environment variables** (Settings → Environment Variables):
| Variable | Value |
|----------|-------|
| `VITE_SCRAPER_SERVICE_URL` | `https://api.haooga.com` |

> ⚠️ Do NOT set `VITE_SCRAPER_API_KEY` in Vercel — `VITE_*` variables are baked
> into the public JS bundle and visible to anyone who opens DevTools.

---

## Troubleshooting

### Docker container health check (run on the Hetzner server)

```bash
# Is the container actually running?
docker compose -f docker-compose.prod.yml ps

# What is it saying? (most useful first step)
docker compose -f docker-compose.prod.yml logs --tail=50

# Is something listening on port 3001?
ss -tlnp | grep 3001
```

**Common container failures:**

| Log message | Cause | Fix |
|-------------|-------|-----|
| `ENOTFOUND mlrwvwdcqljzxytzustd.supabase.co` | Wrong Supabase URL in `.env.scraper` | Fix the URL |
| `Error: Missing required env var` | A required variable not set in `.env.scraper` | Add the missing variable |
| `address already in use` | Another process using port 3001 | `kill $(lsof -ti:3001)` then restart |
| Container exits immediately | Crash on startup — check logs | `docker compose logs` |
| `curl: (7) Failed to connect` | Container not running or wrong port | Check `docker compose ps` |

### nginx / domain issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ping api.haooga.com` shows wrong IP | DNS not propagated | Wait 5 min, try again |
| `curl http://api.haooga.com` connection refused | nginx not running | `systemctl start nginx` |
| certbot fails: SERVFAIL | Transient Let's Encrypt DNS glitch | Retry: `certbot --nginx -d api.haooga.com` |
| certbot fails: "Connection refused on port 80" | nginx not running | `systemctl start nginx` |
| `curl https://api.haooga.com/health` fails | SSL not set up yet | Complete Step 7 first |
| Browser shows CORS error | `VITE_SCRAPER_SERVICE_URL` has trailing slash | Remove trailing slash from Vercel env var |

