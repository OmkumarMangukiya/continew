import express from "express";
import { WebhookEndpoint, Event } from "../core/type.js";
import { Request, Response } from "express";
import crypto, { randomBytes, sign } from "crypto";
import { deliveryQueue } from "../core/queue.js";
const app = express();

app.use(express.json());

// temporary using in-memory instead postgres for registered endpoints
const registeredEndpoints = new Map<string, WebhookEndpoint>();

// controller for registering url for mercahant
const handleEndpoint = (req: Request, res: Response) => {
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

    registeredEndpoints.set(id, endpoint);

    return res.status(201).json({ message: "Endpoint is created", endpoint });
}

// Controller for handling events from API and storing it in queue
const handleEvents = (req: Request, res: Response)=>{
    const {endpointId, type, payload} = req.body;

    if(!registeredEndpoints.has(endpointId)){
        return res.status(404).json({message : "Endpoint URL not found"});
    }

    const Event: Event = {
        id: crypto.randomUUID(),
        endpointId: endpointId,
        type,
        payload,
        createdAt: new Date()
    }

    deliveryQueue.add(`${Event.id} : ${type}`,Event);

    return res.status(200).json({eventId:Event.id, status:'queued'});
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