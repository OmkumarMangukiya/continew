import express from "express";
import { Request, Response } from "express";
import { WebSocketServer } from "ws";
import http from 'http'
import { Redis } from "ioredis";
import {
    getAllEndpoints,
    getEndpointDetails,
    getAllEventAttempts,
    getAllEndpointAttempts
} from "../controller/auditController.js";

import { handleEndpoint } from "../controller/endpointController.js";
import { handleEvents } from "../controller/eventController.js";

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