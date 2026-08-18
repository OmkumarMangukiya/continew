# Phase 3: Reliability — Exponential Backoff & Circuit Breaker

**Goal:** Make delivery genuinely reliable. If a destination fails, retry with growing delays. If it's clearly down, stop wasting retries and let it breathe — then probe automatically when the cooldown expires.

By the end of this phase, the worker will handle failures intelligently and all state machine logic will be verified with Vitest tests.

---

## Concepts to Understand Before Coding

### Exponential Backoff
When a delivery fails, you don't retry immediately — that hammers a struggling server.
You wait progressively longer between each attempt:

```
Attempt 1 fails → wait 1 second
Attempt 2 fails → wait 5 seconds
Attempt 3 fails → wait 15 seconds
Attempt 4 fails → wait 30 seconds
Attempt 5 fails → wait 5 minutes
Attempt 6 fails → wait 1 hour
Attempt 7 fails → mark as EXHAUSTED, stop trying
```

BullMQ can handle this for you via a custom `backoffStrategy` on the Worker and the `attempts` / `backoff` options on a job:
```typescript
await deliveryQueue.add(`${event.id}:${type}`, event, {
  attempts: 6,
  backoff: {
    type: 'customWebhookbackoff',
  },
});
```

### Circuit Breaker (3-State State Machine)
The circuit breaker protects against wasting resources on an endpoint that is clearly dead for an extended period.

```
         Too many failures
[CLOSED] ─────────────────→ [OPEN]
(normal)                    (block all requests, wait cooldown)
                                │
                         Cooldown expires
                                ↓
                           [HALF-OPEN]
                        (let ONE request through)
                           /          \
                    Succeeds          Fails
                       ↓                ↓
                  [CLOSED]           [OPEN]
               (back to normal)   (reset cooldown)
```

We store the state in Redis (per endpoint, keyed by endpoint id) because:
- It needs to be fast — checked on every single delivery attempt
- It needs to survive a worker restart (unlike a JS variable)
- Redis is already running (required for BullMQ)

### Redis Data Structure for Circuit Breaker
We will store a hash in Redis for each endpoint:
```
key: circuit:<endpointId>
fields:
  state         → "closed" | "open" | "half-open"
  failureCount  → number
  openedAt      → timestamp (when it was tripped open)
```

---

## What Files to Create / Modify

```
continew/
├── src/
│   ├── worker/
│   │   └── index.ts            ← MODIFY: configure custom backoff strategy & check circuit breaker
│   └── core/
│       └── circuitBreaker.ts   ← NEW: all circuit breaker logic
├── tests/
│   ├── hmac.test.ts            ← no change
│   ├── backoff.test.ts         ← NEW: verify backoff delay sequence
│   └── circuitbreaker.test.ts  ← NEW: verify state machine transitions
```

---

## Step-by-Step

### Step 1 — Update `POST /events` and Worker to use Custom Backoff
In `src/api/server.ts`, when you call `deliveryQueue.add(...)`, specify the custom retry strategy:

```typescript
await deliveryQueue.add(`${event.id}:${type}`, event, {
  attempts: 6,
  backoff: {
    type: 'customWebhookbackoff',
  },
});
```

And configure `backoffStrategy` in `src/worker/index.ts`:
```typescript
settings: {
  backoffStrategy: (attemptsMade: number, type?: string) => {
    if (type === 'customWebhookbackoff') {
      const delays = [
        1 * 1000,          // 1s
        5 * 1000,          // 5s
        15 * 1000,         // 15s
        30 * 1000,         // 30s
        5 * 60 * 1000,     // 5m
        60 * 60 * 1000,    // 1h
      ];
      return delays[attemptsMade - 1] ?? 60 * 60 * 1000;
    }
    return -1;
  },
},
```

### Step 2 — Write the Backoff Test FIRST (`tests/backoff.test.ts`)
Before relying on BullMQ's backoff, write a test that verifies the delay sequence is what you expect for each failed attempt (`attemptsMade`):

Test example:
- attempt 1 → 1000ms (1s)
- attempt 2 → 5000ms (5s)
- attempt 3 → 15000ms (15s)
- attempt 4 → 30000ms (30s)
- attempt 5 → 300000ms (5m)
- attempt 6 → 3600000ms (1h)

