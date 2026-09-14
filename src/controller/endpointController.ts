/*
This controller file includes all logic related to functions related to endpoints
*/
import { Request, Response } from "express"
import { db } from "../core/db.js";
import { WebhookEndpoint } from "../core/type.js";
import { getCircuitState, redisClient } from "../core/circuitBreaker.js";
import crypto from "crypto";

// POST /endpoints controller for registering url for merchant
export const createEndpoint = async (req: Request, res: Response) => {
    try {
        const { url } = req.body ?? {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: "URL is required" });
        }

        const id = crypto.randomUUID();
        const signingSecret = crypto.randomBytes(32).toString('hex');
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const endpoint: WebhookEndpoint = {
            id,
            userId,
            url,
            signingSecret,
            createdAt: new Date(),
            isActive: true
        };

        await db.query(
            `INSERT INTO endpoints (id, user_id, url, signing_secret, created_at, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
            [endpoint.id, endpoint.userId, endpoint.url, endpoint.signingSecret, endpoint.createdAt, endpoint.isActive]
        );

        return res.status(201).json({ message: "Endpoint is created", endpoint });
    } catch (error) {
        console.log("Error creating Endpoint: ", error);
        return res.status(500).json({ message: "Failed to create endpoint" });
    }
};

// GET /endpoints - fetch all endpoints for the authenticated user
export const getAllEndpoints = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { rows } = await db.query(
            'SELECT id, url, created_at, is_active FROM endpoints WHERE user_id = $1',
            [userId]
        );

        return res.status(200).json({ rows });
    } catch (error) {
        console.error("Error fetching all endpoints", error);
        return res.status(500).json({ message: "Failed to fetch all endpoints" });
    }
};

// GET /endpoints/:id - fetch specific endpoint details for the authenticated user
export const getEndpointDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!id) {
            return res.status(400).json({ message: "Endpoint ID is required" });
        }

        const endpointResult = await db.query(
            `SELECT id, url, created_at, is_active FROM endpoints WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (endpointResult.rowCount === 0) {
            return res.status(404).json({ message: "Endpoint not found" });
        }

        const endpoint = endpointResult.rows[0];
        const circuitStatus = await getCircuitState(redisClient, id);

        return res.status(200).json({
            message: "Endpoint Data",
            endpointData: endpoint,
            circuitBreaker: {
                status: circuitStatus
            }
        });
    } catch (error) {
        console.error("Error fetching endpoint details:", error);
        return res.status(500).json({ error: "Failed to fetch endpoint details" });
    }
};
