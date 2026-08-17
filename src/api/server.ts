import express from "express";
import { WebhookEndpoint, Event } from "../core/type.js";
import { Request, Response } from "express";
import crypto, { randomBytes, sign } from "crypto";
import { deliveryQueue } from "../core/queue.js";
import { db } from "../core/db.js"
const app = express();

app.use(express.json());

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
        const { endpointId, type, payload } = req.body;

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

        await deliveryQueue.add(`${event.id}:${type}`, event);

        return res.status(200).json({ eventId: event.id, status: 'queued' });
    } catch (error) {
        console.log("Failed to add event in queue: ", error);
        return res.status(500).json({ message: "Failed to add event in queue" });
    }

}

app.post('/endpoints', handleEndpoint);

app.post('/events', handleEvents);

app.get('/', ((req: Request, res: Response) => {
    res.json({ message: "server is running" })
}));
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
})

export default app;