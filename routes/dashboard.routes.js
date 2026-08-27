import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", authenticate, getDashboard);

export default router;
