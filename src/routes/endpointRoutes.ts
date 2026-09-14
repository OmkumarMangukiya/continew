import { Router } from "express";
import { handleEndpoint } from "../controller/endpointController.js";
import {
    getAllEndpoints,
    getEndpointDetails,
    getAllEndpointAttempts
} from "../controller/auditController.js";

const router = Router();

router.post("/", handleEndpoint);
router.get("/", getAllEndpoints);
router.get("/:id", getEndpointDetails);
router.get("/:id/attempts", getAllEndpointAttempts);

export default router;