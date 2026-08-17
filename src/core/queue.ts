/*
    BullMQ : Define the queue which will be used by the API 
             and the worker.
*/

import { Queue, ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";

export const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
})

// 'webhook-delivery' is the unique queue name inside redis managed by bullmq
export const deliveryQueue = new Queue('webhook-delivery', { connection });