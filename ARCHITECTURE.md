# DeployX — System Design & Architecture

## Overview

DeployX is a self-hosted PaaS (Platform-as-a-Service) that lets users deploy web applications directly from GitHub repositories. It acts as a mini-Heroku: users authenticate via GitHub OAuth, select a repo + framework, and DeployX clones the code, builds a Docker image, runs it in a container, and assigns a public subdomain.

---

## 1. High-Level Architecture

```
┌─────────────┐     ┌──────────────────────────────────┐
│   Browser   │────▶│   DeployX Backend (Bun/Express)  │
└─────────────┘     │                                  │
                    │  ┌─────────────────────────┐      │
                    │  │  Reverse Proxy           │─────┐│
                    │  │  (http-proxy, ws: true)  │     ││
                    │  └─────────────────────────┘     ││
                    │                                  ││
                    │  ┌─────────────────────────┐      ││
                    │  │  Auth (GitHub OAuth)     │      ││
                    │  └─────────────────────────┘      ││
                    │                                  ││
                    │  ┌─────────────────────────┐      ││
                    │  │  API Controllers         │      ││
                    │  └─────────────────────────┘      ││
                    │                                  ││
                    │  ┌─────────────────────────┐      ││
                    │  │  BullMQ Queue            │──────││
                    │  └─────────────────────────┘      ││
                    └──────────────────────────────────┘ │
                                          │              │
                               ┌──────────▼──┐   ┌──────▼──────┐
                               │   Redis      │   │  Docker     │
                               │  (BullMQ)    │   │  Containers │
                               └─────────────┘   └─────────────┘
                                                    │
                          ┌─────────────────────────┘
                          ▼
              ┌─────────────────────┐
              │  PostgreSQL         │
              │  (Supabase/PgBouncer)│
              └─────────────────────┘
```

### Core Components

| Component           | Technology                | Role                                      |
|---------------------|---------------------------|-------------------------------------------|
| Runtime             | Bun                       | TypeScript-native runtime, faster than Node |
| Web Framework       | Express 5                 | HTTP server, routing, middleware chain     |
| Reverse Proxy       | `http-proxy`              | Routes custom domains to Docker containers |
| Queue               | BullMQ                    | Async deployment pipeline (Redis-backed)   |
| Cache/Queue Backend | Redis (ioredis)           | BullMQ job storage                         |
| Database            | PostgreSQL (Supabase)     | Persistent state (users, projects, etc.)   |
| ORM                 | Prisma (with `@prisma/adapter-pg`) | DB access, schema management      |
| Auth                | GitHub OAuth              | No JWT/sessions — GitHub token is the session |
| Container Runtime   | Docker (host)             | Isolates and runs user deployments         |
| Logging             | Pino + pino-pretty        | Structured JSON logging                   |

---

## 2. Database Schema

### Entity Relationship

```
User ──1:N──> Project ──1:N──> Deployment
                    │
                    └──1:N──> Domain
```

### Models

**User**
| Field          | Type     | Constraints         |
|----------------|----------|---------------------|
| id             | String   | PK, CUID, default   |
| email          | String?  | Unique              |
| name           | String   |                     |
| image          | String?  |                     |
| githubUsername | String   | Unique              |
| createdAt      | DateTime |                     |
| updatedAt      | DateTime |                     |

**Project**
| Field         | Type     | Constraints        |
|---------------|----------|--------------------|
| id            | String   | PK, CUID           |
| name          | String   |                    |
| repoUrl       | String   |                    |
| framework     | String   |                    |
| buildCommand  | String   |                    |
| startCommand  | String   |                    |
| subDomain     | String   | Unique             |
| userId        | String   | FK → User.id       |

**Deployment**
| Field          | Type     | Notes                       |
|----------------|----------|-----------------------------|
| id             | String   | PK, CUID                    |
| projectId      | String   | FK → Project.id             |
| status         | String   | PENDING → CLONING → BUILDING → RUNNING → COMPLETED/FAILED |
| jobId          | String?  | BullMQ job reference        |
| containerName  | String?  | Docker container name       |
| containerPort  | Int?     | Host port mapped to 3000    |
| errorMessage   | String?  | Failure reason              |

**Domain**
| Field     | Type   | Constraints |
|-----------|--------|-------------|
| id        | String | PK, CUID    |
| domain    | String | Unique      |
| port      | Int?   |             |
| projectId | String | FK → Project.id |

---

## 3. Request Flow

### 3.1 Authentication Flow

