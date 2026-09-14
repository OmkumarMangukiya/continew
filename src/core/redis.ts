// Redis client for communication between redis instance and server
import { Redis } from "ioredis";

const redisURL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const isTls = redisURL.startsWith("rediss://");

export const redis = new Redis(redisURL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: isTls ? { rejectUnauthorized: false } : undefined
});

redis.on("error", (err) => {
    console.warn("[Redis API Client Warning]:", err.message);
});
