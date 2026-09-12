# MeetMe

A self-hosted video meeting platform — a lightweight Google Meet alternative with waiting rooms, guest hosting, collaborative tools, and host-controlled permissions. Built with **Next.js**, **PostgreSQL**, **Prisma**, and **LiveKit**. Native mobile is planned for a later phase.

---

## Features

| Category | Capabilities |
|----------|--------------|
| **Meetings** | Create instant meetings, share links, guest or registered host |
| **Waiting room** | Host admits or denies participants before they enter |
| **Video & audio** | HD calls via LiveKit WebRTC |
| **Screen sharing** | Host-approved screen share with live highlighter overlay (web) |
| **Collaboration** | Shared whiteboard with admin-assigned editor (web) |
| **Engagement** | Hand raise, participant sidebar, copy meeting link |
| **Permissions** | Host controls recording and screen-share access |
| **Accounts** | Register / login, dashboard, admin panel |
| **Guests** | Join or host without an account |

---

## Tech stack

| Layer | Technology | Role |
|-------|------------|------|
| **Web** | [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript | UI, meeting room, **and REST API** (Route Handlers) |
| **Styling** | Tailwind CSS 4 | Design system and responsive layout |
| **Auth** | jose HS256 JWT (httpOnly cookie) | Sessions |
| **ORM** | [Prisma](https://www.prisma.io/) | PostgreSQL schema and queries |
| **Database** | PostgreSQL 16 | Users, meetings, participants, permissions |
| **Video SDK** | [LiveKit](https://livekit.io/) | WebRTC rooms, tracks, data messages |
| **Infrastructure** | Docker Compose | PostgreSQL and LiveKit (local) |

---

## Architecture

```mermaid
graph TB
    subgraph clients ["Clients"]
        Web["Next.js web app"]
        LKWeb["LiveKit JS"]
        Web --> LKWeb
    end

    subgraph next ["Next.js"]
        UI["Pages"]
        API["Route Handlers /api"]
        Token["LiveKit JWT"]
        UI --> API
        API --> Token
    end

    subgraph data ["Data and realtime"]
        DB[(PostgreSQL)]
        LKS["LiveKit Server"]
    end

    Web -->|"same-origin HTTP"| API
    API --> DB
    Token -->|"JWT"| Web
    LKWeb -->|"WebRTC"| LKS
```

### What Next.js handles

- Landing page, auth screens, user dashboard, admin panel
- REST API: auth, meetings, waiting room, permissions, admin
- Meeting join flow (waiting room UI, session restore after refresh)
- LiveKit room UI: camera, mic, layout, participants
- **Real-time features** synced via LiveKit **data channels** (not API polling):
  - Hand raise
  - Whiteboard strokes and editor assignment
  - Screen-share state
  - Screen-share highlighter (normalized coordinates)
  - Recording permission sync
- Session: httpOnly `meetme_session` cookie

### What the API handles

- User registration, login, admin roles
- Meeting CRUD, unique meeting codes, guest-host tokens
- Waiting room: join requests, admit / deny, participant status
- LiveKit access token generation
- Permission workflows: recording and screen-share request / approve / deny
- Admin API: platform stats, user management, meeting cleanup

Whiteboard, in-browser recording UI, and the share highlighter stay **web-first**.

---

## Meeting workflow

```mermaid
sequenceDiagram
    participant Host
    participant Guest
    participant API as Next.js API
    participant LK as LiveKit

    Host->>API: Create meeting
    API-->>Host: Meeting code and host token
    Host->>API: Join meeting
    API-->>Host: Admitted with LiveKit JWT
    Host->>LK: Connect to room

    Guest->>API: Join meeting
    API-->>Guest: Waiting with admit token
    Host->>API: Admit participant
    Guest->>API: Poll join status
    API-->>Guest: Admitted with LiveKit JWT
    Guest->>LK: Connect to room
```

1. **Host** creates a meeting (registered user or guest with name).
2. **Participants** open `/m/{code}` and request to join.
3. If the waiting room is enabled, the **host admits** them from People.
4. The **API** issues a LiveKit JWT; the **client** connects to the WebRTC room.
5. In-call features (whiteboard, highlighter, hand raise) sync over LiveKit data topics.
6. **Host** can end the meeting for everyone, or participants can leave.

---

## Project structure

```
meetme/
├── frontend/          # Next.js web app + API (port 3000)
│   ├── app/           # Pages and Route Handlers under app/api
│   ├── components/    # UI + meeting-room feature modules
│   ├── lib/server/    # Auth, meetings, LiveKit, Prisma
│   └── prisma/        # Schema and migrations
├── scripts/           # dev.sh, dev-local.ps1
├── docker-compose.yml # PostgreSQL + LiveKit
└── livekit.yaml       # LiveKit server config (reference)
```

---

## Prerequisites

- **Node.js** 20+ and **pnpm**
- **Docker** & Docker Compose (PostgreSQL, LiveKit)
- **Git**

---

## Local development

### 1. Clone and configure

```bash
git clone https://github.com/GhayoorAli/meetme.git
cd meetme
cp frontend/.env.local.example frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=

DATABASE_URL=postgresql://meetme:meetme@127.0.0.1:5432/meet_db?connect_timeout=15
DIRECT_URL=postgresql://meetme:meetme@127.0.0.1:5432/meet_db?connect_timeout=15
AUTH_SECRET=change-me-in-production-use-a-long-random-string
APP_URL=http://localhost:3000

LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

Leave `NEXT_PUBLIC_API_URL` empty so the browser calls `/api` on the same origin. Locally, `DATABASE_URL` and `DIRECT_URL` can be the same Docker URL.

### 2. Start PostgreSQL + LiveKit

```bash
docker compose up -d --remove-orphans
```

On Windows PowerShell:

```powershell
.\scripts\dev-local.ps1
```

| Service | URL / Port |
|---------|------------|
| Next.js (web + API) | http://localhost:3000 |
| PostgreSQL | `127.0.0.1:5432` (`meetme` / `meetme` / `meet_db`) |
| LiveKit | `ws://localhost:7880` |

### 3. Migrate and run the web app

```bash
cd frontend
pnpm install
pnpm db:migrate
pnpm dev
```

Open **http://localhost:3000**. The first registered user becomes an admin.

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | Web | Leave empty for same-origin `/api` |
| `DATABASE_URL` | Web | PostgreSQL URL (Supabase: **transaction pooler**, port 6543) |
| `DIRECT_URL` | Web | PostgreSQL URL for migrations (Supabase: **direct/session**, port 5432) |
| `AUTH_SECRET` | Web | JWT signing secret (16+ characters) |
| `APP_URL` | Web | Public site URL (join links) |
| `LIVEKIT_URL` | Web | WebSocket URL returned to clients |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Web | LiveKit credentials |
| `LIVEKIT_NODE_IP` | Compose | Advertised IP for LAN WebRTC |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Web | Google OAuth web client (see below) |

### Google sign-in

Email/password always works. Google is optional.

1. In [Google Cloud Console](https://console.cloud.google.com/auth/overview) finish **Get started**, then **Clients → Create client → Web application**.
2. Local: origin `http://localhost:3000`, redirect `http://localhost:3000/api/auth/google/callback`.
3. Production: origin `https://www.your-domain.com`, redirect `https://www.your-domain.com/api/auth/google/callback` (add both `www` and apex if both are used).
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `frontend/.env.local` (local) and on Vercel (live). `APP_URL` must match the site people actually open, or Google will show the Vercel hostname.

A Google login with the same Gmail as an existing account is linked to that user.

---

## API overview

Auth login/register return `{ data: User, token }`. The web app stores the JWT in an httpOnly cookie.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register`, `/api/auth/login` | Authentication |
| `GET` | `/api/auth/google` | Start Google OAuth |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/user` | Current user |
| `POST` | `/api/meetings` | Create meeting (auth) |
| `POST` | `/api/meetings/guest` | Create guest-hosted meeting |
| `GET` | `/api/meetings/{code}` | Meeting metadata |
| `POST` | `/api/meetings/{code}/join` | Join or resume session |
| `GET` | `/api/meetings/{code}/join-status` | Poll waiting / restore admitted |
| `POST` | `/api/meetings/{code}/participants/{id}/admit` | Host admit |
| `POST` | `/api/meetings/{code}/end` | End meeting for all |
| `GET` | `/api/admin/*` | Admin dashboard (auth + admin) |

---

## Deployment notes

| Component | Local | Live |
|-----------|--------|------|
| Web + API (`frontend/`) | `pnpm dev` | [Vercel](https://vercel.com) or `frontend/Dockerfile` |
| PostgreSQL | Docker Compose (`5432`) | [Supabase](https://supabase.com) or other managed Postgres |
| LiveKit | Docker Compose (`7880`) | [LiveKit Cloud](https://livekit.io/cloud) |

Vercel hosts the Next.js site and `/api`. Video is LiveKit Cloud.

Use HTTPS and `wss://` LiveKit URLs in production. Set a strong `AUTH_SECRET`. Do not commit database or API secrets.

### Supabase (production database)

MeetMe uses Supabase **only as Postgres**. Do not enable Supabase Auth.

1. Create a project at [supabase.com](https://supabase.com).
2. On the project home, open **Get connected → ORM** (or **Direct**) and copy **two** URIs:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`. Add `?pgbouncer=true` (and `sslmode=require` if missing). URL-encode special characters in the password (`@` → `%40`, `!` → `%21`, `+` → `%2B`, `$` → `%24`).
   - **Session pooler** or **Direct** (port `5432`) → `DIRECT_URL`.
3. From `frontend/`, apply migrations against those URLs (do not leave Docker `127.0.0.1` in the shell when targeting Supabase):

```bash
pnpm db:deploy
```

4. Put the same two variables on Vercel.

### Vercel (web + API)

1. Import the GitHub repo. Set **Root Directory** to `frontend`.
2. Build command:

```text
prisma migrate deploy && prisma generate && next build
```

3. Environment variables (Production and Preview):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Supabase pooler (`6543`) |
| `DIRECT_URL` | Supabase session/direct (`5432`) |
| `AUTH_SECRET` | Random string you generate (32+ characters) |
| `APP_URL` | Public site origin, e.g. `https://www.meet-me.tech` (no trailing slash) |
| `LIVEKIT_URL` | `wss://….livekit.cloud` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit Cloud keys |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional, for Continue with Google |
| `NEXT_PUBLIC_API_URL` | Leave empty (do not reuse old `BACKEND_URL` / `NEXT_PUBLIC_LIVEKIT_URL`) |

4. After the first deploy, register on the live site. The first user is admin.
5. Custom domain: attach it in Vercel, then set `APP_URL` to that origin and add the same origin/callback in Google Cloud.

### LiveKit Cloud

Reuse a LiveKit Cloud project (no Agents). Copy the WebSocket URL (`wss://`) and API key/secret. Do not set `LIVEKIT_NODE_IP` in production — that is only for local Docker.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login / join fails locally | PostgreSQL on **5432**, `pnpm db:migrate`, Next on **3000** |
| `pnpm db:deploy` hits `127.0.0.1` | `.env` still points at Docker; pass the Supabase URLs in the same shell |
| Prisma cannot connect locally | Use `127.0.0.1` not `localhost` if IPv6 hangs; set `DIRECT_URL` as well |
| No video locally | `docker compose ps` — LiveKit on 7880 |
| No video in production | `LIVEKIT_URL` must be `wss://` from LiveKit Cloud; redeploy after env changes |
| Google: “not set up yet” | Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and redeploy; or use email/password |
| Google shows `*.vercel.app` | Set `APP_URL` to the custom domain and open the app on that domain |

---

## License

MIT — add a `LICENSE` file before publishing if you want to open-source the repo.

---

## Author

Built as a personal, self-hosted meeting solution. Contributions and issues welcome.
