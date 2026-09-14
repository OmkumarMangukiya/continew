/*
This controller file includes all logic related to functions related to events
*/

import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../core/db.js";
import { deliveryQueue } from "../core/queue.js";
import { Event } from "../core/type.js";


// POST /events Controller for handling events from API and storing it in queue
export const handleEvents = async (req: Request, res: Response) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || typeof apiKey !== 'string') {
            return res.status(401).json({ error: "x-api-key header is required" });
        }

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
        // create key hash for verification
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        // Verify endpoint exists, is active, and belongs to the user owning this active API key
        const endpointResult = await db.query(
            `SELECT e.id, e.is_active
             FROM endpoints e
             JOIN api_keys ak ON ak.user_id = e.user_id
             WHERE e.id = $1 AND ak.key_hash = $2 AND ak.is_active = true`,
            [endpointId, keyHash]
        );

        if (endpointResult.rows.length === 0 || !endpointResult.rows[0].is_active) {
            return res.status(401).json({ message: "Invalid API key or inactive endpoint" });
        }

        const event: Event = {
            id: crypto.randomUUID(),
            endpointId: endpointId,
            type,
            payload,
            createdAt: new Date()
        };

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

};