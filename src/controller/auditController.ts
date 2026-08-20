/*
This file is used to define functions using which we can access audit logs from the database.
*/

import { Request, Response } from "express"
import { db } from "../core/db.js";
import { getCircuitState, redisClient } from "../core/circuitBreaker.js";

// GET /endpoints
export const getAllEndpoints = async (req: Request, res: Response) => {
    try {
        const { rows } = await db.query('SELECT id,url,created_at,is_active FROM endpoints');

        return res.status(200).json({
            rows
        });
    } catch (error) {
        console.error("Error fetching all endpoints", error);
        return res.status(500).json({ message: "Failed to fetch all endpoints" });
    }
}

// GET /endpoints/:id
export const getEndpointDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        if (!id)
            return res.status(400).json({ message: "Endpoint ID is required" });
        // get the data from the db
        const endpointResult = await db.query(`SELECT id, url, created_at, is_active FROM endpoints WHERE id=$1`, [id]);

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
        })
    } catch (error) {
        console.error("Error fetching endpoint details:", error);
        return res.status(500).json({ error: "Failed to fetch endpoint details" })
    }

}

// GET /events/:id/attempts
export const getAllEventAttempts = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        if (!id) {
            return res.status(400).json({ message: "Event ID is required" })
        }

        const eventCheck = await db.query(`SELECT id FROM events WHERE id = $1`, [id]);
        if (eventCheck.rowCount === 0) {
            return res.status(404).json({ message: "Event not found" });
        }

        const { rows } = await db.query('SELECT * FROM delivery_attempts WHERE event_id=$1 ORDER BY created_at', [id]);

        return res.status(200).json({
            eventId: id,
            attemps: rows
        });
    } catch (error) {
        console.error("Error fetching event attempts:", error);
        return res.status(500).json({ error: "Failed to fetch event attempts" });
    }

}

// GET /endpoints/:id/attempts?page=1&limit=50
export const getAllEndpointAttempts = async (req: Request, res: Response) => {
    try {
        const endpointId = req.params.id as string;

        if (!endpointId) {
            return res.status(400).json({ message: "Endpoint ID is requried" });
        }

        // check if the endpoint exist
        const endpointData = await db.query('SELECT id, url FROM endpoints where id = $1', [endpointId]);

        if (endpointData.rowCount === 0) {
            return res.status(404).json({ message: "Endpoint not found" });
        }

        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const offset = req.query.offset !== undefined ? Number(req.query.offset) : (page - 1) * limit;

        const query = `
            SELECT
                da.id,
                da.event_id,
                da.status,
                da.response_code,
                da.latency_ms,
                da.error,
                da.attempt_number,
                da.created_at,
                e.type as event_type
            FROM delivery_attempts da
            JOIN events e ON da.event_id = e.id
            WHERE e.endpoint_id = $1
            ORDER BY da.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const { rows } = await db.query(query, [endpointId, limit, offset]);

        res.status(200).json({ endpointData, page, limit, offset, count: rows.length, attempts: rows });
    } catch (error) {
        console.error("Error fetching endpoint attempts:", error);
        return res.status(500).json({ error: "Failed to fetch endpoint attempts" });
    }
}