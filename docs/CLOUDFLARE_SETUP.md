# Cloudflare Pages Setup Guide for haooga.com

This guide replaces the previous Vercel deployment. Cloudflare Pages is free, globally distributed, and auto-deploys on every push to `master`.

---

## Prerequisites

- Cloudflare account (free): https://dash.cloudflare.com/sign-up
- Access to your domain registrar (where haooga.com is registered)
- Supabase project URL and anon key (same values used locally)

---

## Step 1: Add haooga.com to Cloudflare

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Add a Site** → enter `haooga.com` → select the **Free plan**
3. Cloudflare will scan your existing DNS records — review and confirm them
4. Note the two **Cloudflare nameservers** shown (e.g. `alice.ns.cloudflare.com`, `bob.ns.cloudflare.com`)

---

## Step 2: Update Nameservers at Your Registrar

1. Log in to your domain registrar (where haooga.com is registered)
2. Find the **Nameservers** or **DNS** settings for haooga.com
3. Replace the existing nameservers with the two Cloudflare nameservers from Step 1
4. Save — propagation typically takes a few minutes to a few hours

---

## Step 3: Create a Cloudflare Pages Project

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Pages** → **Create a project**
2. Select **Connect to Git** → authorize GitHub → choose the `maorgalkin/Ooga` repository
3. Set the build configuration:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: *(leave empty)*
4. Under **Environment variables**, add:

   | Variable              | Value                                        |
   |-----------------------|----------------------------------------------|
   | `VITE_SUPABASE_URL`   | Your Supabase project URL                    |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (public, safe to expose) |
   | `VITE_SITE_URL`       | `https://haooga.com`                         |

5. Click **Save and Deploy** — the first build will run automatically

---

## Step 4: Add the Custom Domain

1. After the first successful deploy, go to the Pages project → **Custom domains** → **Set up a custom domain**
2. Enter `haooga.com` → confirm the CNAME record that Cloudflare adds to your DNS
3. Repeat for `www.haooga.com` if you want the www subdomain to work too
4. Cloudflare automatically provisions a free TLS certificate (HTTPS enforced)

---

## Step 5: Apply Pending Database Migrations

Run these in your Supabase project's **SQL Editor** (Dashboard → SQL Editor → New query):

1. `supabase/migrations/029_add_bank_card_last4.sql`
2. `supabase/migrations/030_bank_connections_metadata.sql`
3. `supabase/migrations/031_bank_import_sessions_client_rls.sql`
4. `supabase/migrations/032_bank_connections_client_rls.sql` ← **Required for this deploy**

> **Note**: Migrations 029–031 may already be applied (check your migration history). Migration 032 is new and **must** be applied for bank connection management to work.

---

## Step 6: Update Supabase Auth Settings

In the Supabase dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://haooga.com`
- **Redirect URLs**: Add `https://haooga.com/**` and `https://www.haooga.com/**`

This ensures email verification links and OAuth redirects go to the right place.

---

## How Auto-Deploy Works

Every push to the `master` branch triggers a new Cloudflare Pages build:
1. Cloudflare pulls the latest code from GitHub
2. Runs `npm run build` (Vite, ~30–60 seconds)
3. Deploys the `dist/` output globally

No manual steps needed after initial setup.

---

## Environment Variables

Only two variables are required in production:

| Variable              | Required | Notes                                          |
|-----------------------|----------|------------------------------------------------|
| `VITE_SUPABASE_URL`   | ✅        | Your Supabase project URL                      |
| `VITE_SUPABASE_ANON_KEY` | ✅     | Public anon key; RLS enforces access control   |
| `VITE_SITE_URL`       | Optional | Set to `https://haooga.com` for email links    |

The following variables from the old Vercel setup are **no longer needed** and should not be set:
- ~~`SUPABASE_SERVICE_ROLE_KEY`~~ — no server-side code
- ~~`ENCRYPTION_KEY`~~ — no server-side encryption
- ~~`VITE_SCRAPER_SERVICE_URL`~~ — relay removed
- ~~`VITE_SCRAPER_API_KEY`~~ — relay removed

---

## Cost Summary

| Service            | Cost         |
|--------------------|--------------|
| Cloudflare Pages   | **Free**     |
| Cloudflare DNS     | **Free**     |
| Cloudflare TLS     | **Free**     |
| Supabase           | **Free** (free tier) |
| haooga.com domain  | Pre-paid     |

Total monthly cost: **$0**
