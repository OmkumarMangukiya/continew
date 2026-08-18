/*
Test file for testing circuit breaker
*/
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { getCircuitState, recordSuccess, recordFailure, isRequestAllowed, CIRCUIT_CONFIG } from "../src/core/circuitBreaker.js"
import { Redis } from "ioredis"

// creating temporary redisClient
const redisurl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = new Redis(redisurl);

describe('Circuit Breaker Test', () => {

    const endpointId = 'k32jewn32'
    beforeEach(async () => {
        vi.useFakeTimers();

        await redisClient.del(`circuit:${endpointId}`);
    })

    afterEach(async () => {
        vi.useRealTimers();

        await redisClient.del(`circuit:${endpointId}`);
    })

    afterAll(async () => {
        await redisClient.quit();
    })
    it('closed -> after failureThreshold -> open -> cooldown passed and failed -> open', async () => {
        // By default the circuit should be closed
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(true);

        for (let i = 0; i < CIRCUIT_CONFIG.failureThreshold; i++) {
            await recordFailure(redisClient, endpointId);
        }
        // now the circuit should be closed
        expect(await getCircuitState(redisClient, endpointId)).toBe('open');
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(false);

        // after cooldown seconds
        vi.advanceTimersByTime(CIRCUIT_CONFIG.cooldownSeconds * 1000);

        // now should be half-open
        expect(await getCircuitState(redisClient, endpointId)).toBe('half-open');
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(true);

        await recordFailure(redisClient, endpointId);
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(false);
    })

    it('closed -> after failureThreshold -> open -> cooldown passed and passed -> closed', async () => {
        // By default the circuit should be closed
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(true);

        for (let i = 0; i < CIRCUIT_CONFIG.failureThreshold; i++) {
            await recordFailure(redisClient, endpointId);
        }
        // now the circuit should be closed
        expect(await getCircuitState(redisClient, endpointId)).toBe('open');
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(false);

        // after cooldown seconds
        vi.advanceTimersByTime(CIRCUIT_CONFIG.cooldownSeconds * 1000);

        // now should be half-open
        expect(await getCircuitState(redisClient, endpointId)).toBe('half-open');
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(true);

        await recordSuccess(redisClient, endpointId);
        expect(await isRequestAllowed(redisClient, endpointId)).toBe(true);
    })
});