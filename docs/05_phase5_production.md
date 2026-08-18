# Phase 5: Production Readiness — Docker, CI/CD & Deployment

**Goal:** Containerize the application so it runs identically on any machine and in the cloud. Set up GitHub Actions to automatically run tests on every push. Deploy the whole system live on the internet for free.

By the end of this phase, your project is live at a public URL, your tests run automatically on every commit, and you can walk an interviewer through a real deployment.

---

## Concepts to Understand Before Coding

### Docker & Docker Compose
**Docker** packages your app and all its dependencies into a **container** — a lightweight, isolated environment that runs the same way on your laptop and in the cloud.

**Docker Compose** lets you define multiple containers (services) and their connections in one `docker-compose.yml` file. In our case, we need 4 services:
- `api` — our Express API server
- `worker` — our BullMQ dispatcher worker
- `redis` — the message queue store and circuit breaker state store
- `postgres` — the audit log database

The API and worker share the same `Dockerfile` (same code, different startup command).

### Why Separate API and Worker Containers?
This is an important architectural point. If delivery jobs pile up (lots of failed retries), you can scale the `worker` container to 3 instances without touching the `api`. They scale independently because they do different work. If they were one process, scaling would mean running redundant API servers when you only need more worker capacity.

### GitHub Actions CI/CD
**CI (Continuous Integration):** On every Pull Request, run `npm run lint` and `npm test`. If any test fails, the PR is blocked from merging. This means nothing broken ever lands on `main`.

**CD (Continuous Deployment):** On every push to `main`, automatically build and deploy the latest code to Render. No manual deploys.

### Environment Variables
Secrets (`DATABASE_URL`, `REDIS_URL`, signing secrets) must **never** be committed to git. We use environment variables, set differently per environment:
- **Locally**: a `.env` file (added to `.gitignore`)
- **In CI**: secrets stored in GitHub Actions settings
- **In production**: environment variables set on Render's dashboard

---

## What Files to Create

```
continew/
├── .github/
│   └── workflows/
│       └── main.yml       ← GitHub Actions CI/CD pipeline
├── Dockerfile             ← How to containerize the Node app
├── docker-compose.yml     ← Define all 4 services together
└── .env.example           ← Template showing which env vars are needed (no real values)
```

---

## Step-by-Step

### Step 1 — Create `.env.example` and `.env`
Document all environment variables needed in `.env.example` (committed to git):
```bash
# .env.example — template for collaborators and deployments
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_this_secure_password
POSTGRES_DB=continew
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:change_this_secure_password@localhost:5432/continew

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

PORT=3000
NODE_ENV=development
```

Create a real `.env` file (ignored by git in `.gitignore`) with your actual values:
```bash
# .env — private credentials (NEVER commit to git)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_local_password
POSTGRES_DB=continew
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:your_secure_local_password@localhost:5432/continew

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

PORT=3000
NODE_ENV=development
```

Install `dotenv` to load it in Node:
```bash
npm install dotenv
```
Add `import 'dotenv/config';` at the top of both `src/api/server.ts` and `src/worker/index.ts`.

### Step 2 — Create `Dockerfile`
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# The CMD is overridden per-service in docker-compose.yml
CMD ["node", "dist/api/server.js"]
```

> **Note on layer caching:** By copying `package*.json` and running `npm ci` BEFORE copying the source code, Docker can cache the `node_modules` layer. If you only change your source code but not your dependencies, Docker reuses the cached layer and the build is much faster.

### Step 3 — Create `docker-compose.yml`
```yaml
services:
  api:
    build: .
    command: node dist/api/server.js
    ports:
      - "${PORT:-3000}:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-continew}
      REDIS_URL: redis://redis:6379
      PORT: 3000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build: .
    command: node dist/worker/index.js
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-continew}
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    container_name: continew_postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-continew}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-continew}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:alpine
    container_name: continew_redis
    restart: always
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

Note that in Compose:
1. Containers refer to each other by **service name** (e.g., `postgres:5432` instead of `localhost:5432`).
2. Credentials and configuration variables are interpolated dynamically from `.env` via `${VARIABLE_NAME}` rather than hardcoded in the file.
3. `depends_on` with `condition: service_healthy` guarantees that the API and worker wait until Postgres and Redis are fully ready to accept network connections before starting up.

