/*
This file is used to define functions using which we can access audit logs from the database.
*/

import { Request, Response } from "express";
import { db } from "../core/db.js";

// GET /events/:id/attempts get all event attemps for a particular event 
export const getAllEventAttempts = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user?.userId;

        if (!id) {
            return res.status(400).json({ message: "Event ID is required" });
        }

        const eventCheck = await db.query(
            `SELECT ev.id 
             FROM events ev
             JOIN endpoints ep ON ep.id = ev.endpoint_id
             WHERE ev.id = $1 AND ep.user_id = $2`,
            [id, userId]
        );
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
};

// GET /endpoints/:id/attempts?page=1&limit=50
export const getAllEndpointAttempts = async (req: Request, res: Response) => {
    try {
        const endpointId = req.params.id as string;
        const userId = req.user?.userId;

        if (!endpointId) {
            return res.status(400).json({ message: "Endpoint ID is required" });
        }

        // check if the endpoint exists and belongs to this user
        const endpointData = await db.query('SELECT id, url FROM endpoints WHERE id = $1 AND user_id = $2', [endpointId, userId]);

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

        res.status(200).json({ endpointData: endpointData.rows[0], page, limit, offset, count: rows.length, attempts: rows });
    } catch (error) {
        console.error("Error fetching endpoint attempts:", error);
        return res.status(500).json({ error: "Failed to fetch endpoint attempts" });
    }
};