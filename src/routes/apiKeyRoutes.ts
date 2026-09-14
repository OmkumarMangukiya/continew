import { Router } from "express";
import { authenticateToken } from "../core/middleware/auth.js";
import {
    createApiKey,
    getAllApiKeys,
    toggleApiKey,
    deleteApiKey
} from "../controller/apiKeyController.js";

const router = Router();

// Protect all API key routes with cookie authentication
router.use(authenticateToken);

router.post("/", createApiKey);
router.get("/", getAllApiKeys);
router.patch("/:id/toggle", toggleApiKey);
router.delete("/:id", deleteApiKey);

export default router;