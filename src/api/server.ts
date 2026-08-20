import express from "express";
import { WebhookEndpoint, Event } from "../core/type.js";
import { Request, Response } from "express";
import crypto, { randomBytes, sign } from "crypto";
import { deliveryQueue } from "../core/queue.js";
import { db } from "../core/db.js"
import { WebSocketServer } from "ws";
import http from 'http'
import { Redis } from "ioredis";
import {
    getAllEndpoints,
    getEndpointDetails,
    getAllEventAttempts,
    getAllEndpointAttempts
} from "../controller/auditController.js";

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTls = redisUrl.startsWith('rediss://');
const redisSubscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: isTls ? { rejectUnauthorized: false } : undefined
});
const app = express();
const server = http.createServer(app);
export const wss = new WebSocketServer({ server });

export function broadcast(data: object) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(message);
        }
    })
}

redisSubscriber.subscribe('webhook:delivery_attempt', (err: unknown) => {
    if (err) console.error("Failed to subscribe to Redis channel:", err);
    else console.log("Subscribed to Redis 'webhook:delivery_attempt' channel");
});


// When a message arrives from Redis, broadcast to all browser WebSockets
redisSubscriber.on('message', (channel: unknown, message: string) => {
    if (channel === 'webhook:delivery_attempt') {
        try {
            const data = JSON.parse(message);
            broadcast(data);
        } catch (err) {
            console.error("Failed to parse Redis message:", err);
        }
    }
});

redisSubscriber.on('error', (err) => {
    console.warn('[Redis Subscriber Warning]:', err.message);
});
redisSubscriber.subscribe('webhook:delivery_attempt', (err: unknown) => {
    if (err) console.error("Failed to subscribe to Redis channel:", err);
    else console.log("Subscribed to Redis 'webhook:delivery_attempt' channel");
});

app.use(express.json());
app.use(express.static(`src/public`));
// controller for registering url for mercahant
const handleEndpoint = async (req: Request, res: Response) => {
    try {
        const { url } = req.body ?? {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: "URL is required" });
        }

        const id = crypto.randomUUID()
        const signingSecret = crypto.randomBytes(32).toString('hex');

        const endpoint: WebhookEndpoint = {
            id: id,
            url,
            signingSecret: signingSecret,
            createdAt: new Date(),
            isActive: true
        }

        await db.query(`INSERT INTO endpoints (id, url, signing_secret, created_at, is_active) VALUES ($1, $2, $3, $4, $5)`,
            [endpoint.id, endpoint.url, endpoint.signingSecret, endpoint.createdAt, endpoint.isActive]
        );

        return res.status(201).json({ message: "Endpoint is created", endpoint });

    } catch (error) {
        console.log("Error creating Endpoint: ", error);
        return res.status(500).json({ message: "Failed to create endpoint" });
    }
}

// Controller for handling events from API and storing it in queue
const handleEvents = async (req: Request, res: Response) => {
    try {
        const { endpointId, type, payload } = req.body ?? {};

        // Input Validation
        if (!endpointId || typeof endpointId !== 'string') {
            return res.status(400).json({ error: "endpointId is required and must be a string" });
        }
        if (!type || typeof type !== 'string') {
            return res.status(400).json({ error: "type is required and must be a string" });
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return res.status(400).json({ error: "payload must be a valid JSON object" });
        }

        // first check if this is registered endpoint

        const endpointResult = await db.query(`SELECT * FROM endpoints WHERE id = $1`, [endpointId]);

        if (endpointResult.rows.length == 0 || !endpointResult.rows[0].is_active) {
            return res.status(404).json({ message: "Endpoint URL not found or inactive" });
        }

        const event: Event = {
            id: crypto.randomUUID(),
            endpointId: endpointId,
            type,
            payload,
            createdAt: new Date()
        }

        await db.query(
            `INSERT INTO events (id, endpoint_id, type, payload, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [event.id, event.endpointId, event.type, JSON.stringify(event.payload), event.createdAt]
        );

        await deliveryQueue.add(`${event.id}:${type}`, event, { attempts: 6, backoff: { type: 'customWebhookbackoff' } });

        return res.status(200).json({ eventId: event.id, status: 'queued' });
    } catch (error) {
        console.log("Failed to add event in queue: ", error);
        return res.status(500).json({ message: "Failed to add event in queue" });
    }

}

app.post('/endpoints', handleEndpoint);
app.post('/events', handleEvents);

app.get('/endpoints', getAllEndpoints);
app.get('/endpoints/:id', getEndpointDetails);
app.get('/events/:id/attempts', getAllEventAttempts);
app.get('/endpoints/:id/attempts', getAllEndpointAttempts);

app.get('/', ((req: Request, res: Response) => {
    res.json({ message: "server is running" })
}));

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;