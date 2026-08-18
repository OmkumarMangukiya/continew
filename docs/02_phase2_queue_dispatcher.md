# Phase 2: Queuing, Persistence & Basic Dispatcher

**Goal:** Run Redis and PostgreSQL locally (using Docker), store registered endpoints and events in Postgres, queue delivery tasks with BullMQ, and have a separate Worker process pick up jobs, query the endpoint info from Postgres, and perform HMAC-signed HTTP deliveries.

By the end of this phase, you will have:
1. **Redis & Postgres** running via Docker.
2. **API server** persisting endpoints & events in Postgres and queuing delivery jobs into Redis.
3. **Worker process** listening to Redis, fetching endpoint secrets from Postgres, HMAC signing payloads, and dispatching webhooks.

---

## Concepts to Understand Before Coding

### Why a Queue? Why Not Deliver Directly in the API Route?
"The API responds instantly regardless of whether the destination is fast, slow, or completely down." If you delivered directly in the route handler, a slow merchant server would block the API response for seconds. During a traffic spike, your API would crawl because it's doing network I/O to external servers.

The queue decouples the two concerns:
- **API**: fast, just validates, persists to DB, and enqueues to Redis.
- **Worker**: does the actual HTTP POST, verifies responses, handles retries.

### Why Postgres Now (Phase 2)?
The worker runs as an independent process from the API server. In-memory storage (`Map`) cannot be shared across separate Node processes. Persisting `endpoints` and `events` in Postgres immediately enables the worker to look up the endpoint URL and `signingSecret` reliably.

### HMAC (Hash-based Message Authentication Code)
Before sending the webhook payload to the merchant, you sign the exact HTTP request body. You use the `signingSecret` (generated during endpoint registration) as the key. The merchant computes the HMAC on their end — if the signatures match, they know the request came from you and wasn't tampered with.

```
signature = HMAC-SHA256(signingSecret, request_body_string)
```

---

## What Files to Create / Modify

```
continew/
├── docker-compose.yml     ← NEW: spins up local Redis and Postgres
├── schema.sql             ← NEW: database schema for endpoints, events, attempts
├── src/
│   ├── api/
│   │   └── server.ts      ← MODIFY: use Postgres for endpoints & events, queue to BullMQ
│   ├── worker/
│   │   └── index.ts       ← NEW: the dispatcher worker (queries DB, signs & POSTs)
│   └── core/
│       ├── type.ts        ← Shared types
│       ├── db.ts          ← NEW: Postgres connection pool
│       ├── queue.ts       ← BullMQ queue definition
│       └── hmac.ts        ← NEW: HMAC signing function
├── tests/
│   └── hmac.tests.ts      ← Vitest unit tests for HMAC
```

---

## Step-by-Step

### Step 1 — Environment Variables & Docker Infrastructure

#### 1.1 Secure Secrets with `.env` and `.env.example`
Never hardcode database passwords in code or Compose files. 

Create `.env.example` (committed to git):
```bash
# .env.example
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_this_secure_password
POSTGRES_DB=continew
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:change_this_secure_password@localhost:5432/continew

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
```

Create your private `.env` (ignored by git in `.gitignore`):
```bash
# .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_local_password
POSTGRES_DB=continew
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:your_local_password@localhost:5432/continew

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
```

#### 1.2 Create `docker-compose.yml`
Create `docker-compose.yml` in the root of the project using environment variable interpolation:

```yaml
services:
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

Start the containers in the background:
```bash
docker compose up -d
```

---

### Step 2 — Install Dependencies
```bash
npm install bullmq pg dotenv
npm install -D @types/pg vitest
```

---

### Step 3 — Create `schema.sql` and Initialize Database
Create `schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS endpoints (
  id             TEXT PRIMARY KEY,
  url            TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  is_active      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES endpoints(id),
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id             BIGSERIAL PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(id),
  status         TEXT NOT NULL, -- 'pending' | 'succeeded' | 'failed' | 'exhausted'
  response_code  INTEGER,
  latency_ms     INTEGER,
  error          TEXT,
  attempt_number INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

Since `schema.sql` is mounted to `/docker-entrypoint-initdb.d/`, Postgres automatically applies it on first startup. You can also run it manually:
```bash
docker exec -i continew_postgres psql -U postgres -d continew < schema.sql
```

---

### Step 4 — Create `src/core/db.ts`
Manage the PostgreSQL connection pool securely with environment variables:

```typescript
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

export const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'continew'}`,
});
```

---

### Step 5 — Configure Shared BullMQ Queue (`src/core/queue.ts`)
```typescript
import { Queue, ConnectionOptions } from 'bullmq';

