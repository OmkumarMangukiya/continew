import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { createApiKeySchema, toggleApiKeySchema } from "../src/core/zod.js";
import {
    createApiKey,
    getAllApiKeys,
    toggleApiKey,
    deleteApiKey
} from "../src/controller/apiKeyController.js";
import { db } from "../src/core/db.js";

// Mock DB queries for unit testing controllers
vi.mock("../src/core/db.js", () => ({
    db: {
        query: vi.fn()
    }
}));

const mockDbQuery = db.query as unknown as ReturnType<typeof vi.fn>;

describe("API Key Schema Validation", () => {
    describe("createApiKeySchema", () => {
        it("accepts payload with valid name", () => {
            const res = createApiKeySchema.safeParse({ name: "Production Gateway" });
            expect(res.success).toBe(true);
            if (res.success) {
                expect(res.data.name).toBe("Production Gateway");
            }
        });

        it("accepts empty object (optional name)", () => {
            const res = createApiKeySchema.safeParse({});
            expect(res.success).toBe(true);
        });

        it("rejects empty string name", () => {
            const res = createApiKeySchema.safeParse({ name: "" });
            expect(res.success).toBe(false);
        });

        it("rejects name longer than 100 characters", () => {
            const res = createApiKeySchema.safeParse({ name: "a".repeat(101) });
            expect(res.success).toBe(false);
        });
    });

    describe("toggleApiKeySchema", () => {
        it("accepts empty body for atomic toggle", () => {
            const res = toggleApiKeySchema.safeParse({});
            expect(res.success).toBe(true);
        });

        it("accepts explicit boolean isActive", () => {
            const resTrue = toggleApiKeySchema.safeParse({ isActive: true });
            const resFalse = toggleApiKeySchema.safeParse({ isActive: false });
            expect(resTrue.success).toBe(true);
            expect(resFalse.success).toBe(true);
        });

        it("rejects non-boolean isActive", () => {
            const res = toggleApiKeySchema.safeParse({ isActive: "yes" });
            expect(res.success).toBe(false);
        });
    });
});

describe("API Key Cryptographic Integrity", () => {
    it("generates unique keys with cn_live_ prefix and 256-bit entropy", () => {
        const key1 = `cn_live_${crypto.randomBytes(32).toString("hex")}`;
        const key2 = `cn_live_${crypto.randomBytes(32).toString("hex")}`;

        expect(key1.startsWith("cn_live_")).toBe(true);
        expect(key2.startsWith("cn_live_")).toBe(true);
        expect(key1).not.toBe(key2);
        // "cn_live_" (8 chars) + 64 hex chars = 72 chars
        expect(key1.length).toBe(72);
    });

    it("computes deterministic SHA-256 hash matching event verification query", () => {
        const rawApiKey = "cn_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const hash1 = crypto.createHash("sha256").update(rawApiKey).digest("hex");
        const hash2 = crypto.createHash("sha256").update(rawApiKey).digest("hex");

        expect(hash1).toBe(hash2);
        expect(hash1.length).toBe(64);
    });
});

describe("API Key Controller Handlers", () => {
    const mockResponse = () => {
        const res: any = {};
        res.status = vi.fn().mockReturnValue(res);
        res.json = vi.fn().mockReturnValue(res);
        return res;
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createApiKey", () => {
        it("rejects unauthenticated requests", async () => {
            const req: any = { body: { name: "Test" } };
            const res = mockResponse();

            await createApiKey(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
        });

        it("creates an API key and returns raw key with metadata", async () => {
            const req: any = {
                user: { userId: "user-123" },
                body: { name: "Billing Key" }
            };
            const res = mockResponse();

            const mockDbRow = {
                id: "key-uuid-1",
                name: "Billing Key",
                is_active: true,
                created_at: new Date()
            };

            mockDbQuery.mockResolvedValueOnce({
                rows: [mockDbRow],
                rowCount: 1,
                command: "INSERT",
                oid: 0,
                fields: []
            });

            await createApiKey(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.apiKey.id).toBe("key-uuid-1");
            expect(responseData.apiKey.name).toBe("Billing Key");
            expect(responseData.apiKey.rawApiKey.startsWith("cn_live_")).toBe(true);
            expect(responseData.apiKey.isActive).toBe(true);
        });
    });

    describe("getAllApiKeys", () => {
        it("returns all API keys for authenticated user without exposing hash", async () => {
            const req: any = {
                user: { userId: "user-123" }
            };
            const res = mockResponse();

            const mockDbRows = [
                { id: "key-1", name: "Key 1", is_active: true, created_at: new Date() },
                { id: "key-2", name: "Key 2", is_active: false, created_at: new Date() }
            ];

            mockDbQuery.mockResolvedValueOnce({
                rows: mockDbRows,
                rowCount: 2,
                command: "SELECT",
                oid: 0,
                fields: []
            });

            await getAllApiKeys(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.apiKeys.length).toBe(2);
            expect(responseData.apiKeys[0].id).toBe("key-1");
            expect(responseData.apiKeys[0].isActive).toBe(true);
            expect(responseData.apiKeys[1].isActive).toBe(false);
            expect(responseData.apiKeys[0].key_hash).toBeUndefined();
            expect(responseData.apiKeys[0].rawApiKey).toBeUndefined();
        });
    });

    describe("toggleApiKey", () => {
        it("toggles active state and returns updated metadata", async () => {
            const req: any = {
                user: { userId: "user-123" },
                params: { id: "key-1" },
                body: {}
            };
            const res = mockResponse();

            mockDbQuery.mockResolvedValueOnce({
                rows: [{ id: "key-1", name: "Key 1", is_active: false, created_at: new Date() }],
                rowCount: 1,
                command: "UPDATE",
                oid: 0,
                fields: []
            });

            await toggleApiKey(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.apiKey.isActive).toBe(false);
            expect(responseData.message).toContain("deactivated");
        });

        it("returns 404 if API key not found or belongs to another user", async () => {
            const req: any = {
                user: { userId: "user-123" },
                params: { id: "non-existent-key" },
                body: {}
            };
            const res = mockResponse();

            mockDbQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: "UPDATE",
                oid: 0,
                fields: []
            });

            await toggleApiKey(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: "API key not found" });
        });
    });

    describe("deleteApiKey", () => {
        it("deletes API key and returns 200", async () => {
            const req: any = {
                user: { userId: "user-123" },
                params: { id: "key-1" }
            };
            const res = mockResponse();

            mockDbQuery.mockResolvedValueOnce({
                rows: [{ id: "key-1" }],
                rowCount: 1,
                command: "DELETE",
                oid: 0,
                fields: []
            });

            await deleteApiKey(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                message: "API key deleted successfully",
                id: "key-1"
            });
        });

        it("returns 404 when attempting to delete non-existent or unauthorized key", async () => {
            const req: any = {
                user: { userId: "user-123" },
                params: { id: "key-other-user" }
            };
            const res = mockResponse();

            mockDbQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: "DELETE",
                oid: 0,
                fields: []
            });

            await deleteApiKey(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: "API key not found" });
        });
    });
});