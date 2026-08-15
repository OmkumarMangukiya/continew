// File to define custom types used in this project

// Webhook Endpoint : Destination URL registered by the merchant where the events will be sent to.
export interface WebhookEndpoint{
    id : string; // unqiue id for each endpoint
    url : string; // url where the events would be sent to 
    signingSecret : string; // 32 byte key generated at registration, used by merchant server to verify
    createdAt: Date;
    isActive: boolean;
}

// Event : Events sent by the sender(eg. Razorpay) which will be queued
export interface Event{
    id: string; // unique id for the event
    endpointId: string; // foriegn key for the WebhookEndpoint
    type: string; // defines what event just happend and passes it to merchant server so that server know what event had happened
    payload: Record<string, unknown>; // any json object, here all keys are string and the value can be anything just like in any payload
    createdAt: Date; // time at which the API accepted the event
}

/* 
    Delivery Attempt : There can 4 types of attempts
                    1. the event is yet to send for first time, status would be pending and scheduled time
                    2. the event is succeded and we get a response code and see the latency and delivered at
                    3. the event failed and would be send again after some time note error and attempt number and next try
                    4. lastly after many tries the  event still didnt succeded and called exhausted

*/
export type DeliveryAttempt = 
                    | {status: 'pending'; eventId: string; scheduledAt: Date}
                    | {status: 'succeded' ; eventId: string; responseCode: number; latencyMs: number; deliveredAt: Date}
                    | {status: 'failed'; eventId: string; responseCode: number | null; error : string; attemptNumber: number; nextRetryAt: Date}
                    | {status: 'exhuated'; eventId: string; totalAttempts: number; lastError: string;}


                            