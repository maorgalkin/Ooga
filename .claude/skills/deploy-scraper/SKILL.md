---
name: deploy-scraper
description: Deploy the bank scraper (scraper/) from master to the Vultr server in Tel Aviv over the ooga-scraper SSH alias — preflight, pull, rebuild, health check, rollback on failure. Only the user starts this.
disable-model-invocation: true
allowed-tools: Bash(git fetch *), Bash(git status *), Bash(git rev-parse *), Bash(gh run list *), Bash(curl -fsS https://api.haooga.com/health)
---

# Deploy the scraper

Production layout (`docs/SCRAPER_DEPLOY.md`): repo at `/opt/ooga` on branch `master`, secrets in `/opt/ooga/scraper/.env.scraper`, `docker-compose.prod.yml`, nginx + certbot in front, health at `https://api.haooga.com/health`. The server is reached only as `ooga-scraper` (an SSH alias in the user's `~/.ssh/config`); never put its IP in a file.

Stop and report at the first check that fails. Don't "fix" the server by hand: describe what's off and let the user decide. Never report a deploy as done unless step 6 passes.

## 1. Can we reach it?

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 ooga-scraper true
```

If this fails, stop. Either this session isn't on the user's Mac (cloud sessions can't reach the server), or the alias is missing: point the user to "SSH access" in `docs/SCRAPER_DEPLOY.md`.

## 2. What will be deployed, and did CI pass for it?

```bash
git fetch origin master
git rev-parse origin/master
git log -1 --format=%H origin/master -- scraper docker-compose.prod.yml     # last commit that changed the scraper
gh run list --branch master --workflow ci.yml --limit 5 --json headSha,status,conclusion
gh run list --branch master --workflow scraper-image.yml --limit 5 --json headSha,status,conclusion
```

- Only `origin/master` is ever deployed. If the user's scraper change isn't merged yet, stop and say so.
- `ci.yml` must have a successful run whose `headSha` is `origin/master`. `scraper-image.yml` must have a successful run for the last commit that changed the scraper (it only runs when the scraper changes). If a run is missing, still in progress or failed, stop and show it; continue only if the user explicitly says so.
- If `gh` isn't available or can't see the repo, say you couldn't check CI and ask whether to continue.

## 3. Server preflight (read-only)

```bash
ssh ooga-scraper 'set -e
  cd /opt/ooga
  test -f docker-compose.prod.yml && test -f scraper/.env.scraper
  echo "branch: $(git rev-parse --abbrev-ref HEAD)"
  echo "running: $(git rev-parse --short HEAD)"
  echo "dirty: $(git status --porcelain | wc -l)"
  echo "image: $(docker inspect --format "{{.Image}}" $(docker compose -f docker-compose.prod.yml ps -q scraper))"
  docker compose -f docker-compose.prod.yml ps --format "{{.Service}} {{.State}} {{.Status}}"
  df -h / | tail -1'
```

Stop if: the files are missing, the branch isn't `master` (a detached HEAD left by an earlier rollback is fine; say so), the tree is dirty, or the disk is over ~85% full (suggest `docker image prune -f && docker builder prune -f`).

Remember `running` (the rollback point) and `image` (to prove the container changes).

## 4. Show the plan and get a go-ahead

List the scraper commits between `<running>` and `origin/master` (`git log --oneline <running>..origin/master -- scraper docker-compose.prod.yml`). Tell the user: from `<running>` to `origin/master`, those commits (or "no scraper changes; this only rebuilds"), whether the Dockerfile or base image changed (the first build after that takes ~3 minutes), and the rollback point. Ask once for a go-ahead before changing anything.

## 5. Deploy

```bash
ssh ooga-scraper 'set -e
  cd /opt/ooga
  git checkout master
  git pull --ff-only
  docker compose -f docker-compose.prod.yml up -d --build'
```

Allow up to 10 minutes. If this exits non-zero, the deploy failed, and the old container is probably still serving `<running>` while the clone has moved on. Stop, show the error, and put the clone back where the container is (no rebuild needed):

```bash
ssh ooga-scraper 'cd /opt/ooga && git checkout --detach <running>'
```

Then confirm `/health` still answers and tell the user nothing was deployed. If `git pull --ff-only` was what refused, the server's `master` has diverged and needs a human look.

## 6. Verify

```bash
for i in $(seq 1 30); do curl -fsS https://api.haooga.com/health && break; sleep 2; done
ssh ooga-scraper 'cd /opt/ooga
  echo "image: $(docker inspect --format "{{.Image}}" $(docker compose -f docker-compose.prod.yml ps -q scraper))"
  docker compose -f docker-compose.prod.yml ps --format "{{.Service}} {{.State}} {{.Status}}"
  docker compose -f docker-compose.prod.yml exec -T scraper node --version
  docker compose -f docker-compose.prod.yml logs --tail=40 scraper'
```

Healthy means all of:

- `/health` returns `{"ok":true,"service":"ooga-scraper"}`;
- if any scraper files changed, `image` differs from the one recorded in step 3 and the status shows a fresh `Up` time;
- `node --version` is v22.x;
- the log shows `Ooga scraper service running on port 3001` with no errors after it.

Report the deployed commit, the Node version and the health result.

## 7. If it isn't healthy

Show the log lines that explain it. Offer to roll back, and wait for the user's go-ahead:

```bash
ssh ooga-scraper 'set -e
  cd /opt/ooga
  git checkout --detach <running>
  docker compose -f docker-compose.prod.yml up -d --build'
```

Then repeat step 6 against `<running>`. Tell the user the server now runs a detached `<running>`; the next deploy returns it to `master`.