```
Browser                          DeployX                        GitHub
   │                                │                              │
   │  GET /auth/github/login        │                              │
   │───────────────────────────────▶│                              │
   │                                │  302 Redirect to             │
   │                                │  github.com/login/oauth/...  │
   │◀───────────────────────────────│                              │
   │                                │                              │
   │  Follow redirect               │                              │
   │──────────────────────────────────────────────────────────────▶│
   │                                │                              │
   │                                │      User authorizes         │
   │                                │                              │
   │  GET /auth/github/callback     │                              │
   │  ?code=xxx&state=yyy           │                              │
   │───────────────────────────────▶│                              │
   │                                │  POST /login/oauth/access    │
   │                                │  (code + client_id + secret) │
   │                                │──────────────────────────────▶│
   │                                │                              │
   │                                │  ◀──── access_token ────────│
   │                                │                              │
   │                                │  GET /user (Bearer token)    │
   │                                │──────────────────────────────▶│
   │                                │                              │
   │                                │  ◀──{ login, email, ... }───│
   │                                │                              │
   │                                │  prisma.user.upsert()        │
   │                                │  (create/update user)        │
   │                                │                              │
   │  Set-Cookie: deployx_access_token (httpOnly, sameSite=Lax)    │
   │  302 → /dashboard                                              │
   │◀───────────────────────────────│                              │
```

### 3.2 Deployment Flow

```
Browser              DeployX API              BullMQ Worker          Docker          DB/Redis
   │                      │                       │                    │                │
   │ POST /deployment     │                       │                    │                │
   │ /create              │                       │                    │                │
   │─────────────────────▶│                       │                    │                │
   │                      │ Upsert Project        │                    │                │
   │                      │ Create Deployment     │                    │───────────────▶│
   │                      │ (status: PENDING)     │                    │                │
   │                      │                       │                    │                │
   │                      │ deployQ.add()         │                    │                │
   │                      │──────────────────────▶│                    │                │
   │                      │                       │                    │                │
   │ { jobId, deployment }│                       │                    │                │
   │◀─────────────────────│                       │                    │                │
   │                      │                       │                    │                │
   │                      │   Worker picks up job │                    │                │
   │                      │                       │                    │                │
   │ POLL /status         │   ┌───────────────────────────────────┐    │                │
   │─────────────────────▶│   │ 1. CLONING                        │    │                │
   │                      │   │    rm -rf project dir             │    │                │
   │                      │   │    git clone <repo>               │    │                │
   │                      │   │                                   │    │                │
   │                      │   │ 2. BUILDING                       │    │                │
   │ { status, progress } │   │    generate Dockerfile            │    │                │
   │◀─────────────────────│   │    docker build -t <tag> .        │───▶│                │
   │                      │   │                                   │    │                │
   │                      │   │ 3. RUNNING                        │    │                │
   │                      │   │    find free port                 │    │                │
   │                      │   │    docker run -d -p <port>:3000   │───▶│                │
   │                      │   │                                   │    │                │
   │                      │   │ 4. MAPPING                        │    │                │
   │                      │   │    setDomain(map.json + DB)       │    │                │
   │                      │   │                                   │    │                │
   │                      │   │ 5. COMPLETED / FAILED             │    │                │
   │                      │   └───────────────────────────────────┘    │                │
   │                      │                       │                    │                │
   │                      │    User visits:                            │                │
   │                      │    https://<subdomain>.launchly.software   │                │
   │                      │                       │                    │                │
   │                      │  Reverse Proxy checks domain-map.json     │                │
   │                      │───────────────────────────────────────────│                │
   │                      │  Proxy forwards to localhost:<port>       │                │
   │                      │──────────────────────────────────────────▶│                │
```

### 3.3 Proxy Request Flow

```
Request: https://<subdomain>.launchly.software/path

  1. Request hits Express app (app.ts)
  2. First middleware: async (req, res, next) => { ... }
     a. Extract hostname from req.headers.host
     b. Call getDomain(hostname) — checks domain-map.json first, then DB
     c. If port found → proxy.web(req, res, { target: `http://localhost:<port>` })
        - Returns immediately, bypasses all remaining middleware
     d. If no port → next() — falls through to normal Express routes

  3. Proxy error handler:
     - If container unreachable → 502 Bad Gateway with custom HTML
```

---

## 4. Middleware Chain

```
Incoming Request
       │
       ▼
┌─────────────────────┐
│ Reverse Proxy       │  ──→ If domain mapped → proxy to container
│ (custom middleware)  │      (skips everything below)
└─────────────────────┘
       │ (not proxied)
       ▼
