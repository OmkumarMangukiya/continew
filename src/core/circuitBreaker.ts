/*
Configuration of circuit
If 5 consecutive request fails then the ciruit opens for 60 seconds

Ciruit State is stored in Redis like -> `circuit:endpointId` : {'state' : 'open , 'failureCount' : '1', 'openedAt' : 'Date.now()'}

Functions Implemented : 
                        1. getCircuitState(redisClient, endpointId) -> get current circuit state
                        2. recordSuccess(redisClient, endpointId) -> record success and change state accordingly
                        3. recordFailure(redisClient, endpointId) -> record failure and change state accordingly
                        4. isRequestAllowed(redisClient, endpointId) -> Check if the request is allowed to be sent
*/

import { Redis } from 'ioredis';

const redisURL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const redisClient = new Redis(redisURL);

export const CIRCUIT_CONFIG = {
    failureThreshold: 5, // if failed for more than 5 times - circuit open
    cooldownSeconds: 60, // stay open for 60 seconds - not sending anything 
}

type CircuitState = 'closed' | 'open' | 'half-open';

export const getCircuitState = async (redisClient: Redis, endpointId: string): Promise<CircuitState> => {

    const data = (await redisClient.hgetall(`circuit:${endpointId}`));

    if (!data || !data.state) return 'closed';

    const state = data.state as CircuitState;

    // if the circuit is open then check if the cooldown is open
    if (state === 'open') {
        const openedAt = Number(data.openedAt);
        const elapsedSeconds = (Date.now() - openedAt) / 1000;

        // if cooldownSeconds is over then change the state to half-open to check
        if (elapsedSeconds >= CIRCUIT_CONFIG.cooldownSeconds) {
            await redisClient.hset(`circuit:${endpointId}`, {'state': 'half-open'});
            return 'half-open';
        }

        return 'open';
    }

    return state;
}

export const recordSuccess = async (redisClient: Redis, endpointId: string): Promise<void> => {
    await redisClient.hset(`circuit:${endpointId}`, {
        state: 'closed',
        failureCount: '0'
    });
}

export const recordFailure = async (redisClient: Redis, endpointId: string): Promise<void> => {
    const data = await redisClient.hgetall(`circuit:${endpointId}`);

    let failureCount = 1;
    if (data && data.failureCount) {
        failureCount += Number(data.failureCount);
    }
    const isHalfOpen = data?.state === 'half-open';
    if (isHalfOpen || failureCount >= CIRCUIT_CONFIG.failureThreshold) {
        await redisClient.hset(`circuit:${endpointId}`, {
            state: 'open',
            failureCount: failureCount.toString(),
            openedAt: Date.now().toString(),
        });
    } else {
        await redisClient.hset(`circuit:${endpointId}`, {
            state: 'closed',
            failureCount: failureCount.toString(),
        });
    }
    return;
}

export const isRequestAllowed = async (redisClient: Redis, endpointId: string): Promise<boolean> => {
    const state = await getCircuitState(redisClient, endpointId);
    return state === 'closed' || state === 'half-open';
};
