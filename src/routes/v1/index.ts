import { Router } from "express";
import userRoutes from "../userRoutes.js";
import endpointRoutes from "../endpointRoutes.js";
import eventRoutes from "../eventRoutes.js";
import auditRoutes from "../auditRoutes.js";

const v1Router = Router();

// Modular domain routes
v1Router.use("/users", userRoutes);
v1Router.use("/endpoints", endpointRoutes);
v1Router.use("/events", eventRoutes);
v1Router.use("/audit", auditRoutes);

export default v1Router;
