import {
    createItem as createItemService,
    deleteItem as deleteItemService,
    getItem as getItemService,
    listItems as listItemsService,
    reorderItems as reorderItemsService,
    toggleHidden as toggleHiddenService,
    toggleOutOfStock as toggleOutOfStockService,
    updateItem as updateItemService
} from "../services/item.service.js";

const requestContext = (req) => ({
    route: req.originalUrl,
    method: req.method,
    accountId: req.user?._id?.toString(),
    bakeryId: req.user?.bakery?.toString(),
    requestId: req.id || req.headers["x-request-id"]
});

const logRequest = (method, message, req) => console.log("[Item][" + method + "] " + message, requestContext(req));

const sendError = (res, method, req, startedAt, error) => {
    const status = error.statusCode || 500;
    console.error("[Item][" + method + "] Failed (" + status + ")", { ...requestContext(req), message: error.message, stack: error.stack });
    console.log("[Item][" + method + "] Completed in " + (Date.now() - startedAt) + " ms", requestContext(req));
    return res.status(status).json({ success: false, message: status === 500 ? "Internal server error" : error.message, errors: error.errors || [] });
};

const sendSuccess = (res, method, req, startedAt, status, message, data) => {
    console.log("[Item][" + method + "] Success (" + status + ")", requestContext(req));
    console.log("[Item][" + method + "] Completed in " + (Date.now() - startedAt) + " ms", requestContext(req));
    return res.status(status).json({ success: true, message, data });
};

export const createItem = async (req, res) => {
    const startedAt = Date.now();
    logRequest("POST", "Create request received", req);
    console.log("[Item][POST] Validated request body", req.body);
    try {
        const item = await createItemService(req.user.bakery, req.body);
        return sendSuccess(res, "POST", req, startedAt, 201, "Item created successfully", item);
    } catch (error) {
        return sendError(res, "POST", req, startedAt, error);
    }
};

export const listItems = async (req, res) => {
    const startedAt = Date.now();
    logRequest("GET", "Listing items", req);
    try {
        const result = await listItemsService(req.user.bakery, req.itemQuery);
        return sendSuccess(res, "GET", req, startedAt, 200, "Items loaded successfully", result);
    } catch (error) {
        return sendError(res, "GET", req, startedAt, error);
    }
};

export const getItem = async (req, res) => {
    const startedAt = Date.now();
    logRequest("GET", "Get item request received", req);
    try {
        const item = await getItemService(req.user.bakery, req.params.id);
        return sendSuccess(res, "GET", req, startedAt, 200, "Item loaded successfully", item);
    } catch (error) {
        return sendError(res, "GET", req, startedAt, error);
    }
};

export const updateItem = async (req, res) => {
    const startedAt = Date.now();
    logRequest("PATCH", "Updating item", req);
    console.log("[Item][PATCH] Validated request body", req.body);
    try {
        const item = await updateItemService(req.user.bakery, req.params.id, req.body);
        return sendSuccess(res, "PATCH", req, startedAt, 200, "Item updated successfully", item);
    } catch (error) {
        return sendError(res, "PATCH", req, startedAt, error);
    }
};

export const deleteItem = async (req, res) => {
    const startedAt = Date.now();
    logRequest("DELETE", "Delete request", req);
    try {
        await deleteItemService(req.user.bakery, req.params.id);
        return sendSuccess(res, "DELETE", req, startedAt, 200, "Item deleted successfully", {});
    } catch (error) {
        return sendError(res, "DELETE", req, startedAt, error);
    }
};

export const toggleOutOfStock = async (req, res) => {
    const startedAt = Date.now();
    logRequest("PATCH", "Toggle out-of-stock request received", req);
    try {
        const item = await toggleOutOfStockService(req.user.bakery, req.params.id);
        return sendSuccess(res, "PATCH", req, startedAt, 200, "Item out-of-stock status updated successfully", item);
    } catch (error) {
        return sendError(res, "PATCH", req, startedAt, error);
    }
};

export const toggleHidden = async (req, res) => {
    const startedAt = Date.now();
    logRequest("PATCH", "Toggle hide request received", req);
    try {
        const item = await toggleHiddenService(req.user.bakery, req.params.id);
        return sendSuccess(res, "PATCH", req, startedAt, 200, "Item visibility updated successfully", item);
    } catch (error) {
        return sendError(res, "PATCH", req, startedAt, error);
    }
};

export const reorderItems = async (req, res) => {
    const startedAt = Date.now();
    logRequest("PATCH", "Reorder request received", req);
    console.log("[Item][PATCH] Validated request body", req.body);
    try {
        await reorderItemsService(req.user.bakery, req.body);
        return sendSuccess(res, "PATCH", req, startedAt, 200, "Items reordered successfully", {});
    } catch (error) {
        return sendError(res, "PATCH", req, startedAt, error);
    }
};
