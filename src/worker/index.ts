/*
Dispatcher that takes the event from the queue and process jobs.
*/

import { Worker, Job } from "bullmq"
import { connection } from "../core/queue.js"
import { signPayload } from "../core/hmac.js"
import { Event } from "../core/type.js"
export const deliveryWorker = new Worker(
    'webhook-delivery',
    async (job: Job) => {
        console.log(`Processing job : ${job.id} with data: `, job.data)
        const Event: Event = job.data;
        // get the endpoint details from the postgres
        // const endpoint = get from postgres
        const signingSecret = "something" 
        const payloadString = JSON.stringify({
            id: Event.id,
            type: Event.type,
            payload: Event.payload,
            createdAt: Event.createdAt
        });

        const signature = signPayload(signingSecret, payloadString);

        await fetch(Event.)
    }
)