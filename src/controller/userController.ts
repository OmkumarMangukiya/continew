/*
For Registration:
                1. user sends {emai} and we send them a otp using `sendOtp`
                2. user gets the otp from the mail and we verify it using `verifyOtp`
                3. Finally user types email and password and we create the user
                4. We send user the access token and refresh token (by setting it in cookie)
For Login:
         1. User types email and password and we verify in db.
         2. If credentials are true then we set the access token and refresh token and send it to user.
*/

import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../core/db.js";
import { redis } from "../core/redis.js";
import { sendOtpEmail } from "../core/mailer.js";
import {
    sendOtpSchema,
    verifyOtpSchema,
    registerUserSchema,
    loginUserSchema
} from "../core/zod.js";
import { User } from "../core/type.js";

const JWT_SECRET = process.env.JWT_SECRET || "continew-default-secret";

const COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
};

// 1. Send OTP to email
export const sendOtp = async (req: Request, res: Response) => {
    try {
        const parsed = sendOtpSchema.safeParse(req.body); // make sure we have valid email
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid email address", errors: parsed.error.issues });
        }

        const { email } = parsed.data;

        // Check if user is already registered
        const existingUser = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        // Check resend cooldown in Redis (60 seconds)
        const cooldownKey = `otp:cooldown:${email}`;
        const isInCooldown = await redis.get(cooldownKey);
        if (isInCooldown) {
            const ttl = await redis.ttl(cooldownKey);
            return res.status(429).json({ message: `Please wait ${ttl} seconds before requesting a new OTP` });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store in Redis (TTL: 5 minutes = 300 seconds)
        await redis.set(`otp:${email}`, otp, "EX", 300);

        // Set 60-second resend cooldown
        await redis.set(cooldownKey, "1", "EX", 60);

        // Send email via Nodemailer
        const emailSent = await sendOtpEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({ message: "Failed to send verification email" });
        }

        return res.status(200).json({ message: "Verification OTP sent to your email" });
    } catch (error) {
        console.error("Error in sendOtp:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Verify OTP
export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const parsed = verifyOtpSchema.safeParse(req.body); // {email, otp}
        if (!parsed.success) {
            return res.status(400).json({ message: "Email and 6-digit OTP are required", errors: parsed.error.issues });
        }

        const { email, otp } = parsed.data;

        // Rate limit verification attempts in Redis (max 5 attempts per minute per email)
        const attemptsKey = `otp:attempts:${email}`;
        const attempts = await redis.incr(attemptsKey);
        if (attempts === 1) {
            await redis.expire(attemptsKey, 60);
        }
        if (attempts > 5) {
            return res.status(429).json({ message: "Too many failed attempts. Please wait 1 minute before trying again." });
        }

        // Fetch stored OTP
        const storedOtp = await redis.get(`otp:${email}`);
        if (!storedOtp) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        if (storedOtp !== otp) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        // Email successfully verified - set verified flag in Redis (TTL: 10 minutes)
        await redis.set(`otp:verified:${email}`, "1", "EX", 600);

        // Clean up OTP and attempts keys
        await redis.del(`otp:${email}`, attemptsKey);

        return res.status(200).json({ message: "Email verified successfully. You may now complete registration." });
    } catch (error) {
        console.error("Error in verifyOtp:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Register user (only after email is verified)
export const registerUser = async (req: Request, res: Response) => {
    try {
        const parsed = registerUserSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid registration data", errors: parsed.error.issues });
        }

        const { email, password, username } = parsed.data;

        // Check if email was verified in Redis
        const verifiedKey = `otp:verified:${email}`;
        const isVerified = await redis.get(verifiedKey);
        if (!isVerified) {
            return res.status(403).json({ message: "Email has not been verified. Please verify with OTP first." });
        }

        // Check if username is already taken
        const existingUsername = await db.query("SELECT id FROM users WHERE username = $1", [username]);
        if (existingUsername.rows.length > 0) {
            return res.status(409).json({ message: "Username is already taken" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();

        // Insert new user into database
        const result = await db.query(
            `INSERT INTO users (id, email, password_hash, username)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, username, created_at`,
            [userId, email, hashedPassword, username]
        );

        const newUser: User = result.rows[0];

        // Consume the verification token
        await redis.del(verifiedKey);

        // Generate tokens
        const accessToken = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: "7d" });

        // Set httpOnly cookies
        res.cookie("accessToken", accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie("refreshToken", refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username
            }
        });
    } catch (error) {
        console.error("Error in registerUser:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Login user
export const loginUser = async (req: Request, res: Response) => {
    try {
        const parsed = loginUserSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Email and password are required", errors: parsed.error.issues });
        }

        const { email, password } = parsed.data;

        // Fetch user from DB
        const result = await db.query(
            "SELECT id, email, username, password_hash FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = result.rows[0];

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Generate tokens
        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

        // Set httpOnly cookies
        res.cookie("accessToken", accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie("refreshToken", refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return res.status(200).json({
            message: "Logged in successfully",
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (error) {
        console.error("Error in loginUser:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. Refresh access token
export const refreshToken = async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ message: "Refresh token missing. Please log in." });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

        const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: "15m" });

        res.cookie("accessToken", newAccessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000
        });

        return res.status(200).json({ message: "Access token refreshed successfully" });
    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
};

// 6. Logout user
export const logoutUser = async (req: Request, res: Response) => {
    res.clearCookie("accessToken", COOKIE_OPTIONS);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    return res.status(200).json({ message: "Logged out successfully" });
};