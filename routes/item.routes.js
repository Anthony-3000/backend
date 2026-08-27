import { Router } from "express";
import {
    createItem,
    deleteItem,
    getItem,
    listItems,
    reorderItems,
    toggleHidden,
    toggleOutOfStock,
    updateItem
} from "../controllers/item.controller.js";
import { authenticate } from "../middleware/authMiddleware.js";
import {
    validateItemCreate,
    validateItemId,
    validateItemList,
    validateItemReorder,
    validateItemUpdate
} from "../validators/item.validator.js";

const router = Router();

router.post("/", authenticate, validateItemCreate, createItem);
router.get("/", authenticate, validateItemList, listItems);
router.patch("/reorder", authenticate, validateItemReorder, reorderItems);
router.patch("/:id/out-of-stock", authenticate, validateItemId, toggleOutOfStock);
router.patch("/:id/hide", authenticate, validateItemId, toggleHidden);
router.get("/:id", authenticate, validateItemId, getItem);
router.patch("/:id", authenticate, validateItemId, validateItemUpdate, updateItem);
router.delete("/:id", authenticate, validateItemId, deleteItem);

export default router;
