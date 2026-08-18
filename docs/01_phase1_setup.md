# Phase 1: TypeScript Scaffold & Basic API

**Goal:** Get a working TypeScript + Express project running. Define all data models. Implement `POST /endpoints` so a caller can register a destination URL and get back a signing secret.

By the end of this phase you will have a running Express server that accepts and stores endpoint registrations in memory.

---

## Concepts to Understand Before Coding

### TypeScript vs JavaScript
TypeScript is JavaScript with a type system on top. It compiles down to plain JS (`tsc` does this). The key benefit for this project: **discriminated unions** on `DeliveryAttempt` make it impossible to access `responseCode` on a `pending` attempt — the compiler catches that bug before it ever runs.

### Express
Express is a minimal HTTP framework for Node.js. You define routes like `app.post('/endpoints', handler)` and it calls your handler with a `req` (request) and `res` (response) object.

### HMAC Signing Secret (just generating it for now)
When an endpoint is registered, we generate a random secret string. Later, we will use this to sign every payload we send to that endpoint. For now, just generating it with `crypto.randomBytes(32).toString('hex')` is enough.

---

## What Files to Create

```
continew/
├── src/
│   ├── api/
│   │   └── server.ts      ← Express app, registers routes
│   └── core/
│       └── types.ts       ← All TypeScript interfaces/types
├── package.json
└── tsconfig.json
```

---

## Step-by-Step

### Step 1 — `npm init -y` (already done ✅)
This creates your `package.json` — the file that tracks everything about your project: its name, version, scripts you can run, and all its dependencies. The `-y` flag skips the interactive questions and uses default values.

---

### Step 2 — Install Dependencies

#### The main package
```bash
npm install express
```
- `npm install <package>` downloads the package and saves it to `package.json` under `"dependencies"`. These are packages your app needs to **run** in production.
- `express` is the HTTP framework your API server is built on.

#### The development tools
```bash
npm install -D typescript @types/node @types/express ts-node nodemon
```

**What does `-D` mean?**
`-D` is short for `--save-dev`. It saves packages under `"devDependencies"` in `package.json` instead of `"dependencies"`. DevDependencies are tools you only need while developing — they are **not included** when someone installs your package as a library, and in production Docker builds you can skip them with `npm ci --only=production`. This keeps production images small and fast.

**Why each package:**

| Package          | What it is                                                             | Why we need it                                                                                                                                                                    |
| ------------------| ------------------------------------------------------------------------| -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `typescript`     | The TypeScript compiler (`tsc`)                                        | Converts your `.ts` files into plain `.js` files that Node can run                                                                                                                |
| `@types/node`    | Type definitions for Node.js built-ins                                 | Without this, TypeScript doesn't know what `crypto`, `http`, `path`, etc. are — it would show errors everywhere you use them                                                      |
| `@types/express` | Type definitions for Express                                           | Express itself is written in plain JS with no types. This package adds TypeScript types for `Request`, `Response`, `NextFunction`, etc. so you get autocomplete and type checking |
| `ts-node`        | A tool that runs TypeScript directly without compiling first           | Used in development so you can run `ts-node src/api/server.ts` instead of `tsc && node dist/api/server.js` on every change                                                        |
| `nodemon`        | A watcher that restarts your server automatically when you save a file | Without it, you would have to manually kill and restart the server after every code change                                                                                        |

---

### Step 3 — Configure `tsconfig.json`

Run this to generate a default config file:
```bash
npx tsc --init
```

> **What is `npx`?** `npx` runs a package's command without globally installing it. Here it runs the `tsc` command from the `typescript` package you just installed.

The generated `tsconfig.json` has dozens of commented-out options. Find and update these specific ones (uncomment them if needed):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

**What each option means:**

| Option            | Value      | What it does                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------| ------------| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `target`          | `"ES2022"` | Which version of JavaScript to compile *down to*. `ES2022` is well-supported by modern Node.js (you're on v24, so this is fine). It allows modern JS features like `Promise`, `async/await`, `??`, etc. in the output.                                                                                                                                                                                             |
| `rootDir`         | `"./src"`  | Tells TypeScript: "all my source files are inside `src/`". It uses this to mirror the folder structure in `outDir`.                                                                                                                                                                                                                                                                                                |
| `outDir`          | `"./dist"` | Where compiled `.js` files go. When you run `tsc`, every `.ts` file in `src/` gets compiled to a `.js` file in `dist/`. This is what actually runs in production.                                                                                                                                                                                                                                                  |
| `strict`          | `true`     | Enables a whole set of stricter type checks at once. The most important ones it turns on: **`strictNullChecks`** (you can't pass `null` where a `string` is expected — this alone catches a huge class of real bugs), **`noImplicitAny`** (you can't have untyped variables — TypeScript will force you to be explicit). Without `strict: true`, TypeScript is much more lenient and you lose most of the benefit. |
| `esModuleInterop` | `true`     | Allows you to write `import express from 'express'` instead of the uglier `import * as express from 'express'`. Express was written in CommonJS format (old Node module system), and this option smooths over the compatibility difference.                                                                                                                                                                        |

---

### Step 4 — Add Scripts to `package.json`

Open `package.json` and update the `"scripts"` section:
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/api/server.ts",
    "build": "tsc",
    "start": "node dist/api/server.js",
    "test": "echo \"No tests yet\" && exit 0"
  }
}
```

**What each script does:**

| Script          | Command                                                            | When you use it                                                         |
| -----------------| --------------------------------------------------------------------| -------------------------------------------------------------------------|
| `npm run dev`   | Starts nodemon watching for changes, runs the server via `ts-node` | During development — auto-restarts on save                              |
| `npm run build` | Runs the TypeScript compiler, outputs JS to `dist/`                | Before deploying, or to check for TS errors                             |
| `npm start`     | Runs the compiled JS directly via Node                             | In production (faster than ts-node, no compilation overhead at runtime) |

---

### Step 5 — Create `src/core/types.ts`

This is your data model file. Type this out yourself from the spec — don't copy-paste:

```typescript
// src/core/types.ts