┌─────────────────────┐
│ helmet()            │  Security headers (CSP, XSS, etc.)
└─────────────────────┘
       ▼
┌─────────────────────┐
│ cors()              │  Wide-open CORS (all origins)
└─────────────────────┘
       ▼
┌─────────────────────┐
│ express.json()      │  Body parser
└─────────────────────┘
       ▼
┌─────────────────────┐
│ cookieParser()      │  Parse cookies
└─────────────────────┘
       ▼
┌─────────────────────┐
│ Router Mounts:      │
│ /auth              │
│ /api/github        │
│ /api/deployment    │
└─────────────────────┘
       ▼ (if no match)
┌─────────────────────┐
│ express.static      │  Serves frontend/dist
└─────────────────────┘
       ▼ (if no file found)
┌─────────────────────┐
│ GET /* catch-all    │  Sends index.html for SPA routing
└─────────────────────┘
```

---

## 5. Deployment Pipeline (BullMQ Worker)

The worker processes each job through 5 phases, updating the database and job progress at each step.

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐
│ CLONING  │───▶│ BUILDING  │───▶│ RUNNING  │───▶│ MAPPING  │───▶│ COMPLETED │
└──────────┘    └───────────┘    └──────────┘    └──────────┘    └───────────┘
      │               │               │               │
      ▼               ▼               ▼               ▼
 rm repo +      Dockerfile      Find free port    Write to
 git clone      + docker build  + docker run      domain-map.json
                                                   + Prisma Domain
```

### Phase Details

**1. CLONING**
- Clean up any previous clone: `rm -rf <projectPath>`
- `git clone <repoUrl> <projectPath>`

**2. BUILDING**
- Copy framework-specific Dockerfile template into project root
- Inject `{{buildCommand}}`, `{{startCommand}}`, `{{rootDir}}` via string replacement
- `docker build -t <user>:<repo> <buildPath>`

**3. RUNNING**
- Find a free TCP port via `net.createServer().listen(0)`
- Clean up previous container: `docker rm -f <name>` (ignore errors)
- `docker run -d -p <freePort>:3000 --name <name> <image>`

**4. MAPPING**
- Register domain → port in `domain-map.json` (filesystem)
- Upsert domain → port in Prisma `Domain` table (DB)
- Domain format: `<subdomain>.launchly.software`

**5. COMPLETED**
- Set status to `COMPLETED`, record `finishedAt`

**On Failure:** Set status to `FAILED`, record `errorMessage`, re-throw for BullMQ retry (3 attempts, exponential backoff).

---

## 6. Reverse Proxy System

### Components

- **Library:** `http-proxy` (with `ws: true` for WebSocket support)
- **Domain Store:** Dual-write to `domain-map.json` (fast filesystem lookup) and Prisma `Domain` table (persistence)
- **Lookup Order:** `domain-map.json` → Prisma `Domain` → `null` (not found)

### Domain Routing

```
domain-map.json (example)
{
  "channel.launchly.software": 40427,
  "vschedule.launchly.software": 35425
}
```

### Proxy Behavior
- Proxied requests bypass all Express middleware (helmet, CORS, body parsing) — raw passthrough to user containers
- WebSocket connections are proxied (`ws: true`)
- Error handler returns custom 502 Bad Gateway page

---

## 7. Authentication & Authorization

### Flow
1. User redirected to GitHub OAuth authorize URL with `state` (CSRF token from `CSRF_SECRET`)
2. GitHub callback exchanges `code` for `access_token`
3. Token used to fetch user profile from GitHub API
4. User upserted in database (by email or `login@github.com` fallback)
5. Token stored in httpOnly cookie (`deployx_access_token`, 24h expiry)
6. No JWT, no server-side session — the GitHub token IS the session

### Auth Strategy
- Controllers read `req.cookies.deployx_access_token` and use it as Bearer token for GitHub API calls
- No centralized auth middleware — each controller handles auth independently
- No refresh tokens — token validity equals GitHub token lifetime

---

## 8. Docker Templates

Supported frameworks and their build/start commands:

| Framework | Base Image        | Build Command       | Start Command               | Internal Port |
|-----------|-------------------|---------------------|-----------------------------|---------------|
| Express   | `node:18-alpine`  | User-defined        | User-defined                | 3000          |
| Next.js   | `node:18-alpine`  | `npm run build`     | `npm start`                 | 3000          |
| React     | `node:18-alpine`  | `npm run build`     | `serve -s build -l 3000`    | 3000          |
| Vite      | `node:18-alpine`  | `npm run build`     | `serve -s dist -l 3000`     | 3000          |
| Python    | `python:3.9-slim` | `pip install -r ...`| `python app.py`             | 3000          |

All containers expose port 3000 internally. The host port is dynamically assigned from the OS free port pool.

---

## 9. Infrastructure Dependencies

| Dependency | Purpose                          | Connection Details                          |
|------------|----------------------------------|--------------------------------------------|
| PostgreSQL | Primary database                 | Supabase (AWS ap-southeast-2) via PgBouncer |
| Redis      | BullMQ job queue + state         | Localhost:6379 (configurable via env)       |
| Docker     | Container runtime for deployments| Unix socket (host)                          |
| GitHub     | OAuth provider + repo access     | API at api.github.com                       |

---

## 10. Key Architectural Decisions

1. **Bun over Node.js** — Faster startup, native TypeScript execution, Bun's built-in test runner and package manager.

2. **GitHub token as session** — Simplifies auth (no JWT, no session store) but means tokens can't be revoked server-side.

3. **BullMQ + Redis for async jobs** — Deployment pipeline is decoupled from the request-response cycle; supports retries and concurrency.

4. **Dual domain store** — `domain-map.json` for fast filesystem reads (avoids DB round-trip on every proxied request), Prisma for persistence across restarts. Write-through on both.

5. **Proxy as first middleware** — Proxied requests skip all Express middleware for maximum performance; raw passthrough to user containers.

6. **Framework-specific Dockerfile templates** — Template injection with `{{placeholders}}` for build/start commands and root directory.

7. **Dynamic port allocation** — Each deployment gets a random free port from the OS, avoiding port collisions.

8. **Polling over streaming** — Deployment status is polled via HTTP; no SSE or WebSocket for real-time log streaming (listed as future improvement).

---

## 11. API Endpoints

### Authentication
| Method | Path                    | Description                          |
|--------|-------------------------|--------------------------------------|
| GET    | `/auth/github/login`    | Redirect to GitHub OAuth             |
| GET    | `/auth/github/callback` | OAuth callback → set cookie + redirect |
| POST   | `/auth/logout`          | Clear auth cookie                    |

### GitHub Proxy
| Method | Path                | Description                |
|--------|---------------------|----------------------------|
| GET    | `/api/github/user`  | Proxy GET /user to GitHub  |
| GET    | `/api/github/repos` | Proxy GET /user/repos      |

### Deployments
| Method | Path                              | Description                      |
|--------|-----------------------------------|----------------------------------|
| POST   | `/api/deployment/create`          | Start a new deployment           |
| GET    | `/api/deployment/status`          | Poll deployment/job status       |
| GET    | `/api/deployment/user-deployments`| List all deployments for user    |

---

## 12. Entry Points

| File        | Purpose                              |
|-------------|--------------------------------------|
| `server.ts` | Starts Express server on configured PORT |
| `worker.ts` | Starts BullMQ worker (5 concurrent jobs) |
| `app.ts`    | Express app setup (middleware, routes)   |

Both `server.ts` and `worker.ts` run as separate processes, sharing Redis and PostgreSQL.

```
# Terminal 1: Run HTTP server
bun run server.ts

# Terminal 2: Run worker
bun run worker.ts
```

---

## 13. Environment Variables

| Variable             | Required | Description                          |
|----------------------|----------|--------------------------------------|
| `NODE_ENV`           | Yes      | `development` or `production`        |
| `PORT`               | Yes      | HTTP server port (default: 3000)     |
| `REDIS_HOST`         | Yes      | Redis host (default: localhost)      |
| `REDIS_PORT`         | Yes      | Redis port (default: 6379)           |
| `REDIS_PASSWORD`     | No       | Redis auth password                  |
| `GITHUB_CLIENT`      | Yes      | GitHub OAuth App client ID           |
| `GITHUB_SECRET`      | Yes      | GitHub OAuth App client secret       |
| `GITHUB_REDIRECT_URL`| Yes      | OAuth callback URL                   |
| `CSRF_SECRET`        | No       | OAuth state parameter value          |
| `DEPLOY_QUEUE_NAME`  | Yes      | BullMQ queue name                    |
| `DATABASE_URL`       | Yes      | PostgreSQL connection (pooled)       |
| `DIRECT_URL`         | Yes      | PostgreSQL direct connection         |