Test it:
```bash
docker compose up --build
```

### Step 4 — Create `.github/workflows/main.yml`
```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Lint & Test
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        env:
          REDIS_URL: redis://localhost:6379

  deploy:
    name: Deploy to Render
    runs-on: ubuntu-latest
    needs: test  # Only deploy if tests pass
    if: github.ref == 'refs/heads/main'  # Only deploy on pushes to main, not PRs

    steps:
      - name: Trigger Render Deploy
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
```

The `deploy` job uses a **deploy hook** URL from Render — we set this up in Step 6.

### Step 5 — Add Your Render Deploy Hook Secret to GitHub
In your GitHub repo → Settings → Secrets → Actions → New secret:
- Name: `RENDER_DEPLOY_HOOK_URL`
- Value: (the deploy hook URL from Render, set up next)

### Step 6 — Deploy to Render
Follow the `project_guide.md` section 10 for the full instructions. Summary:
1. Push your code to GitHub (add remote origin: `git remote add origin <your-repo-url>`)
2. Go to [render.com](https://render.com) and create a new account
3. Create a **Web Service** for the API (points to your repo, Render detects Dockerfile, start command: `node dist/api/server.js`)
4. Create a **Background Worker** for the dispatcher (same repo, start command: `node dist/worker/index.js`)
5. Create a free **Postgres** database on Render
6. Use **Upstash** for Redis (free tier, no spin-down): [upstash.com](https://upstash.com)
7. Set environment variables (`DATABASE_URL`, `REDIS_URL`) on both services in the Render dashboard
8. Copy the **Deploy Hook URL** from Render and add it to GitHub secrets as `RENDER_DEPLOY_HOOK_URL`

### Step 7 — Verify the Full Pipeline
1. Make a small change (e.g., add a comment to `server.ts`)
2. Push to a branch and open a Pull Request
3. Watch GitHub Actions run the `test` job — it should pass
4. Merge the PR to `main`
5. Watch GitHub Actions trigger the `deploy` job
6. Go to your Render dashboard and confirm the deploy happened
7. Hit your live URL with `curl` and confirm it responds

---

## ✅ Phase 5 Checklist

- [ ] `.env.example` documents all required environment variables
- [ ] `Dockerfile` builds and runs the Node app
- [ ] `docker-compose.yml` runs all 4 services (`api`, `worker`, `redis`, `postgres`) together
- [ ] `docker compose up` works end-to-end locally
- [ ] `.github/workflows/main.yml` runs lint + tests on every PR
- [ ] Tests pass in GitHub Actions
- [ ] Deployed to Render (API + Worker)
- [ ] Postgres on Render, Redis on Upstash
- [ ] CD pipeline triggers on merge to `main`
- [ ] Live URL accessible from the internet

---

## 🎉 Project Complete

Once you finish Phase 5, you have built:
- A **reliable webhook delivery service** with at-least-once delivery guarantees
- **Exponential backoff** retries and a **Redis-backed circuit breaker**
- An **immutable Postgres audit log** of every delivery attempt
- A **live real-time dashboard** over WebSockets
- A fully **containerized** application with Docker Compose
- A **CI/CD pipeline** that runs tests on every PR and deploys on merge

And you can say this in an interview:
> *"I built a webhook delivery service. Events are accepted and queued immediately via BullMQ so a slow destination never blocks the sender. Failed deliveries retry with exponential backoff, and a Redis-backed circuit breaker per endpoint stops wasting retries on a destination that's clearly down, resuming automatically once it recovers. Every attempt — success or failure — is appended to an immutable Postgres log for auditability, and payloads are HMAC-signed so receivers can verify authenticity. It's containerized with Docker, with the API and dispatcher worker as separate services so they scale independently, and GitHub Actions runs the test suite on every PR before deploying."*

## What's Next (v2 — don't build yet)
- **Kafka** in front of BullMQ for high-throughput ingestion
- **Kubernetes** to replace Docker Compose (HPA scaling workers based on queue depth)