export const connection: ConnectionOptions = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    };

export const deliveryQueue = new Queue('webhook-delivery', { connection });
```

---

### Step 6 — Implement HMAC Signing (`src/core/hmac.ts`) & Tests
Create `src/core/hmac.ts`:
```typescript
import crypto from 'crypto';

export function signPayload(secret: string, payload: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
```

Add unit tests in `tests/hmac.tests.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { signPayload } from '../src/core/hmac.js';

describe('HMAC Signing', () => {
  const secret = 'test-secret-key-123';
  const payload = JSON.stringify({ event: 'order.created', amount: 100 });

  it('produces a deterministic signature for identical inputs', () => {
    const sig1 = signPayload(secret, payload);
    const sig2 = signPayload(secret, payload);
    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different payloads', () => {
    const sig1 = signPayload(secret, payload);
    const sig2 = signPayload(secret, JSON.stringify({ event: 'order.created', amount: 200 }));
    expect(sig1).not.toBe(sig2);
  });
});
```

Run test: `npm test`

---

### Step 7 — Update `src/api/server.ts` with Postgres & Queue
- `POST /endpoints`: Insert into `endpoints` table in Postgres.
- `POST /events`: Look up endpoint in Postgres, insert into `events` table, push event to `deliveryQueue`.

---

### Step 8 — Implement the Dispatcher Worker (`src/worker/index.ts`)
```typescript
import { Worker, Job } from "bullmq";
import { connection } from "../core/queue.js";
import { signPayload } from "../core/hmac.js";
import { Event } from "../core/type.js";
import { db } from "../core/db.js";

export const deliveryWorker = new Worker(
  'webhook-delivery',
  async (job: Job) => {
    const event: Event = job.data;

    // 1. Fetch endpoint details from Postgres
    const { rows } = await db.query(
      `SELECT url, signing_secret FROM endpoints WHERE id = $1 AND is_active = true`,
      [event.endpointId]
    );

    if (rows.length === 0) {
      throw new Error(`Endpoint not found or inactive: ${event.endpointId}`);
    }

    const { url, signing_secret: signingSecret } = rows[0];

    // 2. Prepare JSON body & HMAC signature
    const requestBody = JSON.stringify({
      id: event.id,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt
    });

    const signature = signPayload(signingSecret, requestBody);

    // 3. Dispatch HTTP request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature
      },
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed with status: ${response.status}`);
    }

    console.log(`[Worker] Delivered event ${event.id} to ${url}`);
  },
  { connection }
);
```

---

### Step 9 — Add Dev Scripts to `package.json`
```json
{
  "scripts": {
    "dev:api": "tsx watch src/api/server.ts",
    "dev:worker": "tsx watch src/worker/index.ts",
    "test": "vitest run"
  }
}
```

Run both in separate terminal windows:
- Terminal 1: `npm run dev:api`
- Terminal 2: `npm run dev:worker`

---

## ✅ Phase 2 Checklist

- [ ] Redis & Postgres containers running via Docker (`docker compose up -d`)
- [ ] Tables created in Postgres via `schema.sql`
- [ ] `src/core/db.ts` and `src/core/queue.ts` connected
- [ ] `POST /endpoints` inserts into Postgres
- [ ] `POST /events` inserts into Postgres and queues to BullMQ
- [ ] HMAC unit tests pass (`npm test`)
- [ ] Worker processes jobs, fetches endpoints from DB, signs payloads, and executes `fetch`

Once all boxes are checked, move to **`03_phase3_reliability.md`**.
