/*
Test file to test the backoff system of queue
*/

import { backoffCalculation } from "../src/worker/index.js"
import { describe, it, expect } from "vitest";

describe('Webhook Exponential Backoff', async () => {

    it('returns 1 second after 1st', () => {
        expect(backoffCalculation(1, "customWebhookbackoff")).toBe(1000);
    })
    it("returns 5 seconds after 2nd failure", () => {
        expect(backoffCalculation(2, "customWebhookbackoff")).toBe(5000);
    });
    it("returns 15 seconds after 3rd failure", () => {
        expect(backoffCalculation(3, "customWebhookbackoff")).toBe(15000);
    });
    it("returns 30 seconds after 4th failure", () => {
        expect(backoffCalculation(4, "customWebhookbackoff")).toBe(30000);
    });
    it("returns 5 minutes after 5th failure", () => {
        expect(backoffCalculation(5, "customWebhookbackoff")).toBe(300000);
    });
    it("returns 1 hour after 6th failure", () => {
        expect(backoffCalculation(6, "customWebhookbackoff")).toBe(3600000);
    });
    it("returns -1 for unknown backoff types", () => {
        expect(backoffCalculation(1, "unknownStrategy")).toBe(-1);
    });
});

