/*
This controller handles all operations related to API keys:
- Generation of API keys and storing SHA-256 hashes in db
- Get all API keys for the authenticated user
- Toggling API key active/inactive status
- Deleting API key
*/

import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../core/db.js";
import { createApiKeySchema, toggleApiKeySchema } from "../core/zod.js";
import { ApiKeyResponse, ApiKeySummary } from "../core/type.js";

// POST /api-keys - Generate a new API key for the authenticated user
export const createApiKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const parsed = createApiKeySchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid API key data", errors: parsed.error.issues });
        }

        const { name } = parsed.data;

        // Generate cryptographically secure 256-bit random API key with prefix
        const rawApiKey = `cn_live_${crypto.randomBytes(32).toString("hex")}`;
        const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
        const id = crypto.randomUUID();

        const result = await db.query(
            `INSERT INTO api_keys (id, user_id, key_hash, name, is_active, created_at)
             VALUES ($1, $2, $3, $4, true, NOW())
             RETURNING id, name, is_active, created_at`,
            [id, userId, keyHash, name ?? null]
        );

        const row = result.rows[0];
        const apiKeyResponse: ApiKeyResponse = {
            id: row.id,
            name: row.name,
            rawApiKey,
            isActive: row.is_active,
            createdAt: row.created_at
        };

        return res.status(201).json({
            message: "API key created successfully. Please copy your key now as you won't be able to see it again.",
            apiKey: apiKeyResponse
        });
    } catch (error) {
        console.error("Error creating API key:", error);
        return res.status(500).json({ message: "Failed to create API key" });
    }
};

// GET /api-keys - List all API keys for the authenticated user
export const getAllApiKeys = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { rows } = await db.query(
            `SELECT id, name, is_active, created_at
             FROM api_keys
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        const apiKeys: ApiKeySummary[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            isActive: row.is_active,
            createdAt: row.created_at
        }));

        return res.status(200).json({ apiKeys });
    } catch (error) {
        console.error("Error fetching API keys:", error);
        return res.status(500).json({ message: "Failed to fetch API keys" });
    }
};

// PATCH /api-keys/:id/toggle - Toggle or explicitly update active status of an API key
export const toggleApiKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ message: "API key ID is required" });
        }

        const parsed = toggleApiKeySchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid request payload", errors: parsed.error.issues });
        }

        const { isActive } = parsed.data;

        let result;
        if (typeof isActive === "boolean") {
            result = await db.query(
                `UPDATE api_keys
                 SET is_active = $1
                 WHERE id = $2 AND user_id = $3
                 RETURNING id, name, is_active, created_at`,
                [isActive, id, userId]
            );
        } else {
            result = await db.query(
                `UPDATE api_keys
                 SET is_active = NOT is_active
                 WHERE id = $1 AND user_id = $2
                 RETURNING id, name, is_active, created_at`,
                [id, userId]
            );
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "API key not found" });
        }

        const row = result.rows[0];
        const apiKeySummary: ApiKeySummary = {
            id: row.id,
            name: row.name,
            isActive: row.is_active,
            createdAt: row.created_at
        };

        return res.status(200).json({
            message: `API key ${apiKeySummary.isActive ? "activated" : "deactivated"} successfully`,
            apiKey: apiKeySummary
        });
    } catch (error) {
        console.error("Error toggling API key status:", error);
        return res.status(500).json({ message: "Failed to toggle API key status" });
    }
};

// DELETE /api-keys/:id - Permanently delete an API key
export const deleteApiKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ message: "API key ID is required" });
        }

        const result = await db.query(
            `DELETE FROM api_keys
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "API key not found" });
        }

        return res.status(200).json({
            message: "API key deleted successfully",
            id
        });
    } catch (error) {
        console.error("Error deleting API key:", error);
        return res.status(500).json({ message: "Failed to delete API key" });
    }
};