/*
Dispatcher that takes the event from the queue and process jobs.
*/

import { Worker, Job } from "bullmq"
import { connection } from "../core/queue.js"
import { signPayload } from "../core/hmac.js"
import type { Event } from "../core/type.js"
import { db } from "../core/db.js"

// Function to calculate backoff
export const backoffCalculation = (attemptsMade: number, type?: string) => {
    if (type === 'customWebhookbackoff') {
        const delays = [
            1 * 1000,
            5 * 1000,
            15 * 1000,
            30 * 1000,
            5 * 60 * 1000,
            60 * 60 * 1000,
        ];
        return delays[attemptsMade - 1] ?? 60 * 60 * 1000;
    }
    return -1;
}

// Webhook Delivery 
export const deliveryWorker = new Worker(
    'webhook-delivery',
    async (job: Job) => {
        console.log(`Processing job : ${job.id} with data: `, job.data)

        const event: Event = job.data;

        const result = await db.query(`SELECT * FROM endpoints where id=$1`, [event.endpointId]);

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            console.warn(`Endpoint ${event.endpointId} not found or inactive. Dropping job.`);
            return;
        }
        const endpoint = result.rows[0];
        const signingSecret = endpoint.signing_secret;

        const payloadString = JSON.stringify({
            id: event.id,
            type: event.type,
            payload: event.payload,
            createdAt: event.createdAt
        });

        const signature = signPayload(signingSecret, payloadString);

        const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-signature': signature
            },
            body: payloadString
        });

        if (!response.ok) {
            throw new Error(`HTTP request failed with status: ${response.status}`);
        }

        console.log(`[Worker] Successfully delivered event ${event.id} to ${endpoint.url}`);
    },
    {
        connection,
        settings: {
            backoffStrategy: backoffCalculation,
        },
    }
);