# Launchly

**Self-hosted PaaS - deploy apps from GitHub with one click.**

Launchly is a lightweight deployment engine inspired by Vercel and Railway. It authenticates via GitHub OAuth, builds Docker images from framework-specific templates, and routes traffic through a reverse proxy - all driven by an async job queue.


## Tech Stack

| Layer      | Technology                                |
| ---------- | ----------------------------------------- |
| Runtime    | Bun + TypeScript                          |
| Backend    | Express                                   |
| Frontend   | React, Vite, Tailwind CSS                 |
| Database   | PostgreSQL via Prisma (Supabase)          |
| Queue      | BullMQ + Redis                            |
| Auth       | GitHub OAuth (httpOnly cookies)           |
| Proxy      | `http-proxy` - wildcard subdomain routing |
| Containers | Docker                                    |


## System Design

```mermaid
flowchart TD
    User["User"]

    subgraph Frontend["Frontend"]
        UI["UI Pages\nHome / Dashboard / Deploy"]
        Auth["AuthContext\nProtectedRoute"]
    end

    subgraph Backend["Backend"]
        AuthRoute["Auth Routes\n/auth/github/*"]
        GHRoute["GitHub Routes\n/api/github/*"]
        DeployRoute["Deployment Routes\n/api/deployment/*"]
        Proxy["Reverse Proxy\n*.launchly.software - container port"]
    end

    subgraph Queue["Async Pipeline - BullMQ + Redis"]
        Worker["Worker\nclone - build - run - map"]
    end

    subgraph Infra["Infrastructure"]
        Docker["Docker\nContainers per deploy"]
        DomainMap["domain-map.json\nsubdomain ↔ port"]
        DB["PostgreSQL\nvia Prisma - Supabase"]
    end

    GitHub["GitHub API\nOAuth + Repos"]

    User -->|"visits app"| UI
    UI --> Auth
    Auth -->|"OAuth login"| AuthRoute
    AuthRoute -->|"redirect + callback"| GitHub
    GitHub -->|"token - httpOnly cookie"| AuthRoute

    UI -->|"list repos"| GHRoute
    GHRoute -->|"proxies request"| GitHub

    UI -->|"POST /api/deployment/create"| DeployRoute
    DeployRoute -->|"enqueue job"| Queue
    DeployRoute -->|"save project + deployment"| DB
    UI -->|"GET /api/deployment/status"| DeployRoute
    DeployRoute -->|"poll job state"| Queue

    Worker -->|"git clone + docker build"| Docker
    Worker -->|"write subdomain - port"| DomainMap
    Worker -->|"update deployment status"| DB

    User -->|"visits subdomain"| Proxy
    Proxy -->|"lookup port"| DomainMap
    Proxy -->|"forward traffic"| Docker
```

## How Deployments Work

When you trigger a deploy, the BullMQ worker runs these steps in order:

1. **Clone** - pulls your GitHub repo into a temp directory
2. **Dockerfile** - injects your build/start commands into a framework template
3. **Build** - runs `docker build`
4. **Run** - finds a free port, starts the container
5. **Map** - writes `subdomain.domain - port` to `domain-map.json`
6. **Cleanup** - removes the cloned source (container keeps running)

Your app is then live at `{subdomain}.{ROOT_DOMAIN}`.


## API Reference

### Auth

| Method | Endpoint                | Description                  |
| ------ | ----------------------- | ---------------------------- |
| GET    | `/auth/github/login`    | Redirect to GitHub OAuth     |
| GET    | `/auth/github/callback` | OAuth callback, sets session |
| POST   | `/auth/logout`          | Clears auth cookie           |

### GitHub

| Method | Endpoint            | Description              |
| ------ | ------------------- | ------------------------ |
| GET    | `/api/github/user`  | Current GitHub user info |
| GET    | `/api/github/repos` | List user's repositories |

### Deployments

| Method | Endpoint                         | Description                         |
| ------ | -------------------------------- | ----------------------------------- |
| POST   | `/api/deployment/create`         | Queue a deployment, returns `jobId` |
| GET    | `/api/deployment/status?jobId=X` | Poll job progress and result        |

**Example deployment payload:**

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

## Supported Frameworks

| Framework | Base Image        | Exposed Port |
| --------- | ----------------- | ------------ |
| Express   | `node:18-alpine`  | 3000         |
| Next.js   | `node:18-alpine`  | 3000         |
| React     | `node:18-alpine`  | 3000         |
| Vite      | `node:18-alpine`  | 3000         |
| Python    | `python:3.9-slim` | 3000         |

Each template supports custom `BUILD_COMMAND` and `START_COMMAND` build args.

## License

MIT
