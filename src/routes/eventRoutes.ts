import { Router } from "express";
import { handleEvents } from "../controller/eventController.js";
import { getAllEventAttempts } from "../controller/auditController.js";

const router = Router();

router.post("/", handleEvents);
router.get("/:id/attempts", getAllEventAttempts);

export default router;