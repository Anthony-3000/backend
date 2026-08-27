import { Router } from "express";
import { getBakery, updateBakery } from "../controllers/bakery.controller.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validateBakeryUpdate } from "../validators/bakery.validator.js";

const router = Router();
router.get("/", authenticate, getBakery);
router.patch("/", authenticate, validateBakeryUpdate, updateBakery);

export default router;
