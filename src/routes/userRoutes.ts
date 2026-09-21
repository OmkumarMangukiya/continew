import { Router } from "express";
import {
    sendOtp,
    verifyOtp,
    registerUser,
    loginUser,
    refreshToken,
    logoutUser,
    getMe
} from "../controller/userController.js";
import { authenticateToken } from "../core/middleware/auth.js";

const router = Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.post("/logout", logoutUser);
router.get("/me", authenticateToken, getMe);

export default router;
