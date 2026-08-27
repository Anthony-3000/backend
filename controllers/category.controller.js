import {
    createCategory as createCategoryService,
    deleteCategory as deleteCategoryService,
    getCategory as getCategoryService,
    listCategories as listCategoriesService,
    reorderCategories as reorderCategoriesService,
    updateCategory as updateCategoryService
} from "../services/category.service.js";

const logAccount = (method, message, req) => console.log("[Category][" + method + "] " + message, {
    accountId: req.user?._id?.toString(),
    bakeryId: req.user?.bakery?.toString()
});

const sendError = (res, method, error) => {
    const status = error.statusCode || 500;
    console.error("[Category][" + method + "] Failed (" + status + ")", { message: error.message, stack: error.stack });
    return res.status(status).json({
        success: false,
        message: status === 500 ? "Internal server error" : error.message,
        errors: error.errors || []
    });
};

export const createCategory = async (req, res) => {
    logAccount("POST", "Create request received", req);
    console.log("[Category][POST] Validated request body", req.body);
    try {
        const category = await createCategoryService(req.user.bakery, req.body);
        console.log("[Category][POST] Success (201)", { categoryId: category._id.toString() });
        return res.status(201).json({ success: true, message: "Category created successfully", data: category });
    } catch (error) {
        return sendError(res, "POST", error);
    }
};

export const listCategories = async (req, res) => {
    logAccount("GET", "List request received", req);
    console.log("[Category][GET] Validated query", req.categoryQuery);
    try {
        const result = await listCategoriesService(req.user.bakery, req.categoryQuery);
        console.log("[Category][GET] Success (200)");
        return res.status(200).json({ success: true, message: "Categories loaded successfully", data: result });
    } catch (error) {
        return sendError(res, "GET", error);
    }
};

export const getCategory = async (req, res) => {
    logAccount("GET", "Get request received", req);
    try {
        const category = await getCategoryService(req.user.bakery, req.params.id);
        console.log("[Category][GET] Success (200)", { categoryId: category._id.toString() });
        return res.status(200).json({ success: true, message: "Category loaded successfully", data: category });
    } catch (error) {
        return sendError(res, "GET", error);
    }
};

export const updateCategory = async (req, res) => {
    logAccount("PATCH", "Update request received", req);
    console.log("[Category][PATCH] Validated request body", req.body);
    try {
        const category = await updateCategoryService(req.user.bakery, req.params.id, req.body);
        console.log("[Category][PATCH] Success (200)", { categoryId: category._id.toString() });
        return res.status(200).json({ success: true, message: "Category updated successfully", data: category });
    } catch (error) {
        return sendError(res, "PATCH", error);
    }
};

export const deleteCategory = async (req, res) => {
    logAccount("DELETE", "Delete request received", req);
    try {
        await deleteCategoryService(req.user.bakery, req.params.id);
        console.log("[Category][DELETE] Success (200)");
        return res.status(200).json({ success: true, message: "Category deleted successfully", data: {} });
    } catch (error) {
        return sendError(res, "DELETE", error);
    }
};

export const reorderCategories = async (req, res) => {
    logAccount("PATCH", "Reorder request received", req);
    console.log("[Category][PATCH] Validated request body", req.body);
    try {
        await reorderCategoriesService(req.user.bakery, req.body);
        console.log("[Category][PATCH] Success (200)");
        return res.status(200).json({ success: true, message: "Categories reordered successfully", data: {} });
    } catch (error) {
        return sendError(res, "PATCH", error);
    }
};
