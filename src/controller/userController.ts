/*
Register , Login

Register ->  email -> otp -> redis store -> otp verify -> username , password , email -> user create
*/

import { Request, Response } from "express"
import { registerUserSchema } from "../core/zod.js";
import bcrypt from "bcrypt";
import { db } from "../core/db.js";
import jwt from "jsonwebtoken";

export const registerUser = async (req : Request, res : Response) =>{

    const parsedData = registerUserSchema.safeParse(req.body);
    if(!parsedData.success){
        return res.status(400).send({message : "Fields are missing"});
    }

    const {email, password, username} = parsedData.data;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
        `INSERT INTO users (email, password, username)
        VALUES ($1, $2, $3) RETURNING id, email, username`,
        [email, hashedPassword, username]
    );

    const user = result.rows[0];

    // Ensure the JWT secret is defined to fix the TypeScript error
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return res.status(500).json({ message: "Internal server error: JWT secret is not configured." });
    }

    const refreshToken = jwt.sign(
        {userId : user.id},
        jwtSecret,
        {expiresIn : "7d"} // Refresh tokens usually have a longer lifespan (e.g. 7 days)
    );

    // Set the refresh token in an HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true, // Prevents client-side scripts from accessing the cookie (mitigates XSS)
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'strict', // Prevents cross-site request forgery (CSRF)
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    const accessToken = jwt.sign(
        { userId: user.id },
        jwtSecret,
        { expiresIn: "15m" }
    );

    // Send the access token and user info in the JSON response body
    return res.status(201).json({
        message: "User registered successfully",
        user,
        accessToken
    });
}