Write a pure function that calculates the delay for a given attempt number, then test that function. This is the most important test in the project — it's the kind of logic that "looks right" but breaks silently on an off-by-one.

### Step 3 — Create `src/core/circuitBreaker.ts`
Create a module that handles all circuit breaker logic. (Redis client `ioredis` is already installed in `package.json`).

Define the state, Redis client, and a config object:
```typescript
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

export const redis = new Redis(redisUrl);

export const CIRCUIT_CONFIG = {
  failureThreshold: 5,      // trip open after 5 failures
  cooldownSeconds: 60,      // stay open for 60 seconds
};

// The three states
type CircuitState = 'closed' | 'open' | 'half-open';
```

Implement these four functions:

**`getCircuitState(redis, endpointId)`**
- Read the hash from Redis for this endpoint
- If nothing exists, return `'closed'` (default)
- If state is `'open'`, check if `cooldownSeconds` has passed since `openedAt`
- If cooldown has passed, transition to `'half-open'` and return that
- Otherwise return the current state

**`recordSuccess(redis, endpointId)`**
- Reset `failureCount` to 0
- Set state to `'closed'`

**`recordFailure(redis, endpointId)`**
- Increment `failureCount`
- If `failureCount` >= `failureThreshold`, set state to `'open'` and record `openedAt`

**`isRequestAllowed(redis, endpointId)`** (convenience wrapper)
- Calls `getCircuitState`
- Returns `true` if `closed` or `half-open`
- Returns `false` if `open`

### Step 4 — Write Circuit Breaker Tests FIRST (`tests/circuitbreaker.test.ts`)
Use `vi.useFakeTimers()` (Vitest timer mocking) to simulate time passing without actually waiting 60 seconds. Test every transition:

- Default state is `'closed'`
- After `failureThreshold` failures, state becomes `'open'`
- While `'open'`, `isRequestAllowed` returns `false`
- After cooldown time elapses, `getCircuitState` returns `'half-open'`
- After a success in `'half-open'`, state returns to `'closed'`
- After a failure in `'half-open'`, state goes back to `'open'`

Use a real local Redis instance for these tests (or `ioredis-mock` if you want to avoid needing Redis running in CI).

### Step 5 — Update `src/worker/index.ts` to Check the Circuit
Before attempting delivery in the worker:

```typescript
const allowed = await isRequestAllowed(redis, event.endpointId);
if (!allowed) {
  // Circuit is open — don't waste the attempt
  // Throw a specific error so BullMQ still counts it as "failed"
  throw new Error(`Circuit open for endpoint ${event.endpointId}`);
}

// ...fetch endpoint from DB and attempt delivery...

if (response.ok) {
  await recordSuccess(redis, event.endpointId);
} else {
  await recordFailure(redis, event.endpointId);
  throw new Error(`Delivery failed with status ${response.status}`);
}
```

### Step 6 — Run All Tests
```bash
npm test
```
All three test files should pass: `hmac.test.ts`, `backoff.test.ts`, `circuitbreaker.test.ts`.

---

## ✅ Phase 3 Checklist

- [ ] `POST /events` in the API sets `attempts: 6` and `backoff: { type: 'customWebhookbackoff' }` on the BullMQ job
- [ ] `src/core/circuitBreaker.ts` implements `getCircuitState`, `recordSuccess`, `recordFailure`, `isRequestAllowed`
- [ ] `tests/backoff.test.ts` verifies the delay formula for each attempt number
- [ ] `tests/circuitbreaker.test.ts` verifies all 6 state transitions
- [ ] Worker checks `isRequestAllowed` before every delivery attempt
- [ ] Worker calls `recordSuccess` or `recordFailure` after each attempt
- [ ] `npm test` passes — all tests green

---

## Concepts to Solidify After Finishing

- Why do we store the circuit state in Redis and not in a JS variable inside the worker?
- What is the risk of `half-open` state? Why is it important to only let ONE request through?
- What happens to a job that BullMQ has exhausted all retries for? Where does it go?

Once all boxes are checked, move to **`04_phase4_persistence_dashboard.md`**.
