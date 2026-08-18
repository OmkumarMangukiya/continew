# Phase 4: Audit Log Persistence, WebSockets & Live Dashboard

**Goal:** Log every delivery attempt permanently to the immutable `delivery_attempts` table in Postgres. Expose querying endpoints with pagination. Build the live dashboard — a real-time UI that streams delivery attempts and status changes as they happen over WebSockets.

By the end of this phase, the project is fully observable: you can register endpoints, fire events, watch retries and circuit breakers in action, and see everything reflected instantly on a live dashboard page.

---

## Concepts to Understand Before Coding

### Immutable / Append-Only Delivery Log
We **never UPDATE or DELETE** delivery attempt records. If an event delivery fails and is retried, we `INSERT` a brand new row with the new attempt number, latency, response code, and error. This produces an unforgeable, complete audit history.

### WebSockets
Standard HTTP is request-response (client requests, server answers). WebSockets open a **persistent, bidirectional channel**. Once a browser connects to our WebSocket endpoint, our server can push delivery attempt updates immediately without polling.

Flow:
1. Browser opens page → connects to `ws://localhost:3000`
2. Worker delivers a webhook, inserts row in `delivery_attempts` table
3. Worker publishes the attempt event (e.g. via Redis Pub/Sub or WebSocket broadcast)
4. WebSocket server pushes the event to all connected dashboard browsers
5. Browser JavaScript receives the message and updates the dashboard table live

---

## What Files to Create / Modify

```
continew/
├── src/
│   ├── api/
│   │   └── server.ts         ← MODIFY: add GET audit log routes, WebSocket server, serve static dashboard
│   ├── worker/
│   │   └── index.ts          ← MODIFY: insert delivery_attempts rows into Postgres + broadcast event
│   └── public/               ← NEW: frontend dashboard
│       ├── index.html        ← The dashboard HTML
│       └── app.js            ← Vanilla JS connecting to WebSocket and rendering live updates
```

---

## Step-by-Step

### Step 1 — Verify Postgres `delivery_attempts` Table
Ensure the `delivery_attempts` table created from `schema.sql` in Phase 2 is ready:
```sql
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id             BIGSERIAL PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(id),
  status         TEXT NOT NULL,           -- 'pending' | 'succeeded' | 'failed' | 'exhausted'
  response_code  INTEGER,                 -- NULL if request never reached server
  latency_ms     INTEGER,
  error          TEXT,
  attempt_number INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 2 — Add Audit Query Routes to `src/api/server.ts`
Add GET endpoints to inspect logs:
- `GET /endpoints/:id`: Query endpoint details + current circuit breaker status
- `GET /events/:id/attempts`: Query all delivery attempts for a given event:
  ```typescript
  const { rows } = await db.query(
    `SELECT * FROM delivery_attempts WHERE event_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  ```
- `GET /endpoints/:id/attempts`: Query attempts for an endpoint with pagination (`LIMIT 50 OFFSET $offset`).

### Step 3 — Record Delivery Attempts in `src/worker/index.ts`
In the worker's processing loop, record the attempt result immediately:

```typescript
const startTime = Date.now();
let status: 'succeeded' | 'failed' = 'failed';
let responseCode: number | null = null;
let errorMessage: string | null = null;

try {
  const response = await fetch(url, { method: 'POST', body: requestBody, headers: { 'x-webhook-signature': signature, 'Content-Type': 'application/json' } });
  responseCode = response.status;
  if (response.ok) {
    status = 'succeeded';
  } else {
    errorMessage = `HTTP error status ${response.status}`;
  }
} catch (err: any) {
  errorMessage = err.message;
}

const latencyMs = Date.now() - startTime;

// Insert immutable audit log
await db.query(
  `INSERT INTO delivery_attempts
    (event_id, status, response_code, latency_ms, error, attempt_number)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [event.id, status, responseCode, latencyMs, errorMessage, job.attemptsMade + 1]
);
```

### Step 4 — Install `ws` and Set Up WebSocket Server
```bash
npm install ws
npm install -D @types/ws
```

In `src/api/server.ts`, attach `WebSocketServer` to the HTTP server:
```typescript
import { WebSocketServer } from 'ws';
import http from 'http';

const server = http.createServer(app);
export const wss = new WebSocketServer({ server });

export function broadcast(data: object) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}
```

Serve the static dashboard files:
```typescript
import path from 'path';
app.use(express.static('src/public'));
```

### Step 5 — Build the Dashboard Frontend (`src/public/index.html` + `src/public/app.js`)
Create a modern, clean live dashboard page:
- Table showing recent webhook events & attempts
- Live status badges: Green (`succeeded`), Red (`failed`), Yellow (`retrying`), Purple (`exhausted`)
- Latency & HTTP response code meters
- Real-time updates when WebSocket events arrive

---

## ✅ Phase 4 Checklist

- [ ] `GET /events/:id/attempts` and `GET /endpoints/:id/attempts` implemented with Postgres queries
- [ ] Worker inserts every attempt into `delivery_attempts` table
- [ ] WebSocket server set up on Express HTTP server
- [ ] Worker broadcasts delivery events to connected WebSocket clients
- [ ] Live dashboard page (`src/public`) connects to WebSocket and updates UI in real-time
- [ ] Manual test: Send an event, watch the live log populate on the web dashboard

Once all boxes are checked, move to **`05_phase5_production.md`**.
