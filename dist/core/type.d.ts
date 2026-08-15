export interface WebhookEndpoint {
    id: string;
    url: string;
    signingSecret: string;
    createdAt: Date;
    isActive: boolean;
}
export interface Event {
    id: string;
    endpointId: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: Date;
}
export type DeliveryAttempt = {
    status: 'pending';
    eventId: string;
    scheduledAt: Date;
} | {
    status: 'succeded';
    eventId: string;
    responseCode: number;
    latencyMs: number;
    deliveredAt: Date;
} | {
    status: 'failed';
    eventId: string;
    responseCode: number | null;
    error: string;
    attemptNumber: number;
    nextRetryAt: Date;
} | {
    status: 'exhuated';
    eventId: string;
    totalAttempts: number;
    lastError: string;
};
//# sourceMappingURL=type.d.ts.map