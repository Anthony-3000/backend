import { Router } from "express";
import {
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    reorderCategories,
    updateCategory
} from "../controllers/category.controller.js";
import { authenticate } from "../middleware/authMiddleware.js";
import {
    validateCategoryCreate,
    validateCategoryId,
    validateCategoryList,
    validateCategoryReorder,
    validateCategoryUpdate
} from "../validators/category.validator.js";

const router = Router();

router.post("/", authenticate, validateCategoryCreate, createCategory);
router.get("/", authenticate, validateCategoryList, listCategories);
router.patch("/reorder", authenticate, validateCategoryReorder, reorderCategories);
router.get("/:id", authenticate, validateCategoryId, getCategory);
router.patch("/:id", authenticate, validateCategoryId, validateCategoryUpdate, updateCategory);
router.delete("/:id", authenticate, validateCategoryId, deleteCategory);

export default router;
