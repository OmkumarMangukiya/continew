/*
Dispatcher that takes the event from the queue and process jobs.
*/

import { Worker, Job } from "bullmq"
import { connection } from "../core/queue.js"
import { signPayload } from "../core/hmac.js"
import type { Event } from "../core/type.js"
import { db } from "../core/db.js"
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

        await fetch(endpoint.url,{
            method: 'POST',
            headers:{
                'Content-Type': 'application/json',
                'x-webhook-signature': signature
            },
            body: payloadString
        });
    },
    {connection}
);