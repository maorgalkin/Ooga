# Scraper Deployment (Vultr, Tel Aviv)

The import service in `scraper/` logs in to banks that can't be imported from the browser (e.g. Discount Bank). It runs as one Docker container on a Vultr server in Tel Aviv, behind nginx, at `https://api.haooga.com`.

The web app itself is not deployed from here: Cloudflare builds and serves it on every push to `master` (see [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md)).

```
Browser / iPhone
   │ HTTPS
   ├──────────────▶ haooga.com            Cloudflare (static SPA)
   │
   └──────────────▶ api.haooga.com        Cloudflare DNS, DNS-only (grey cloud)
                        │
                    Vultr server, Tel Aviv
                    nginx :443 (Let's Encrypt via certbot)
                        │ http
                    Docker: ooga-scraper on 127.0.0.1:3001
                        │
                    Israeli banks (needs an Israeli IP)  +  Supabase (service role)
```

The server is in Tel Aviv because Israeli banks block non-Israeli IPs, so `PUPPETEER_PROXY` stays empty in production.

---

## Server layout

| What | Where |
|---|---|
| Repo clone (branch `master`) | `/opt/ooga` |
| Secrets (never committed) | `/opt/ooga/scraper/.env.scraper` (template: `scraper/.env.example`) |
| Compose file | `/opt/ooga/docker-compose.prod.yml` (binds `127.0.0.1:3001` only) |
| nginx site | `/etc/nginx/sites-available/ooga-scraper` (from `scraper/nginx.conf`) |
| TLS | certbot, auto-renewed by `certbot.timer` |
| Health check | `https://api.haooga.com/health` → `{"ok":true,"service":"ooga-scraper"}` |

If the server ever drifts from this table, update this file and `.claude/skills/deploy-scraper/SKILL.md` together.

### SSH access

Everything in this repo reaches the server through an SSH alias, so its IP never lands in this public repo. Add this to `~/.ssh/config` on your Mac:

```
Host ooga-scraper
  HostName <server IPv4 from the Vultr dashboard>
  User root
  IdentityFile ~/.ssh/id_ed25519
```

Check it: `ssh ooga-scraper 'docker compose -f /opt/ooga/docker-compose.prod.yml ps'`

---

## Deploy a change

Merge the change to `master` first; the server only ever runs `master`.

**From Claude Code on your Mac:** run `/deploy-scraper`. It checks your local state and the server layout, records the running commit for rollback, pulls, rebuilds, waits for `/health`, and stops if anything looks off.

**By hand:**

```bash
ssh ooga-scraper
cd /opt/ooga
git rev-parse --short HEAD          # note it: this is your rollback point
git checkout master && git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs --tail=30   # ends with "Ooga scraper service running on port 3001"
curl -fsS https://api.haooga.com/health
```

If `up -d --build` fails, the old container keeps serving the previous commit while the clone has moved on: run `git checkout --detach <rollback point>` so the two match again, then investigate.

The first build after a base-image change takes ~3 minutes (it installs Chromium). The image runs Node 22 on Debian bookworm because israeli-bank-scrapers 6.12+ requires Node ≥ 22.22.2. `scraper/.dockerignore` keeps `.env.scraper` and host `node_modules` out of the image.

### Roll back

```bash
ssh ooga-scraper
cd /opt/ooga
git checkout --detach <previous commit>
docker compose -f docker-compose.prod.yml up -d --build
curl -fsS https://api.haooga.com/health
```

The next deploy (`git checkout master && git pull --ff-only`) returns the clone to `master`.

### This change: Cal sign-in through the service, imports in the holding area

Deploy the scraper **before** merging the app change, so the app never meets an older service. The server normally runs `master`, so build the branch there first:

1. **Scraper first,** from the PR's branch:
   ```bash
   ssh ooga-scraper
   cd /opt/ooga
   git rev-parse --short HEAD                       # rollback point
   git fetch origin feat/scraper-holding-area-cal-id
   git checkout --detach origin/feat/scraper-holding-area-cal-id
   docker compose -f docker-compose.prod.yml up -d --build
   curl -fsS https://api.haooga.com/health
   ```
2. **Then merge the app** (the PR). The next `/deploy-scraper` returns the server to `master`, which then holds the same code.

Merging first is safe too: the app keeps today's Discount review with an older service, and when adding a Cal account it falls back to the old way if the service doesn't confirm it holds the ID. But scraper first means no Cal account is ever added the old way.

   If `api.haooga.com` is proxied by Cloudflare (orange cloud), nginx sees Cloudflare's addresses, not people's: either set the record to DNS only, or add `set_real_ip_from` lines for Cloudflare's ranges plus `real_ip_header CF-Connecting-IP;` to the site file.
3. **nginx (one-off):** the SMS sign-in also gets a per-address limit in nginx. `scraper/nginx.conf` has it, but the live site file was edited by certbot, so add these two parts to `/etc/nginx/sites-available/ooga-scraper` by hand: the `limit_req_zone` line at the top, and the `location /cal/ { … }` block inside **each** `server` block that proxies to the service (the HTTPS one certbot made included). Then `nginx -t && systemctl reload nginx`, and confirm it's live with `sudo nginx -T | grep -n ooga_cal`.

### One-off: move Cal IDs into encrypted storage

Visa Cal connections added before this change keep the cardholder's national ID readable in `bank_connections.metadata`. This moves each into the encrypted column and drops it from `metadata`. **It removes data from `metadata`, so run it only after the steps above (scraper and app both live):**

