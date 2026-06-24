# Launchly

**Self-hosted PaaS — deploy apps from GitHub repos with one click.**

Lauchly is a lightweight deployment engine inspired by Vercel, Netlify, and Railway. It authenticates users via GitHub OAuth, clones repositories, builds Docker images from framework-specific templates, runs containers on free ports, and maps custom subdomains via a reverse proxy — all through an async job queue.

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────────────────────┐     ┌─────────────┐
│  Browser     │────>│  Express Server (:3000)       │────>│  GitHub API │
│  (React SPA) │     │  ├─ Auth (OAuth)              │     └─────────────┘
└──────────────┘     │  ├─ GitHub API proxy          │
                     │  ├─ Deployment API             │     ┌─────────────┐
                     │  └─ Reverse Proxy (*.doamin)   │────>│  Docker     │
                     └──────────────────────────────┘     │  Containers │
                                      │                    └─────────────┘
                                      │
                            ┌─────────▼──────────┐
                            │  BullMQ (Redis)     │
                            │  Queue + Worker     │
                            │  clone → build → run│
                            └────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                                                            |
| ------------ | --------------------------------------------------------------------- |
| **Runtime**  | [Bun](https://bun.sh) (TypeScript backend)                           |
| **Backend**  | Express 5, TypeScript                                                 |
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, React Router 7                     |
| **Database** | PostgreSQL via [Prisma](https://prisma.io) ORM (Supabase)             |
| **Queue**    | [BullMQ](https://bullmq.io) backed by Redis                          |
| **Auth**     | GitHub OAuth (httpOnly cookie sessions)                               |
| **Proxy**    | `http-proxy` — reverse-proxies `*.domain` to Docker containers        |
| **Docker**   | Framework-specific Dockerfile templates → build → run                |
| **Logging**  | Pino + pino-pretty                                                    |

---

## Features

- **GitHub OAuth login** — authenticate with your GitHub account
- **Repo browser** — list and select repositories from your GitHub account
- **Multi-framework templates** — Next.js, React, Vite, Express, Python, or custom
- **Async deployment pipeline** — BullMQ worker clones, builds, and runs containers
- **Automatic port allocation** — each container gets a free port
- **Subdomain routing** — `{project}.launchly.software` routes to the correct container
- **WebSocket proxy support** — for real-time apps
- **Domain persistence** — mappings survive server restarts via `domain-map.json`
- **Job status API** — poll deployment progress in real time

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.6
- [Docker](https://docker.com) daemon
- [Redis](https://redis.io) server
- PostgreSQL database (e.g., [Supabase](https://supabase.com))
- GitHub OAuth App ([register here](https://github.com/settings/developers))
- Wildcard DNS record for `*.yourdomain.com` pointed at your server

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/yourusername/launchly.git
cd launchly
bun install
```

### 2. Configure environment

Copy `.env` and fill in the values:

```env
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/launchly

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Domain (used for subdomain routing)
ROOT_DOMAIN=launchly.software
```

### 3. Set up the database

```bash
bunx prisma generate
bunx prisma db push
```

### 4. Start Redis

```bash
redis-server
```

### 5. Run the project

Start the backend:

```bash
bun run dev
```

Start the worker (in a separate terminal):

```bash
bun run worker
```

Start the frontend dev server:

```bash
cd frontend
bun install
bun run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
launchly/
├── app.ts                        # Express app + reverse proxy middleware
├── server.ts                     # Entry point (starts Express)
├── worker.ts                     # BullMQ worker entry point
├── prisma.config.ts              # Prisma client config
│
├── config/
│   ├── env.ts                    # Zod-validated environment schema
│   ├── logger.ts                 # Pino logger setup
│   └── redis.ts                  # Redis connection (ioredis)
│
├── routes/
│   ├── auth.route.ts             # /auth/github/* endpoints
│   ├── github.routes.ts          # /api/github/* endpoints
│   └── deployment.routes.ts      # /api/deployment/* endpoints
│
├── controllers/
│   ├── auth.controller.ts        # OAuth login/callback/logout logic
│   ├── github.controller.ts      # Proxies requests to GitHub API
│   └── deployment.controller.ts  # Queue deployment jobs, return status
│
├── queue/
│   ├── deployQueue.ts            # BullMQ queue definition (3 retries)
│   └── worker.ts                 # Job processor: clone → build → run → map
│
├── utils/
│   ├── docker.ts                 # Generates Dockerfile from templates
│   ├── domainStore.ts            # Reads/writes domain-map.json
│   ├── port.ts                   # Finds a free TCP port
│   └── db.ts                     # (WIP) Database utility
│
├── templates/
│   ├── express/Dockerfile        # Node 18 Alpine
│   ├── nextjs/Dockerfile         # Next.js build & start
│   ├── react/Dockerfile          # CRA-style build + serve
│   ├── vite/Dockerfile           # Vite build + serve dist
│   ├── python/Dockerfile         # Python 3.9 slim
│   └── badgateway.html           # Custom 502 Bad Gateway
│
├── prisma/
│   └── schema.prisma             # User, Project, Deployment, Domain models
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Router (/, /dashboard, /deploy)
│   │   ├── main.jsx              # Entry point with AuthProvider
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # GitHub auth state management
│   │   │   └── ProtectedRoute.jsx # Auth guard
│   │   ├── components/
│   │   │   └── Navbar.jsx        # Top navigation bar
│   │   └── pages/
│   │       ├── Home.jsx          # Landing page
│   │       ├── Dashboard.jsx     # GitHub repo browser
│   │       └── Deploy.jsx        # Deployment config form
│   └── ...config files           # Vite, Tailwind, ESLint, etc.
│
└── domain-map.json               # Persistent domain → port mappings
```

---

## API Reference

### Authentication

| Method | Endpoint                  | Description                        |
| ------ | ------------------------- | ---------------------------------- |
| GET    | `/auth/github/login`      | Redirect to GitHub OAuth           |
| GET    | `/auth/github/callback`   | OAuth callback, sets session       |
| POST   | `/auth/logout`            | Clears auth cookie                 |

### GitHub (authenticated)

| Method | Endpoint              | Description                |
| ------ | --------------------- | -------------------------- |
| GET    | `/api/github/user`    | Current GitHub user info   |
| GET    | `/api/github/repos`   | List user's repositories   |

### Deployments

| Method | Endpoint                          | Description                              |
| ------ | --------------------------------- | ---------------------------------------- |
| POST   | `/api/deployment/create`          | Enqueue a deployment (returns `jobId`)   |
| GET    | `/api/deployment/status?jobId=X`  | Poll job state / progress / result       |

**POST `/api/deployment/create` body:**

```json
{
  "repoUrl": "https://github.com/user/repo",
  "framework": "vite",
  "subDomain": "my-project",
  "buildCommand": "npm run build",
  "startCommand": "npx serve dist",
  "rootDirectory": ""
}
```

### Reverse Proxy (automatic)

Any request with host matching `{subdomain}.{ROOT_DOMAIN}` is reverse-proxied to the corresponding Docker container. The proxy checks `domain-map.json` for the port mapping.

---

## Deployment Pipeline (Worker)

When a deployment job is created, the worker executes these steps:

1. **Clone** — `git clone <repoUrl>` into `tmp/launchly/{user}/{project}/source`
2. **Generate Dockerfile** — copies the selected framework template and injects user's build/start commands
3. **Build** — `docker build -t launchly-{id}:latest .`
4. **Run** — finds a free port, runs `docker run -d -p {port}:3000 launchly-{id}:latest`
5. **Map** — writes `{subdomain}.{ROOT_DOMAIN}` → `{port}` to `domain-map.json`
6. **Cleanup** — removes cloned source directory (container keeps running)

---

## Database Schema

```
User
  id          String    @id
  email       String?   @unique
  name        String?
  image       String?
  createdAt   DateTime
  updatedAt   DateTime
  projects    Project[]

Project
  id             String      @id
  name           String
  repoUrl        String
  framework      String
  buildCommand   String?
  startCommand   String?
  subDomain      String      @unique
  userId         String
  user           User?
  deployments    Deployment[]
  domains        Domain[]

Deployment
  id          String    @id
  projectId   String
  status      String    (default: "PENDING")
  createdAt   DateTime
  project     Project

Domain
  id          String   @id
  domain      String
  projectId   String
  project     Project
```

---

## Framework Templates

Docker images are built from templates in `templates/<framework>/Dockerfile`. Each template supports custom `BUILD_COMMAND` and `START_COMMAND` build args.

| Template   | Base Image         | Default Build        | Default Start                | Exposed Port |
| ---------- | ------------------ | -------------------- | ---------------------------- | ------------ |
| Express    | `node:18-alpine`   | `npm install`        | `npm start`                  | 3000         |
| Next.js    | `node:18-alpine`   | `npm run build`      | `npm start`                  | 3000         |
| React      | `node:18-alpine`   | `npm run build`      | `npx serve -s build -l 3000` | 3000         |
| Vite       | `node:18-alpine`   | `npm run build`      | `npx serve dist -l 3000`     | 3000         |
| Python     | `python:3.9-slim`  | `pip install -r ...` | `python app.py`              | 3000         |

---

## Environment Variables

| Variable             | Required | Description                          |
| -------------------- | -------- | ------------------------------------ |
| `PORT`               | Yes      | Express server port                  |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string         |
| `GITHUB_CLIENT_ID`   | Yes      | GitHub OAuth App client ID           |
| `GITHUB_CLIENT_SECRET` | Yes    | GitHub OAuth App client secret       |
| `GITHUB_CALLBACK_URL` | Yes     | OAuth callback URL                   |
| `REDIS_HOST`         | Yes      | Redis host                           |
| `REDIS_PORT`         | Yes      | Redis port                           |
| `ROOT_DOMAIN`        | Yes      | Base domain for subdomain routing    |
| `COOKIE_SECRET`      | No       | Secret for signing cookies           |
| `NODE_ENV`           | No       | `development` or `production`        |

---

## Security Notes

- **OAuth tokens** are stored in httpOnly cookies (not accessible to JS)
- **Helmet** is used for security headers
- **CORS** is configured for the frontend origin
- Docker containers are **isolated** from each other and the host
- GitHub OAuth client secret and database credentials should be kept confidential; use environment variables or a secrets manager in production

---

## Development

```bash
# Run backend with file watching
bun run dev

# Run worker (separate terminal)
bun run worker

# Run frontend dev server
cd frontend && bun run dev
```

---

## Future Improvements

- [ ] Prisma service layer (replace empty `utils/db.ts`)
- [ ] Database-backed domain mappings (replace JSON file)
- [ ] Deployment logs streaming (SSE or WebSocket)
- [ ] Custom domain support (CNAME verification)
- [ ] Deployment rollback
- [ ] Environment variable management per project
- [ ] Auto-scaling / load balancing
- [ ] CI/CD integration (deploy on push via webhooks)
- [ ] License file and contribution guide

---

## License

MIT
