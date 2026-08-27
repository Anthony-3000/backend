import { Router } from "express";
import { getBakeryMenu, getCategoryItems, getMenuCategories, getMenuItem } from "../controllers/menu.controller.js";

const router = Router();

router.get("/:bakerySlug/categories/:categorySlug/items", getCategoryItems);
router.get("/:bakerySlug/categories", getMenuCategories);
router.get("/:bakerySlug/items/:itemSlug", getMenuItem);
router.get("/:bakerySlug", getBakeryMenu);

export default router;
