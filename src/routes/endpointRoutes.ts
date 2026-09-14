import { Router } from "express";
import { authenticateToken } from "../core/middleware/auth.js";
import {
    handleEndpoint,
    getAllEndpoints,
    getEndpointDetails
} from "../controller/endpointController.js";

const router = Router();

// Protect all endpoint routes with cookie authentication
router.use(authenticateToken);

router.post("/", handleEndpoint);
router.get("/", getAllEndpoints);
router.get("/:id", getEndpointDetails);

export default router;