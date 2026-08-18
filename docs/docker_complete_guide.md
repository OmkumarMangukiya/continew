# The Complete Docker & Docker Compose Mastery Guide
*From Beginner Fundamentals to Production Optimization and System Design / Interview Mastery.*

---

## 1. What is Docker & Why Does It Exist?

### The Problem It Solves: "It Works on My Machine"
Before containers, deploying applications meant installing language runtimes, system dependencies, libraries, and database servers directly onto the host operating system. Differences in OS versions, library versions, or environment configurations caused apps to break when moving from a developer's laptop to staging or production.

### What is Docker?
Docker is an open-source platform that packages an application and all its dependencies (code, runtime, system libraries, configuration) into a standardized unit called a **container**. Containers run identically on any machine with Docker installed (Windows, macOS, Linux, AWS, GCP).

### Docker Container vs. Virtual Machine (VM)

| Feature | Virtual Machine (VM) | Docker Container |
|---|---|---|
| **Architecture** | Includes a full Guest Operating System on top of a Hypervisor | Shares the Host OS Kernel; only packages app & user-space dependencies |
| **Size** | Gigabytes (GBs) | Megabytes (MBs) |
| **Startup Time** | Minutes (boots an entire OS) | Milliseconds to seconds (starts a single process) |
| **Resource Usage** | Heavy (CPU/RAM statically allocated) | Extremely lightweight (shares host kernel resources) |
| **Isolation** | Hardware-level isolation via Hypervisor | OS-level isolation via Linux **Namespaces** & **cgroups** |

```
+---------------------------+       +---------------------------+
|      Virtual Machines     |       |      Docker Containers    |
+---------------------------+       +---------------------------+
| [App A]   | [App B]       |       | [App A]   | [App B]       |
| [Libs]    | [Libs]        |       | [Libs]    | [Libs]        |
| [Guest OS]| [Guest OS]    |       +---------------------------+
+---------------------------+       |       Docker Engine       |
|        Hypervisor         |       +---------------------------+
+---------------------------+       |     Host OS & Kernel      |
|    Host OS / Hardware     |       |         Hardware          |
+---------------------------+       +---------------------------+
```

---

## 2. Core Docker Primitives

1. **Dockerfile:** A text blueprint containing step-by-step instructions to assemble a Docker Image.
2. **Image:** An immutable, read-only package (a frozen snapshot) containing the application code, libraries, and runtime. Images are composed of stacked, cached layers.
3. **Container:** A running, runnable instance of an Image. It adds a thin read/write layer on top of the image's immutable layers.
4. **Volume:** Dedicated storage managed by Docker outside the container's lifecycle. Used to persist database data across container restarts.
5. **Network:** An isolated virtual network allowing containers to discover and securely communicate with each other using DNS (by container/service name).
6. **Registry (e.g., Docker Hub):** A cloud or on-prem repository for storing and downloading Docker Images (e.g., `postgres:16-alpine`, `redis:alpine`).

---

## 3. Dockerfile vs. Docker Compose: The Core Difference

| Aspect | Dockerfile | Docker Compose (`docker-compose.yml`) |
|---|---|---|
| **Purpose** | Builds a **single image** for a single service | Orchestrates **multiple containers** running together |
| **Analogy** | A recipe for a single dish | A restaurant menu & kitchen management plan |
| **Scope** | Code, dependencies, environment, startup command | Networking, port mappings, volumes, multi-service dependencies, environment variables |
| **Command** | `docker build -t my-app .` | `docker compose up -d` |
| **Typical Use** | Building your custom Node.js / Go / Python backend image | Running `API` + `Worker` + `Postgres` + `Redis` together locally or in staging |

---

## 4. Deep Dive: How to Write a Dockerfile

A Dockerfile is executed top-to-bottom. Each instruction creates an immutable layer in the image.

### Key Instructions Explained

```dockerfile
# 1. Base Image: The foundation of your image
FROM node:20-alpine

# 2. Working Directory: Sets the active directory for all subsequent instructions
WORKDIR /app

# 3. Environment Variables: Available at build-time and runtime
ENV NODE_ENV=production
ENV PORT=3000

# 4. Build Arguments: Available ONLY during the build phase (e.g. docker build --build-arg VERSION=1.0)
ARG COMMIT_HASH

# 5. Copy Files: Copies files from your local host into the container filesystem
COPY package*.json ./

# 6. Run Commands: Executes shell commands during the build (creates a new layer)
RUN npm ci --only=production

# 7. Copy remaining source code
COPY . .

# 8. Run build step (e.g., compile TypeScript to JavaScript)
RUN npm run build

# 9. Expose Port: Documentation metadata indicating which port the app listens on
EXPOSE 3000

# 10. User: Switch to a non-root user for security
USER node

# 11. Command: The default command executed when the container starts
CMD ["node", "dist/api/server.js"]
```

---

## 5. Critical Distinctions & Interview Essentials

