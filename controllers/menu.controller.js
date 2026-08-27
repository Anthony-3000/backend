import {
    getBakeryMenu as getBakeryMenuService,
    getCategoryItems as getCategoryItemsService,
    getMenuCategories as getMenuCategoriesService,
    getMenuItem as getMenuItemService
} from "../services/menu.service.js";

const context = (req) => ({ route: req.originalUrl, method: req.method, bakerySlug: req.params.bakerySlug, requestId: req.id || req.headers["x-request-id"] });

const sendError = (res, req, startedAt, error) => {
    const status = error.statusCode || 500;
    console.error("[Menu][GET] Failed (" + status + ")", { ...context(req), message: error.message, stack: error.stack });
    console.log("[Menu][GET] Completed in " + (Date.now() - startedAt) + " ms", context(req));
    return res.status(status).json({ success: false, message: status === 500 ? "Internal server error" : error.message, errors: error.errors || [] });
};

const sendSuccess = (res, req, startedAt, message, data, details = {}) => {
    console.log("[Menu][GET] " + message, { ...context(req), ...details });
    console.log("[Menu][GET] Completed in " + (Date.now() - startedAt) + " ms", context(req));
    return res.status(200).json({ success: true, message, data });
};

export const getBakeryMenu = async (req, res) => {
    const startedAt = Date.now();
    console.log("[Menu][GET] Loading bakery", context(req));
    try {
        const bakery = await getBakeryMenuService(req.params.bakerySlug);
        return sendSuccess(res, req, startedAt, "Bakery menu loaded successfully", bakery);
    } catch (error) {
        return sendError(res, req, startedAt, error);
    }
};

export const getMenuCategories = async (req, res) => {
    const startedAt = Date.now();
    console.log("[Menu][GET] Loading categories", context(req));
    try {
        const categories = await getMenuCategoriesService(req.params.bakerySlug);
        return sendSuccess(res, req, startedAt, "Categories loaded successfully", categories, { categoryCount: categories.length });
    } catch (error) {
        return sendError(res, req, startedAt, error);
    }
};

export const getCategoryItems = async (req, res) => {
    const startedAt = Date.now();
    console.log("[Menu][GET] Loading items", { ...context(req), categorySlug: req.params.categorySlug });
    try {
        const items = await getCategoryItemsService(req.params.bakerySlug, req.params.categorySlug);
        return sendSuccess(res, req, startedAt, "Items loaded successfully", items, { itemCount: items.length });
    } catch (error) {
        return sendError(res, req, startedAt, error);
    }
};

export const getMenuItem = async (req, res) => {
    const startedAt = Date.now();
    console.log("[Menu][GET] Loading item", { ...context(req), itemSlug: req.params.itemSlug });
    try {
        const item = await getMenuItemService(req.params.bakerySlug, req.params.itemSlug);
        return sendSuccess(res, req, startedAt, "Item loaded successfully", item, { itemCount: 1 });
    } catch (error) {
        return sendError(res, req, startedAt, error);
    }
};
