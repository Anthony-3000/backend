import mongoose from "mongoose";

const validationError = (errors) => {
    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.errors = errors;
    return error;
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isValidObjectId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);
const createFields = ["name", "tagline", "image", "categoryBadges", "displayOrder"];
const updateFields = [...createFields, "active"];

const validateBadges = (badges, errors) => {
    if (!Array.isArray(badges)) {
        errors.push("categoryBadges must be an array");
        return;
    }

    badges.forEach((badge, index) => {
        if (!isPlainObject(badge)) {
            errors.push("categoryBadges[" + index + "] must be an object");
            return;
        }

        for (const field of ["name", "color", "icon"]) {
            if (field in badge && typeof badge[field] !== "string") {
                errors.push("categoryBadges[" + index + "]." + field + " must be a string");
            }
        }
    });
};

const validateCategoryBody = (body, allowedFields, requireName) => {
    if (!isPlainObject(body)) throw validationError(["Request body must be an object"]);

    const errors = [];
    const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
    if (unknownFields.length) errors.push("Unsupported fields: " + unknownFields.join(", "));
    if (requireName && !("name" in body)) errors.push("name is required");
    if ("name" in body && (typeof body.name !== "string" || !body.name.trim())) errors.push("name must be a non-empty string");
    if ("tagline" in body && typeof body.tagline !== "string") errors.push("tagline must be a string");
    if ("image" in body && !isValidObjectId(body.image)) errors.push("image must be a valid MongoDB ObjectId");
    if ("displayOrder" in body && !Number.isFinite(body.displayOrder)) errors.push("displayOrder must be a number");
    if ("categoryBadges" in body) validateBadges(body.categoryBadges, errors);
    if ("active" in body && typeof body.active !== "boolean") errors.push("active must be a boolean");
    if (!requireName && !Object.keys(body).length) errors.push("At least one field is required");
    if (errors.length) throw validationError(errors);
};

const handleValidation = (label, req, res, next, validator) => {
    try {
        validator();
        next();
    } catch (error) {
        console.warn("[Category][" + label + "] Validation failed", { errors: error.errors || [error.message] });
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Validation failed", errors: error.errors || [] });
    }
};

export const validateCategoryCreate = (req, res, next) => handleValidation("POST", req, res, next, () => validateCategoryBody(req.body, createFields, true));
export const validateCategoryUpdate = (req, res, next) => handleValidation("PATCH", req, res, next, () => validateCategoryBody(req.body, updateFields, false));

export const validateCategoryId = (req, res, next) => {
    if (!isValidObjectId(req.params.id)) {
        const errors = ["id must be a valid MongoDB ObjectId"];
        console.warn("[Category][" + req.method + "] Validation failed", { errors });
        return res.status(400).json({ success: false, message: "Invalid category id", errors });
    }
    next();
};

export const validateCategoryList = (req, res, next) => {
    const { page = "1", limit = "20", search } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const errors = [];
    if (!Number.isInteger(pageNumber) || pageNumber < 1) errors.push("page must be a positive integer");
    if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) errors.push("limit must be an integer between 1 and 100");
    if (search !== undefined && typeof search !== "string") errors.push("search must be a string");
    if (errors.length) {
        console.warn("[Category][GET] Validation failed", { errors });
        return res.status(400).json({ success: false, message: "Validation failed", errors });
    }
    req.categoryQuery = { page: pageNumber, limit: limitNumber, search: search?.trim() };
    next();
};

export const validateCategoryReorder = (req, res, next) => {
    try {
        if (!Array.isArray(req.body) || !req.body.length) throw validationError(["Request body must be a non-empty array"]);
        const errors = [];
        const ids = new Set();
        req.body.forEach((entry, index) => {
            if (!isPlainObject(entry)) return errors.push("reorder entry " + index + " must be an object");
            if (!isValidObjectId(entry.id)) errors.push("reorder entry " + index + ".id must be a valid MongoDB ObjectId");
            if (!Number.isFinite(entry.displayOrder)) errors.push("reorder entry " + index + ".displayOrder must be a number");
            if (ids.has(entry.id)) errors.push("Duplicate category id: " + entry.id);
            ids.add(entry.id);
        });
        if (errors.length) throw validationError(errors);
        next();
    } catch (error) {
        console.warn("[Category][PATCH] Validation failed", { errors: error.errors || [error.message] });
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Validation failed", errors: error.errors || [] });
    }
};
