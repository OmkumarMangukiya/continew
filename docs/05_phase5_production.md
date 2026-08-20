# Phase 5: Production Readiness — Docker, CI/CD & Deployment

**Goal:** Containerize the application so it runs identically on any machine and in the cloud. Set up GitHub Actions to automatically run tests on every push. Deploy the whole system live on the internet for free.

By the end of this phase, your project is live at a public URL, your tests run automatically on every commit, and you can walk an interviewer through a real deployment.

---

## Concepts to Understand Before Coding
### Node Version: Node 22 LTS
- This setup standardizes on **Node 22** (`node:22-alpine`) across both local development, Docker containers, and GitHub Actions CI/CD.
- Alpine-based images keep container footprint lightweight (< 150MB).

### Docker & Docker Compose
**Docker** packages your app and all its dependencies into an isolated **container** image.

**Docker Compose** lets you define multiple containers (services) and their connections in one `docker-compose.yml` file:
- `api` — our Express API server (serves REST endpoints, WebSockets, and dashboard UI)
- `worker` — our BullMQ dispatcher worker
- `redis` — the message queue store and circuit breaker state store
- `postgres` — the audit log database

The API and worker share the same Docker image (same codebase, different startup command).

### Why Separate API and Worker Containers?
If delivery jobs pile up (lots of retries), you can scale the `worker` container to multiple instances independently (`docker compose up --scale worker=3`) without touching the `api`. They scale independently based on different bottlenecks (CPU/network for workers vs HTTP concurrency for the API).

---

## What Files to Create

```
continew/
├── .github/
│   └── workflows/
│       └── main.yml       ← GitHub Actions CI/CD pipeline
├── Dockerfile             ← Multi-stage build for TypeScript Node app
├── .dockerignore          ← Ignore node_modules, dist, .env from build context
├── docker-compose.yml     ← Defines all 4 services (api, worker, redis, postgres)
└── .env.example           ← Template for environment variables
```

---

## Step-by-Step

### Step 1 — Create `.env.example` and `.dockerignore`
Document all environment variables needed in `.env.example`:
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

Create a `.dockerignore` file in the root directory:
```
node_modules
dist
.git
.env
```

Ensure `import 'dotenv/config';` is present at the entrypoints (`src/api/server.ts` and `src/worker/index.ts`).

---

### Step 2 — Create `Dockerfile` (Multi-stage Build)

Because TypeScript requires development dependencies (`tsc`, `@types/*`) during the build step, a **multi-stage build** is the cleanest production practice:

```dockerfile
# Stage 1: Build TypeScript source
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder stage and static assets for frontend
COPY --from=builder /app/dist ./dist
COPY src/public ./src/public

EXPOSE 3000

# Default command (API server) — overridden for worker in docker-compose.yml
CMD ["node", "dist/api/server.js"]
```

> **Key Notes:**
> 1. **`npm run build`**: Runs `tsc` to compile TypeScript to `dist/`.
> 2. **`src/public`**: Copied into runner stage so Express can serve the web dashboard.
> 3. **`npm ci --omit=dev`**: Keeps the final container lean with only runtime dependencies.** `package*.json` is copied and cached before source compilation.

---

### Step 3 — Update `docker-compose.yml`

Combine the `api` and `worker` services with `postgres` and `redis`:

```yaml
services:
  api:
    build: .
    container_name: continew_api
    restart: always
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
    container_name: continew_worker
    restart: always
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
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

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
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  postgres_data:
  redis_data:
```

Test running everything together locally:
```bash
docker compose up --build
```

---

### Step 4 — Create `.github/workflows/main.yml`

```yaml
name: CI/CD

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    name: Lint & Test
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Run tests
        run: npm test
        env:
          REDIS_URL: redis://localhost:6379

  deploy:
    name: Deploy to Render
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'

    steps:
      - name: Trigger Render Deploy Hook
        run: |
          if [ -n "${{ secrets.RENDER_DEPLOY_HOOK_URL }}" ]; then
            curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
          else
            echo "RENDER_DEPLOY_HOOK_URL secret not set. Skipping deploy step."
          fi
```

---

### Step 5 — Deploy to Cloud (Render / Railway)

1. **GitHub Repository**: Push all changes to your remote GitHub repo.
2. **Postgres**: Create a hosted Postgres database (e.g. on Render or Supabase) and run `schema.sql`.
3. **Redis**: Create a free Redis instance on [Upstash](https://upstash.com) (provides a persistent `rediss://...` connection string).
4. **API Service**:
   - Create a Web Service on Render pointing to your Dockerfile.
   - Set environment variables: `DATABASE_URL`, `REDIS_URL`, `PORT=3000`.
   - Command: `node dist/api/server.js`.
5. **Worker Service**:
   - Create a Background Worker on Render.
   - Same environment variables.
   - Command: `node dist/worker/index.js`.
6. **Deploy Hook**: Add the webhook URL to GitHub Secrets as `RENDER_DEPLOY_HOOK_URL`.

---

## ✅ Phase 5 Checklist

- [ ] `.env.example` documents all required environment variables
- [ ] Multi-stage `Dockerfile` compiles TypeScript and packages static assets
- [ ] `docker-compose.yml` runs all 4 services (`api`, `worker`, `redis`, `postgres`) together
- [ ] `docker compose up --build` works end-to-end locally
- [ ] `.github/workflows/main.yml` tests build on PRs and pushes
- [ ] Hosted Postgres & Upstash Redis configured
- [ ] API and Worker deployed live to production
