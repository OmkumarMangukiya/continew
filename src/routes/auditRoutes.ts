import { Router } from "express";
import { authenticateToken } from "../core/middleware/auth.js";
import {
    getAllEndpointAttempts,
    getAllEventAttempts
} from "../controller/auditController.js";

const router = Router();

// Protect audit routes with authentication
router.use(authenticateToken);

// Audit routes for delivery attempts
router.get("/endpoints/:id/attempts", getAllEndpointAttempts);
router.get("/events/:id/attempts", getAllEventAttempts);

export default router;