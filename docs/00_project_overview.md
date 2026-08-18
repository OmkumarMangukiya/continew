# Webhook Delivery Infrastructure — Project Overview

> **Context file.** If we start a new session, share this file and the relevant phase file and I will know exactly where we are.

---

## What We Are Building

A mini **Svix / Hookdeck** — a backend service other apps call to say *"deliver this event to this URL."*

It is **not** a fire-and-forget HTTP call. It:
- Accepts an event and queues it immediately (the caller never waits on actual delivery)
- Signs the payload with HMAC so the receiver can verify authenticity
- Retries with exponential backoff when delivery fails
- Stops retrying a clearly-dead endpoint via a circuit breaker, resumes automatically when it recovers
- Keeps an append-only log of every attempt in Postgres — success or failure, with response code, latency, timestamp
- Shows all of this happening **live on a dashboard** over WebSockets

---

## Folder Structure (what we are building toward)

```text
continew/
├── src/
│   ├── api/              # Express HTTP API — the entry point for senders
│   │   ├── server.ts     # Express app setup & routes
│   ├── worker/           # BullMQ dispatcher — runs as a SEPARATE process
│   │   └── index.ts      # Worker entry point
│   ├── core/             # Shared code used by both API and Worker
│   │   ├── type.ts       # TypeScript interfaces & discriminated unions
│   │   ├── db.ts         # Postgres connection pool (shared)
│   │   ├── queue.ts      # BullMQ queue setup (shared)
│   │   ├── hmac.ts       # HMAC signature generator
│   │   └── circuitBreaker.ts # Redis-backed circuit breaker state
│   └── public/           # THE DASHBOARD (frontend) — served as static files
│       ├── index.html    # The dashboard HTML page
│       └── app.js        # Vanilla JS that connects via WebSocket and renders events
├── tests/                # Vitest tests
│   ├── hmac.tests.ts
│   ├── backoff.test.ts
│   └── circuitbreaker.test.ts
├── schema.sql            # Postgres database schema
├── docker-compose.yml    # API + Worker + Redis + Postgres
├── Dockerfile            # How to containerize the Node app
├── package.json
└── tsconfig.json
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript | Discriminated unions make `DeliveryAttempt` states type-safe |
| API Framework | Express | Simple, industry-standard |
| Job Queue | BullMQ | Built-in delayed retries with backoff, sits on Redis |
| Database | PostgreSQL | ACID guarantees for endpoints, events, and immutable audit logs |
| Circuit Breaker State | Redis | Sub-ms reads on the hot delivery path |
| Tests | Vitest | Verifies HMAC, backoff, and circuit breaker transitions |
| Real-time Dashboard | WebSockets (`ws`) | Live delivery status — no polling |
| Local Infra & Containers | Docker Compose | Run Redis, Postgres, API, Worker identically |
| CI/CD | GitHub Actions | Automated tests on push/PR |
| Deployment | Render + Upstash | Production cloud deployment |

---

## API Surface (what we are building)

```
POST   /endpoints              Register a destination URL, returns a signingSecret
GET    /endpoints/:id          Fetch endpoint details + current circuit breaker state
POST   /events                 Submit an event to be delivered (what "Razorpay" calls)
GET    /events/:id/attempts    Full delivery attempt history for one event
GET    /endpoints/:id/attempts All attempts for one endpoint, paginated
WS     /dashboard              Live stream of delivery status changes (the dashboard)
```

---

## Data Models

```typescript
interface WebhookEndpoint {
  id: string;
  url: string;
  signingSecret: string;
  createdAt: Date;
  isActive: boolean;
}

interface Event {
  id: string;
  endpointId: string;
  type: string;           // e.g. "payment.success"
  payload: Record<string, unknown>;
  createdAt: Date;
}

// Discriminated union — each status carries only the fields relevant to that state.
type DeliveryAttempt =
  | { status: 'pending';   eventId: string; scheduledAt: Date }
  | { status: 'succeeded'; eventId: string; responseCode: number; latencyMs: number; deliveredAt: Date }
  | { status: 'failed';    eventId: string; responseCode: number | null; error: string; attemptNumber: number; nextRetryAt: Date }
  | { status: 'exhausted'; eventId: string; totalAttempts: number; lastError: string };
```

---

## The Phases

| Phase | File | Goal |
|---|---|---|
| **Phase 1** | `01_phase1_setup.md` | TypeScript scaffold, Express API, data models |
| **Phase 2** | `02_phase2_queue_dispatcher.md` | Redis & Postgres via Docker, BullMQ queue, DB persistence, Dispatcher Worker, HMAC |
| **Phase 3** | `03_phase3_reliability.md` | Exponential backoff, Circuit Breaker in Redis, Vitest tests |
| **Phase 4** | `04_phase4_persistence_dashboard.md` | Delivery audit log queries, WebSocket server, **live dashboard UI** |
| **Phase 5** | `05_phase5_production.md` | Full App Dockerfile, Docker Compose multi-container, GitHub Actions CI/CD, deployment |

---

## Current Status

- [x] Project guide reviewed and understood
- [x] Phase 1 — Scaffold & API design
- [ ] **Phase 2 — in progress** (Docker infra, Postgres, BullMQ queue, Worker, HMAC)
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
