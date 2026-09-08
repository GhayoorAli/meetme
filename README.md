# MeetMe

A self-hosted video meeting platform — a lightweight Google Meet alternative with waiting rooms, guest hosting, collaborative tools, and host-controlled permissions. Built with **Next.js**, **PostgreSQL**, **Prisma**, **LiveKit**, and **Expo**.

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
| **Mobile** | Expo app for auth, dashboard, waiting room, and LiveKit calls |

---

## Tech stack

| Layer | Technology | Role |
|-------|------------|------|
| **Web** | [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript | UI, meeting room, **and REST API** (Route Handlers) |
| **Styling** | Tailwind CSS 4 | Design system and responsive layout |
| **Auth** | jose HS256 JWT (httpOnly cookie on web, Bearer on mobile) | Sessions |
| **ORM** | [Prisma](https://www.prisma.io/) | PostgreSQL schema and queries |
| **Database** | PostgreSQL 16 | Users, meetings, participants, permissions |
| **Video SDK** | [LiveKit](https://livekit.io/) | WebRTC rooms, tracks, data messages |
| **Mobile** | Expo (Router) + LiveKit React Native | Native camera/mic meetings |
| **Infrastructure** | Docker Compose | PostgreSQL and LiveKit (local) |

---

## Architecture

```mermaid
graph TB
    subgraph clients ["Clients"]
        Web["Next.js web app"]
        Mobile["Expo app"]
        LKWeb["LiveKit JS"]
        LKMobile["LiveKit React Native"]
        Web --> LKWeb
        Mobile --> LKMobile
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
    Mobile -->|"HTTP + Bearer"| API
    API --> DB
    Token -->|"JWT"| Web
    Token -->|"JWT"| Mobile
    LKWeb -->|"WebRTC"| LKS
    LKMobile -->|"WebRTC"| LKS
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
- Session: httpOnly `meetme_session` cookie on web; JWT in SecureStore on mobile

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
2. **Participants** open `/m/{code}` (or the Expo join screen) and request to join.
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
├── mobile/            # Expo app (same JSON API)
├── scripts/           # dev.sh, dev-local.ps1
├── docker-compose.yml # PostgreSQL + LiveKit
└── livekit.yaml       # LiveKit server config (reference)
```

---

## Prerequisites

- **Node.js** 20+ and **pnpm** (web)
- **Docker** & Docker Compose (PostgreSQL, LiveKit)
- **Git**
- **Expo** toolchain for the mobile app (EAS or a local Android/iOS build — LiveKit does not run in Expo Go)

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

DATABASE_URL=postgresql://meetme:meetme@127.0.0.1:5432/meet_db
AUTH_SECRET=change-me-in-production-use-a-long-random-string
APP_URL=http://localhost:3000

LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

Leave `NEXT_PUBLIC_API_URL` empty so the browser calls `/api` on the same origin.

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

### 4. Mobile (Expo)

```bash
cd mobile
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` to your PC’s LAN address, not `localhost` (that is the phone itself):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

For a physical device, also point LiveKit at the same LAN IP:

- `LIVEKIT_URL=ws://192.168.1.10:7880` in `frontend/.env.local`
- `LIVEKIT_NODE_IP=192.168.1.10` when starting Compose
- Restart Next.js after changing `LIVEKIT_URL`

LiveKit needs a **development build** (not Expo Go):

```bash
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

---

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | Web | Leave empty for same-origin `/api` |
| `DATABASE_URL` | Web | PostgreSQL connection string |
| `AUTH_SECRET` | Web | JWT signing secret (16+ characters) |
| `APP_URL` | Web | Public site URL (join links) |
| `LIVEKIT_URL` | Web | WebSocket URL returned to clients |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Web | LiveKit credentials |
| `LIVEKIT_NODE_IP` | Compose | Advertised IP for mobile/LAN WebRTC |
| `EXPO_PUBLIC_API_URL` | Mobile | Next.js origin, e.g. `http://192.168.1.10:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Web | Google OAuth web client (see below) |
| `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` | Web | Optional native client IDs for Expo ID tokens |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Mobile | Same value as `GOOGLE_CLIENT_ID` |

### Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an **OAuth 2.0 Client ID** of type **Web application**.
2. Authorized JavaScript origin: `http://localhost:3000`
3. Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
4. Put the client ID and secret in `frontend/.env.local`, then restart Next.js.

Email/password still works. A Google login with the same Gmail as an existing account is linked to that user.

For Expo, also create iOS/Android OAuth clients if you sign in on a device, and set `EXPO_PUBLIC_GOOGLE_*` in `mobile/.env`.

---

## API overview

Auth login/register return `{ data: User, token }`. Web stores the JWT in an httpOnly cookie; mobile sends `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register`, `/api/auth/login` | Authentication |
| `GET` | `/api/auth/google` | Start Google OAuth (web) |
| `POST` | `/api/auth/google` | Exchange Google ID token (mobile) |
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
| PostgreSQL | Docker Compose (`5432`) | Managed Postgres |
| LiveKit | Docker Compose (`7880`) | [LiveKit Cloud](https://livekit.io/cloud) |
| Mobile (`mobile/`) | Expo dev client | EAS Build |

Use HTTPS and `wss://` LiveKit URLs in production. Set a strong `AUTH_SECRET`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login / join fails | PostgreSQL on **5432**, `pnpm db:migrate`, Next on **3000** |
| Prisma cannot connect | `DATABASE_URL=postgresql://meetme:meetme@127.0.0.1:5432/meet_db` (not `localhost` if IPv6 hangs) |
| No video | `docker compose ps` — LiveKit on 7880 |
| Phone cannot reach API | Use LAN IP in `EXPO_PUBLIC_API_URL`; allow port 3000 on the firewall |
| Phone has no media | Set `LIVEKIT_URL` and `LIVEKIT_NODE_IP` to the LAN IP, rebuild LiveKit |

---

## License

MIT — add a `LICENSE` file before publishing if you want to open-source the repo.

---

## Author

Built as a personal, self-hosted meeting solution. Contributions and issues welcome.
