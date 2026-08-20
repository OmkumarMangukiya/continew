/*
    BullMQ : Define the queue which will be used by the API 
             and the worker.
*/

import { Queue, ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";

const redisURL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTls = redisURL.startsWith('rediss://');

export const connection = new Redis(redisURL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: isTls ? { rejectUnauthorized: false } : undefined
});

connection.on('error', (err) => {
    console.warn('[BullMQ Redis Warning]:', err.message);
});


// 'webhook-delivery' is the unique queue name inside redis managed by bullmq
export const deliveryQueue = new Queue('webhook-delivery', { connection });