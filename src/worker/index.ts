/*
Dispatcher that takes the event from the queue and process jobs.
*/

import { Worker, Job } from "bullmq"
import { connection } from "../core/queue.js"
import { signPayload } from "../core/hmac.js"
import type { Event } from "../core/type.js"
import { db } from "../core/db.js"
import { isRequestAllowed, recordSuccess, redisClient, recordFailure } from "../core/circuitBreaker.js"
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
        const attempt = job.attemptsMade + 1;
        const maxAttempts = job.opts.attempts || 1;

        console.log(`Processing job: ${job.id} (Attempt ${attempt}/${maxAttempts}) with data: `, job.data);

        const event: Event = job.data;

        const result = await db.query(`SELECT * FROM endpoints where id=$1`, [event.endpointId]);

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            console.warn(`Endpoint ${event.endpointId} not found or inactive. Dropping job.`);
            return;
        }
        const endpoint = result.rows[0];
        const signingSecret = endpoint.signing_secret;
        const isAllowed = await isRequestAllowed(redisClient, event.endpointId);
        if (!isAllowed) {
            throw new Error(`Circuit open for endpoint ${event.endpointId}`);
        }

        const payloadString = JSON.stringify({
            id: event.id,
            type: event.type,
            payload: event.payload,
            createdAt: event.createdAt
        });

        const signature = signPayload(signingSecret, payloadString);


        const startTime = Date.now();
        let status: 'succeeded' | 'failed' = 'failed';
        let responseCode: number | null = null;
        let errorMessage: string | null = null;

        try {
            const response = await fetch(endpoint.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-webhook-signature': signature
                },
                body: payloadString
            });
            responseCode = response.status;
            if (response.ok) {
                status = 'succeeded';
            }
            else {
                errorMessage = `HTTP error status ${response.status}`;
            }

        } catch (error: any) {
            errorMessage = error.message;
        }
        const latencyMs = Date.now() - startTime;


        await db.query(
            `INSERT INTO delivery_attempts
            (event_id, status, response_code, latency_ms, error, attempt_number)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [event.id, status, responseCode, latencyMs, errorMessage, job.attemptsMade + 1]
        );
        const attemptPayload = {
            type: 'DELIVERY_ATTEMPT',
            attempt: {
                eventId: event.id,
                status: status,
                responseCode: responseCode,
                latencyMs: latencyMs,
                error: errorMessage,
                attemptNumber: attempt,
                createdAt: new Date()
            }
        };
        // Publish to Redis channel
        await redisClient.publish('webhook:delivery_attempt', JSON.stringify(attemptPayload));
        // if the status was succeeded then recordSuccess
        if (status === 'succeeded') {
            await recordSuccess(redisClient, event.endpointId);
            console.log(`[Worker] Successfully delivered event ${event.id} to ${endpoint.url}`);
            return;
        } else {
            await recordFailure(redisClient, event.endpointId);
            console.error(`[Worker] Delivery failed for event ${event.id} (Attempt ${attempt}/${maxAttempts}): ${errorMessage}`);
            // Throw error so BullMQ knows this attempt failed and triggers retry backoff
            throw new Error(errorMessage || `Delivery failed with status ${responseCode}`);
        }
    },
    {
        connection,
        settings: {
            backoffStrategy: backoffCalculation,
        },
    }
);