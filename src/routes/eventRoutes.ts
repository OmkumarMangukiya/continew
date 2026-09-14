import { Router } from "express";
import { handleEvents } from "../controller/eventController.js";

const router = Router();

router.post("/", handleEvents);

export default router;