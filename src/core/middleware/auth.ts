// Middleware which authenticate the user at every request
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    userId: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken;

    if (!token) {
        return res.status(401).json({ message: "Access token missing. Please log in." });
    }

    const jwtSecret = process.env.JWT_SECRET || "somesecret";

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        req.user = { userId: decoded.userId };
        return next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired access token" });
    }
};
