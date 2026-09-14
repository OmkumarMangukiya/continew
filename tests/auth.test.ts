import { describe, it, expect } from "vitest";
import {
    sendOtpSchema,
    verifyOtpSchema,
    registerUserSchema,
    loginUserSchema
} from "../src/core/zod.js";

describe("Auth Validation Schemas", () => {
    describe("sendOtpSchema", () => {
        it("accepts valid email", () => {
            const res = sendOtpSchema.safeParse({ email: "user@example.com" });
            expect(res.success).toBe(true);
        });

        it("rejects invalid email", () => {
            const res = sendOtpSchema.safeParse({ email: "not-an-email" });
            expect(res.success).toBe(false);
        });
    });

    describe("verifyOtpSchema", () => {
        it("accepts valid 6-digit OTP", () => {
            const res = verifyOtpSchema.safeParse({ email: "user@example.com", otp: "123456" });
            expect(res.success).toBe(true);
        });

        it("rejects OTP with length != 6", () => {
            const res1 = verifyOtpSchema.safeParse({ email: "user@example.com", otp: "123" });
            const res2 = verifyOtpSchema.safeParse({ email: "user@example.com", otp: "1234567" });
            expect(res1.success).toBe(false);
            expect(res2.success).toBe(false);
        });
    });

    describe("registerUserSchema", () => {
        it("accepts valid registration payload", () => {
            const res = registerUserSchema.safeParse({
                email: "user@example.com",
                username: "testuser",
                password: "password123"
            });
            expect(res.success).toBe(true);
        });

        it("rejects password shorter than 8 characters", () => {
            const res = registerUserSchema.safeParse({
                email: "user@example.com",
                username: "testuser",
                password: "123"
            });
            expect(res.success).toBe(false);
        });

        it("rejects username shorter than 3 characters", () => {
            const res = registerUserSchema.safeParse({
                email: "user@example.com",
                username: "ab",
                password: "password123"
            });
            expect(res.success).toBe(false);
        });
    });

    describe("loginUserSchema", () => {
        it("accepts valid login payload", () => {
            const res = loginUserSchema.safeParse({
                email: "user@example.com",
                password: "password123"
            });
            expect(res.success).toBe(true);
        });

        it("rejects missing fields", () => {
            const res = loginUserSchema.safeParse({
                email: "user@example.com"
            });
            expect(res.success).toBe(false);
        });
    });
});
