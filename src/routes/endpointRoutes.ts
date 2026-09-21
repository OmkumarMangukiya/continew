import { Router } from "express";
import { authenticateToken } from "../core/middleware/auth.js";
import {
    createEndpoint,
    getAllEndpoints,
    getEndpointDetails,
    toggleEndpoint
} from "../controller/endpointController.js";

const router = Router();

// Protect all endpoint routes with cookie authentication
router.use(authenticateToken);

router.post("/", createEndpoint);
router.get("/", getAllEndpoints);
router.get("/:id", getEndpointDetails);
router.patch("/:id/toggle", toggleEndpoint);

export default router;