### 1. `CMD` vs. `ENTRYPOINT`
* **`CMD`:** Provides **default arguments** for a container. It can be easily overridden from the command line:
  * Example: `CMD ["node", "dist/api/server.js"]`
  * Running `docker run my-image npm test` will completely replace `node dist/api/server.js` with `npm test`.
* **`ENTRYPOINT`:** Defines the **immutable executable** that will always run. Arguments passed via CLI are appended to it:
  * Example: `ENTRYPOINT ["node"]` + `CMD ["dist/api/server.js"]`
  * Running `docker run my-image dist/worker/index.js` executes `node dist/worker/index.js`.

### 2. `COPY` vs. `ADD`
* **`COPY` (Recommended):** Simply copies local files/directories into the container. Clear and explicit.
* **`ADD`:** Can copy local files, but also automatically unpacks local `.tar.gz` archives and downloads files from remote URLs. Best practice is to use `COPY` unless you specifically need automatic archive extraction.

### 3. Port Mapping: `-p hostPort:containerPort`
* `ports: ["3000:8080"]` means: Traffic arriving on the **host machine** on port `3000` is forwarded into the **container** on port `8080`.
* `EXPOSE 8080` inside a Dockerfile is purely documentation; it does *not* automatically publish the port to your host.

---

## 6. Dockerfile Optimization & Production Best Practices

### 1. Master Layer Caching (Order Matters!)
Docker caches each layer during `docker build`. If a layer hasn't changed, Docker reuses the cached layer, making builds take seconds instead of minutes.
* **Bad Practice (Busts cache on every code edit):**
  ```dockerfile
  COPY . .             # ❌ If you change one line of TS code, npm install runs again!
  RUN npm install
  ```
* **Best Practice (Leverages layer cache):**
  ```dockerfile
  COPY package*.json ./ # ✅ Only changes when you add/remove npm packages
  RUN npm ci
  COPY . .              # Changes frequently, but npm ci remains cached
  ```

### 2. Multi-Stage Builds (Drastically Reduce Image Size)
Compile code in a heavy build stage with full compilers, then copy *only* the compiled JavaScript output and production dependencies into a lightweight runtime image.

```dockerfile
# ==========================================
# STAGE 1: Build & Compile
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# ==========================================
# STAGE 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy only the compiled JS from the builder stage
COPY --from=builder /app/dist ./dist

# Security: Run as non-root user
USER node

EXPOSE 3000
CMD ["node", "dist/api/server.js"]
```
*Result:* Image size drops from **~800MB** down to **~120MB**.

### 3. Always Use `.dockerignore`
Never copy heavy or sensitive files into your build context. Create a `.dockerignore` file:
```
node_modules
dist
.git
.github
.env
*.log
coverage
```

### 4. Choose Minimal Base Images
* `node:20` $\rightarrow$ Full Debian Linux (~1GB)
* `node:20-slim` $\rightarrow$ Minimal Debian with no extra packages (~200MB)
* `node:20-alpine` $\rightarrow$ Ultra-lightweight Alpine Linux (~50MB-120MB)

---

## 7. Deep Dive: How to Write `docker-compose.yml`

Docker Compose defines multi-container applications in a declarative YAML format.

```yaml
version: '3.8'

services:
  # -------------------------------------------------------------
  # 1. API Server Service
  # -------------------------------------------------------------
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: continew-api
    restart: unless-stopped
    command: node dist/api/server.js
    ports:
      - "3000:3000"
    environment:
      - PORT=${PORT:-3000}
      - DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-continew}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy # Waits for DB to be fully ready, not just started
      redis:
        condition: service_healthy
    networks:
      - app-network

  # -------------------------------------------------------------
  # 2. Background Dispatcher Worker Service
  # -------------------------------------------------------------
  worker:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: continew-worker
    restart: unless-stopped
    command: node dist/worker/index.js
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-continew}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network

  # -------------------------------------------------------------
  # 3. PostgreSQL Database
  # -------------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: continew-postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-continew}
    ports:
      - "${POSTGRES_PORT:-5432}:5432" # Allows connecting from host machine (e.g., TablePlus/DBeaver)
    volumes:
      - postgres_data:/var/lib/postgresql/data # Named Volume: Persists DB data
      - ./schema.sql:/docker-entrypoint-initdb.d/01_schema.sql # Auto-initializes tables
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-continew}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # -------------------------------------------------------------
  # 4. Redis Cache & Queue
  # -------------------------------------------------------------
  redis:
    image: redis:alpine
    container_name: continew-redis
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
    networks:
      - app-network

# ===============================================================
# Volumes Definition (Persistent storage outside container lifecycle)
# ===============================================================
volumes:
  postgres_data:
  redis_data:

# ===============================================================
# Networks Definition (Isolated internal DNS network)
# ===============================================================
networks:
  app-network:
    driver: bridge
```

---

## 8. How Inter-Container Communication Works

When services are in the same Docker network:
* **Docker provides automatic internal DNS resolution.**
* The `api` container does NOT connect to `localhost:5432` (because `localhost` inside the `api` container refers to the `api` container itself!).
* Instead, it connects to **`postgres:5432`** using the service name defined in `docker-compose.yml`.
* Similarly, BullMQ connects to **`redis:6379`**.