export interface WebhookEndpoint {
  id: string;
  url: string;
  signingSecret: string;
  createdAt: Date;
  isActive: boolean;
}

export interface Event {
  id: string;
  endpointId: string;
  type: string;           // e.g. "payment.success"
  payload: Record<string, unknown>;  // any JSON object
  createdAt: Date;
}

// This is a DISCRIMINATED UNION.
// Each branch of the union has a different 'status' value (the "discriminant").
// TypeScript uses that to figure out which branch you're on, and only lets you
// access the fields that exist on THAT branch.
//
// Example: if you have a DeliveryAttempt and do:
//   if (attempt.status === 'succeeded') { attempt.latencyMs }  ← OK
//   if (attempt.status === 'pending')   { attempt.latencyMs }  ← TS ERROR: latencyMs doesn't exist on pending
//
// This catches bugs at compile time that plain JS would only catch at runtime (or never).
export type DeliveryAttempt =
  | { status: 'pending';   eventId: string; scheduledAt: Date }
  | { status: 'succeeded'; eventId: string; responseCode: number; latencyMs: number; deliveredAt: Date }
  | { status: 'failed';    eventId: string; responseCode: number | null; error: string; attemptNumber: number; nextRetryAt: Date }
  | { status: 'exhausted'; eventId: string; totalAttempts: number; lastError: string };
```

**What is `Record<string, unknown>`?**
It means: "an object where every key is a string and the values can be anything." We use `unknown` (not `any`) because `unknown` forces you to check the type before using it — TypeScript won't let you do `payload.amount * 2` without first asserting or checking that `amount` is a number. `any` would just let everything through with no checking.

---

### Step 6 — Create `src/api/server.ts`

Build your Express server here. You need to:
1. Create an Express app
2. Add `express.json()` middleware so Express can parse JSON request bodies
3. Create an in-memory store (just a `Map`) to hold registered endpoints
4. Implement `POST /endpoints`:
   - Read `url` from the request body
   - Generate an `id` (use `crypto.randomUUID()`)
   - Generate a `signingSecret` (use `crypto.randomBytes(32).toString('hex')`)
   - Store the new `WebhookEndpoint` in your in-memory store
   - Return the endpoint object in the response
5. Start the server on port 3000

**What is middleware?**
In Express, `middleware` is a function that runs for every request before your route handler. `express.json()` specifically reads the raw body of incoming requests and parses it as JSON, putting the result on `req.body`. Without it, `req.body` would be `undefined` — you'd have no way to read what the caller sent.

**Think about it before looking at the hint. Try to write this yourself first.**

<details>
<summary>Hint: Skeleton to get you started</summary>

```typescript
// src/api/server.ts
import express from 'express';
import crypto from 'crypto';
import { WebhookEndpoint } from '../core/types';

const app = express();
app.use(express.json()); // middleware: parse JSON bodies

// In-memory store — Map<id, WebhookEndpoint>
// We'll replace this with Postgres in Phase 4
const endpoints = new Map<string, WebhookEndpoint>();

app.post('/endpoints', (req, res) => {
  const { url } = req.body;

  // TODO: validate that 'url' exists — if not, return 400
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  // TODO: build the WebhookEndpoint object
  const endpoint: WebhookEndpoint = {
    id: crypto.randomUUID(),
    url,
    signingSecret: crypto.randomBytes(32).toString('hex'),
    createdAt: new Date(),
    isActive: true,
  };

  // TODO: store it
  endpoints.set(endpoint.id, endpoint);

  // TODO: return it as JSON
  // IMPORTANT: this is the ONLY time we return signingSecret to the caller
  res.status(201).json(endpoint);
});

app.listen(3000, () => {
  console.log('API server running on http://localhost:3000');
});
```

</details>

---

### Step 7 — Run It and Test Manually

```bash
npm run dev
```

In a second terminal, test with `curl`:
```bash
curl -X POST http://localhost:3000/endpoints \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://example.com/webhooks\"}"
```

You should get back a JSON object with an `id` and `signingSecret`.

Also test the sad path — what happens if you send no `url`?
```bash
curl -X POST http://localhost:3000/endpoints \
  -H "Content-Type: application/json" \
  -d "{}"
```
You should get back a `400` error with a useful message.

---

## ✅ Phase 1 Checklist

- [ ] `package.json` created with `express` in `dependencies` and TS tools in `devDependencies`
- [ ] `tsconfig.json` configured with `rootDir`, `outDir`, `strict: true`, `esModuleInterop: true`
- [ ] `src/core/types.ts` with all 3 types (`WebhookEndpoint`, `Event`, `DeliveryAttempt`)
- [ ] `src/api/server.ts` with Express server running on port 3000
- [ ] `POST /endpoints` works — returns object with `id` and `signingSecret`
- [ ] `POST /endpoints` with no `url` returns `400`
- [ ] Tested with `curl` or Postman

---

## Concepts to Solidify After Finishing

- What is a discriminated union? Why can't we just use a plain interface with optional fields?
- What does `strict: true` in `tsconfig.json` actually enable? (Look up `strictNullChecks` and `noImplicitAny` specifically)
- Why do we return the `signingSecret` only once at registration time and never again?
- What is the difference between `dependencies` and `devDependencies`?

Once all boxes are checked, move to **`02_phase2_queue_dispatcher.md`**.
