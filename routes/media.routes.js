import { Router } from "express";
import { createMedia, deleteMedia, getMedia, listMedia } from "../controllers/media.controller.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { uploadMedia } from "../middleware/upload.middleware.js";
import { validateMediaId, validateMediaList, validateMediaUpload } from "../validators/media.validator.js";

const router = Router();

router.post("/", authenticate, uploadMedia, validateMediaUpload, createMedia);
router.get("/", authenticate, validateMediaList, listMedia);
router.get("/:id", authenticate, validateMediaId, getMedia);
router.delete("/:id", authenticate, validateMediaId, deleteMedia);

export default router;
