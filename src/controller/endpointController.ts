/*
This controller file includes all logic related to functions related to endpoints
*/
import { Request, Response } from "express"
import { db } from "../core/db.js";
import { WebhookEndpoint } from "../core/type.js";
import crypto from "crypto"


// controller for registering url for mercahant
export const handleEndpoint = async (req: Request, res: Response) => {
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
