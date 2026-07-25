# Connect RunArena to Supabase (go live)

Without this, RunArena runs fully on your browser (localStorage) — no account,
works offline. Connect Supabase to get **real accounts, cross-device sync, and
multiplayer leaderboards**. ~10 minutes.

## 1. Create a project
- Sign up at https://supabase.com and create a new project (free tier is fine).
- Wait for it to provision.

## 2. Create the database
- In the dashboard: **SQL Editor → New query**.
- Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
- This creates the tables, security rules (RLS), the anti-cheat trigger, and
  turns on realtime.

## 3. Enable anonymous sign-in
- **Authentication → Providers → Anonymous** → enable.
- (Optional) enable **Email** too if you want people to claim their account /
  sync across devices via a magic link.

## 4. Add your keys to the app
- **Project Settings → API**, copy the **Project URL** and the **anon public** key.
- Put them in [`src/config.js`](src/config.js):

```js
export const SUPABASE = {
  url: 'https://YOURPROJECT.supabase.co',
  anonKey: 'eyJhbGciOi...forever...long',
};
```

The anon key is a **public** client key — safe to ship in the frontend; RLS is
what protects the data. Prefer not to edit the file? Set
`window.RUNARENA_CONFIG = { supabase: { url, anonKey } }` before the app loads.

## 5. Run
```bash
python -m http.server 5173
```
Open http://localhost:5173/ . On first run each device signs in anonymously and
creates a profile when you enter your name. Your points/results/streak/favorites
now sync to the cloud, and opening a route shows the **real** leaderboard of
everyone who has run it (seed competitors fill in until real data exists).

## How it works
- **Local-first**: the UI always reads/writes localStorage instantly; the cloud
  syncs in the background (`src/state/persistence.js` `SyncManager`). If the
  network or config is missing, nothing breaks — it just stays local.
- **Auth**: anonymous by default (frictionless, like the name-only demo) with an
  optional email upgrade to link an account across devices.
- **Security**: row-level security lets anyone read leaderboard names/times but
  only the owner writes their own rows. A Postgres trigger rejects impossible
  times/paces before they can pollute a leaderboard.

## Not included yet (next steps)
- Full GPS-trace validation as an Edge Function (the trigger is a first pass).
- Realtime leaderboard **push** (the table is published; the client currently
  refetches on open — wiring the live subscription is a small follow-up).
- Email/OAuth account-linking UI.
