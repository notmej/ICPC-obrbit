# ICPC ORBIT — local-first competitive programming desktop dashboard

A futuristic dashboard for a full ICPC training journey. React + Tailwind CSS UI, TypeScript/Express API, Electron desktop shell and MySQL 8.4 in Docker.

## Prerequisites

- **Node.js 20.19+ or 22+** and npm
- **Docker Desktop**, running (or Docker Engine with Compose)
- Internet access only for Codeforces syncing, contest refreshes and external course links

## Start (macOS, Windows or Linux)

From the unzipped `icpc-orbit` folder:

```bash
npm install
# Start Docker Desktop first, then:
docker compose up -d
npm run dev
```

The **Electron desktop window** should open automatically. You can also double-click `START-ON-MAC.command` on macOS or `START-ON-WINDOWS.bat` on Windows. Those launchers install dependencies if missing, build the app on first launch, start MySQL, and open the production desktop window (Docker Desktop must be running). You can also use the app in a browser via **http://127.0.0.1:5173** with `npm run dev:browser` after starting MySQL. `npm run dev` starts the desktop shell, API and Vite dev server together.

The first screen asks for your journey **start date**, **end date**, time zone, daily goal, and optional Codeforces handle. The suggested range is January 1–December 31, 2027, but you choose the dates.

### Create an installable desktop app

```bash
npm run package:mac      # macOS .dmg / .zip; build on a Mac
npm run package:win      # Windows NSIS installer; build on Windows
npm run package:linux    # Linux AppImage; build on Linux
```

Generated binaries are in `release/`. Installers are **not precompiled** in the supplied source ZIP. The app still needs Docker Desktop and the MySQL container to run, even after Electron is installed. For a regular user, keep the project folder (for `docker compose up -d`) and the desktop app.

`npm run build` checks TypeScript and produces Vite, API, and Electron output. `npm test` runs business-logic tests.

## What is tracked

- **Month calendar** and full-range **GitHub-style daily heatmap**; click a date to inspect problems, study time and completed lessons
- **Streak:** a day qualifies with >=1 problem, >=1 completed lesson, or >=60 seconds of finished study time. Today's streak is not lost before the day ends.
- **Timer:** start and stop stopwatch sessions; finished sessions are recorded in MySQL. The active timer is persisted during page changes; closing the desktop app finalizes it when possible. After a forced crash or power loss an unfinished session may continue counting until manually stopped, so end your session before breaks.
- **Hours:** recorded focus seconds + manually logged past study minutes. Sessions are attributed to their **start date**; sessions crossing midnight are not automatically split.
- **Problems:** manual log with name, link, difficulty, platform, topic, date, notes, and edit/delete
- **NeetCode curricula:** 35 lessons of **Algorithms & Data Structures for Beginners** and 22 lessons of **Advanced Algorithms**, grouped by the actual public lesson navigation, with direct links and checkboxes
- **Codeforces:** read-only auto-import of public accepted submissions by handle. The importer paginates at most 10,000 recent submissions and stops early when earlier than the journey's start. Re-submits of a previously accepted problem count once. Manual Codeforces entries with recognizable official URLs are also de-duplicated from the activity count.
- **Topic insights:** Codeforces tags are coarsely mapped to topic categories; they **do not** automatically check off course lessons. A problem can cover several topics, and the dashboard uses only its first matched category.
- **Contests:** fetch upcoming Codeforces contests and show a countdown. When the Electron window is running, a local desktop reminder is sent for a contest starting within 30 minutes, once per contest. Alerts are best-effort; no push notifications while the app is closed/offline.
- **Links:** NeetCode, Codeforces, AtCoder.
- **Backups:** export/restore a complete local JSON backup from Settings.

## Codeforces integration

Enter your **public Codeforces handle**, click **Sync Codeforces**, and the application uses the official API `user.status`. No login, password or API key is requested. Importing history takes longer for accounts with many submissions because the Codeforces API restricts call frequency. Contest schedules use `contest.list`.

The app auto-refreshes the upcoming contest cache while running. You may press Sync to update submissions; a background submission sync is also scheduled while the API is active. Codeforces errors, rate limits and outages do not erase local history.

Official documentation: https://codeforces.com/apiHelp and https://codeforces.com/apiHelp/methods

### NeetCode integration limitation

NeetCode doesn't have a verified, supported public API to read private course completion for arbitrary accounts. Orbit therefore stores **local** progress checkboxes and links to the actual lessons. It doesn't scrape a logged-in session, ask for your NeetCode credentials, or falsely claim an account sync. You can separately log NeetCode problems and relate them by topic.

Course outlines checked on 2026-11-22:
- https://neetcode.io/courses/dsa-for-beginners/0
- https://neetcode.io/courses/advanced-algorithms/0

## Persistence and privacy

MySQL binds only to **127.0.0.1:3307** and stores its files in the named Docker volume `orbit_mysql_data`. The API binds **127.0.0.1:4618**. No public servers or accounts are required. Avoid `docker compose down -v` unless you intend to **delete the database**. `docker compose down` preserves it.

For safe backups, use Settings → Export, and keep copies outside the project folder; Docker volumes are not a substitute for backups. Backups include your problem notes and public Codeforces submission details. Import replaces prior manual logs and study sessions (the app asks confirmation first).

The default Docker passwords are meant only for an isolated localhost development installation. To change them, edit both `docker-compose.yml` and your `.env`/environment variables before first initialization. The server reads environment variables; it does not load `.env` automatically, so export variables or use your shell's environment mechanism as needed.

## Project structure

```
src/                React / Tailwind UI
src/lib/            Frontend API and date helpers
server/src/         TypeScript API, MySQL schema, course data, analytics, CF client
desktop/main.ts     Electron desktop main process + native notifications
tests/              Pure logic tests
docker-compose.yml  Local MySQL 8.4 container + persistent volume
```

## Troubleshooting

- **Database unavailable:** ensure Docker Desktop is running and `docker compose ps` reports the `icpc-orbit-mysql` container healthy. The API retries on startup for ~60 seconds.
- **Port already in use:** the API expects 4618; Vite expects 5173; MySQL host port 3307. Stop the conflicting process before retrying.
- **Codeforces reports a limit/error:** wait a little and try again; data stays on disk.
- **Missing contest notification:** app needs to remain running, OS notifications permitted, internet connection, and reminders enabled.
- **On macOS:** unsigned locally built apps may require approval under Privacy & Security; packaging is not notarized.

Designed for C++ competitive programming practice, but works with any language.
