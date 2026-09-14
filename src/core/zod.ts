import { z } from "zod";

export const registerUserSchema = z.object({
    email: z.email(),
    password: z.string().min(8).max(20),
    username: z.string().min(3).max(15)
});

export const loginUserSchema = z.object({
    email: z.email(),
    password: z.string().min(8).max(20)
});

export const sendOtpSchema = z.object({
    email: z.email()
});

export const verifyOtpSchema = z.object({
    email: z.email(),
    otp: z.string().length(6, "OTP must be exactly 6 digits")
});