1. Dry run: it prints how many connections it would move and their connection ids (never an ID number), plus any it leaves alone because they have no household (nobody can import those through the service). It changes nothing:
   ```bash
   ssh ooga-scraper
   cd /opt/ooga
   docker compose -f docker-compose.prod.yml exec scraper node dist/scripts/migrate-cal-ids.js
   ```
2. If the count and ids look right, move them:
   ```bash
   docker compose -f docker-compose.prod.yml exec scraper node dist/scripts/migrate-cal-ids.js --apply
   ```
3. Check, in the Supabase SQL editor. The first should be 0; the second lists any left because they have no household:
   ```sql
   select count(*) from bank_connections where provider = 'visaCalFast' and household_id is not null and metadata ? 'id';
   select id, user_id, created_at from bank_connections where provider = 'visaCalFast' and household_id is null and metadata ? 'id';
   ```
4. Import from a Cal account once: the SMS should arrive as before.
5. **A few days later, run the dry run again.** A browser still open on the old app could add a Cal account the old way meanwhile; the run would show it, and `--apply` moves it.

Running it again changes nothing more. There's no undo into `metadata`: the ID lives in `credentials_encrypted`, which only the service can read. An app older than this change would ask to reconnect a moved account.

---

## Operations

```bash
# Logs
ssh ooga-scraper 'docker compose -f /opt/ooga/docker-compose.prod.yml logs -f --tail=100'

# Restart without rebuilding (keeps the old environment)
ssh ooga-scraper 'cd /opt/ooga && docker compose -f docker-compose.prod.yml restart'

# After editing scraper/.env.scraper: recreate the container (restart doesn't re-read it)
ssh ooga-scraper 'cd /opt/ooga && docker compose -f docker-compose.prod.yml up -d'

# Reclaim disk from old images and build cache (each rebuild leaves some behind)
ssh ooga-scraper 'docker image prune -f && docker builder prune -f'

# Certificate renewal still works
ssh ooga-scraper 'certbot renew --dry-run'
```

Rotating `ENCRYPTION_KEY` makes the bank credentials the scraper has stored unreadable: those accounts must be re-added. Rotate it only on purpose.

---

## First-time server setup (reference)

Only needed when rebuilding the server from scratch.

1. **Server:** Vultr → Deploy → Cloud Compute, location **Tel Aviv**, image Ubuntu LTS, x86, ≥ 2 GB RAM, with your SSH key. Add the `ooga-scraper` alias above.
2. **DNS:** Cloudflare → `haooga.com` → DNS → add an `A` record `api` → the server IP, **DNS only** (grey cloud). The orange proxy breaks certbot's HTTP challenge.
3. **Packages:**
   ```bash
   curl -fsSL https://get.docker.com | sh && systemctl enable docker
   apt update && apt install -y nginx certbot python3-certbot-nginx && systemctl enable nginx
   ```
4. **Code and secrets:**
   ```bash
   git clone https://github.com/maorgalkin/Ooga.git /opt/ooga
   cp /opt/ooga/scraper/.env.example /opt/ooga/scraper/.env.scraper
   nano /opt/ooga/scraper/.env.scraper   # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY (openssl rand -hex 32)
   ```
   Leave `SCRAPER_API_KEY` empty: every route validates the caller's Supabase JWT, and a `VITE_*` key would be public anyway.
5. **Start:** `cd /opt/ooga && docker compose -f docker-compose.prod.yml up -d --build`, then `curl http://localhost:3001/health`.
6. **nginx:**
   ```bash
   cp /opt/ooga/scraper/nginx.conf /etc/nginx/sites-available/ooga-scraper
   rm -f /etc/nginx/sites-enabled/default
   ln -s /etc/nginx/sites-available/ooga-scraper /etc/nginx/sites-enabled/ooga-scraper
   nginx -t && systemctl reload nginx
   ```
7. **TLS:** `certbot --nginx -d api.haooga.com` (retry on a transient SERVFAIL), then `systemctl enable --now certbot.timer`.
8. **Check:** `curl https://api.haooga.com/health` from your Mac, then import from a connected account in the app.

---

## Local development

```bash
docker compose up --build    # docker-compose.yml: dev settings, port 3001 exposed directly
npm run dev                  # in another terminal
```

Put `VITE_SCRAPER_URL=http://localhost:3001` in `.env.local` so the web app uses the local service (it defaults to `https://api.haooga.com`), and keep the scraper's secrets in `scraper/.env.scraper`. From outside Israel, banks may refuse a local scraper; set `PUPPETEER_PROXY` to an Israeli exit if you need one.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Container exits right away | Missing or placeholder value in `.env.scraper` | `docker compose -f docker-compose.prod.yml logs --tail=50`, fix the variable it names, then `up -d` |
| `ENCRYPTION_KEY must be exactly 64 hex characters` | Wrong key format | `openssl rand -hex 32` (but see the rotation warning above) |
| `/health` works on the server but not via `https://api.haooga.com` | nginx or TLS | `nginx -t`, `systemctl status nginx`, `certbot certificates` |
| Browser shows a CORS error | Calling origin not allowed | Defaults allow haooga.com, www.haooga.com and localhost:5173; set `ALLOWED_ORIGINS` in `.env.scraper` for others, then `up -d` |
| Bank login fails for every user | Bank changed its login flow | Check for a newer `israeli-bank-scrapers`, upgrade in `scraper/package.json`, deploy |
| Disk full | Old images and build cache | `docker image prune -f && docker builder prune -f` |
