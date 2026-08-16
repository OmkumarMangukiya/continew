import { describe, it, expect } from "vitest";
import { signPayload } from "../src/core/hmac.js";

// Regression test: Ensures signPayload remains pure and deterministic.
// Prevents accidental side-effects (like timestamps or salting) in future refactors.

describe('HMAC Signing', () => {
    const secret = 'test-secret-key-123';
    const payload = JSON.stringify({ event: 'order.created', amount: 100 });

    it('produces a deterministic signature for identical inputs', () => {
        const sig1 = signPayload(secret, payload);
        const sig2 = signPayload(secret, payload);

        expect(sig1).toBe(sig2);
    });

    it('produces differnet signatures for different payloads', () => {
        const sig1 = signPayload(secret, payload);
        const sig2 = signPayload(secret, JSON.stringify({ event: 'order.created', amount: 200 }));

        expect(sig1).not.toBe(sig2)
    });

    it('produces different signatures for different secrets (key sensitivity)', () => {
        const sig1 = signPayload('secret-a', payload);
        const sig2 = signPayload('secret-b', payload);
        expect(sig1).not.toBe(sig2);
    });
})