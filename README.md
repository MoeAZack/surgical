# Surgical Case Tracker

A full-stack tracker for surgical procedures, patient checklists, drain tracking,
complications registry, and follow-up milestones. React 19 + Vite frontend served
by an Express API backed by a JSON document store.

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev        # dev server with Vite middleware on http://localhost:3000
```

The data store lives at `db.json` in the working directory by default. Override the
location with the `DB_PATH` environment variable.

## Production build & run

```bash
npm run build      # bundles the client (dist/) and the server (dist/server.cjs)
npm start          # NODE_ENV=production node dist/server.cjs
```

## Configuration

| Variable   | Purpose                                                         | Default     |
| ---------- | -------------------------------------------------------------- | ----------- |
| `PORT`     | Port the server listens on                                     | `3000`      |
| `DB_PATH`  | Absolute path to the JSON data file                            | `./db.json` |
| `NODE_ENV` | `production` serves the built `dist/`; otherwise Vite dev mode | —           |

## Deployment (Google Cloud Run)

The included `Dockerfile` builds a production image. On Cloud Run the data file is
kept on a mounted Cloud Storage volume so it survives restarts and redeploys — set
`DB_PATH` to a path inside the mounted volume (e.g. `/data/db.json`).