---

## 9. Top 15 Docker Interview Questions & Model Answers

### Q1: What is the difference between a Container and a Virtual Machine?
**Answer:** A VM runs a full guest operating system on virtualized hardware managed by a Hypervisor. A container runs as an isolated process on the host OS, sharing the host Linux kernel via namespaces and cgroups. Containers are much lighter, boot in milliseconds, and use fewer CPU/RAM resources.

### Q2: How does Docker achieve process isolation under the hood?
**Answer:** Docker leverages Linux kernel features:
1. **Namespaces:** Provide isolation for PID (processes), NET (networking), MNT (filesystem mounts), IPC (inter-process communication), and UTS (hostnames).
2. **Cgroups (Control Groups):** Limit, monitor, and isolate resource utilization (CPU, memory, disk I/O, network bandwidth).
3. **chroot / pivot_root:** Restricts the container filesystem view to its own root directory.

### Q3: What is a Multi-Stage Build and why should you use it?
**Answer:** A multi-stage build uses multiple `FROM` statements in a single Dockerfile. Heavy build tools, compilers (e.g. TypeScript, GCC), and development dependencies are used in an initial stage. Only the final compiled binary/JavaScript artifacts and lean production dependencies are copied to the minimal final stage. This keeps the final production image small, fast to download, and secure (fewer attack vectors).

### Q4: How does Docker's Layer Caching work?
**Answer:** Each instruction in a Dockerfile creates an immutable read-only layer. When building, Docker checks if the instruction and the input files have changed since the last build. If unchanged, it reuses the cached layer. Once a layer is invalidated (e.g., modified files in `COPY`), all subsequent layers must be rebuilt from scratch. Therefore, rarely changing instructions (like `COPY package.json` and `RUN npm ci`) should be placed before frequently changing ones (like `COPY . .`).

### Q5: What is the difference between `CMD` and `ENTRYPOINT`?
**Answer:** `ENTRYPOINT` specifies the executable that should always run when the container starts. `CMD` provides default arguments to that executable, which can be easily overridden by passing CLI arguments to `docker run`. When used together, `ENTRYPOINT` is the command and `CMD` is its default parameter list.

### Q6: What is the difference between Named Volumes and Bind Mounts?
**Answer:**
* **Named Volume (`volumes: [postgres_data:/var/lib/postgresql/data]`):** Managed completely by Docker in Docker storage area (`/var/lib/docker/volumes`). Best for production data persistence, databases, and cross-container sharing.
* **Bind Mount (`volumes: [./src:/app/src]`):** Directly mounts a specific host folder into the container. Best for local development to support live hot-reloading.

### Q7: Why is `depends_on` in Docker Compose sometimes not enough for databases?
**Answer:** By default, `depends_on` only waits for the database container to *start*, not for the database process to be ready to accept TCP connections. To fix this, use a `healthcheck` on the database service (e.g. `pg_isready`) and configure `depends_on: postgres: { condition: service_healthy }`.

### Q8: Why should you avoid running containers as `root`?
**Answer:** If an attacker compromises an application running as `root` inside a container and manages to escape the container via a kernel vulnerability, they obtain `root` access on the entire host machine. Switching to a non-root user (e.g. `USER node` or `USER 1001`) enforces the principle of least privilege.

### Q9: What is the difference between `docker stop` and `docker kill`?
**Answer:** `docker stop` sends a `SIGTERM` signal to the main container process, giving it a grace period (default 10s) to finish active requests, close database connections, and shut down gracefully. If it doesn't terminate in time, it sends `SIGKILL`. `docker kill` sends `SIGKILL` immediately, terminating the process without cleanup.

### Q10: What is the purpose of `.dockerignore`?
**Answer:** It prevents unnecessary, bulky, or sensitive files (such as `node_modules`, `.git`, `.env`, build logs) from being sent as part of the build context to the Docker daemon. This speeds up build times, keeps image sizes small, and prevents accidental leakage of API secrets.

---

## 10. Essential Docker CLI Cheatsheet

```bash
# Containers
docker run -d -p 3000:3000 --name my-app my-image    # Run container in background
docker ps                                           # List running containers
docker ps -a                                        # List all containers (including stopped)
docker stop <container_id>                          # Gracefully stop container
docker rm <container_id>                            # Remove container
docker logs -f <container_id>                       # Stream container logs
docker exec -it <container_id> sh                   # Open interactive shell inside container

# Images
docker build -t my-app:1.0 .                       # Build an image from Dockerfile
docker images                                       # List local images
docker rmi <image_id>                               # Remove an image

# Docker Compose
docker compose up -d                                # Start all services in background
docker compose ps                                   # Show status of services
docker compose logs -f <service_name>               # Stream logs of specific service
docker compose down                                 # Stop and remove containers & networks
docker compose down -v                              # Stop and ALSO delete named volumes
docker compose exec <service_name> sh               # Shell into a compose service

# Cleanup
docker system prune -a --volumes                    # Remove all unused containers, networks, images, volumes
```
