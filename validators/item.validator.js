import mongoose from "mongoose";

const validationError = (errors) => {
    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.errors = errors;
    return error;
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isValidObjectId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);
const createFields = ["category", "name", "description", "price", "media", "badges", "details", "weight", "displayOrder"];
const updateFields = [...createFields, "hidden", "outOfStock"];

const logValidation = (method, event, payload) => console.log("[Item][" + method + "] Validation " + event, payload);

const validateBadges = (badges, errors) => {
    if (!Array.isArray(badges)) return errors.push("badges must be an array");
    badges.forEach((badge, index) => {
        if (!isPlainObject(badge)) return errors.push("badges[" + index + "] must be an object");
        for (const field of ["name", "color", "icon"]) {
            if (field in badge && typeof badge[field] !== "string") errors.push("badges[" + index + "]." + field + " must be a string");
        }
    });
};

const validateItemBody = (body, allowedFields, requiredFields) => {
    if (!isPlainObject(body)) throw validationError(["Request body must be an object"]);

    const errors = [];
    const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
    if (unknownFields.length) errors.push("Unsupported fields: " + unknownFields.join(", "));
    requiredFields.forEach((field) => {
        if (!(field in body)) errors.push(field + " is required");
    });
    if ("category" in body && !isValidObjectId(body.category)) errors.push("category must be a valid MongoDB ObjectId");
    if ("name" in body && (typeof body.name !== "string" || !body.name.trim())) errors.push("name must be a non-empty string");
    if ("description" in body && typeof body.description !== "string") errors.push("description must be a string");
    if ("price" in body && (!Number.isFinite(body.price) || body.price <= 0)) errors.push("price must be a positive number");
    if ("media" in body) {
        if (!Array.isArray(body.media)) {
            errors.push("media must be an array of MongoDB ObjectIds");
        } else {
            body.media.forEach((mediaId, index) => {
                if (!isValidObjectId(mediaId)) errors.push("media[" + index + "] must be a valid MongoDB ObjectId");
            });
            if (new Set(body.media).size !== body.media.length) errors.push("media must not contain duplicate ids");
        }
    }
    if ("badges" in body) validateBadges(body.badges, errors);
    if ("details" in body && (!Array.isArray(body.details) || body.details.some((detail) => typeof detail !== "string"))) errors.push("details must be an array of strings");
    if ("weight" in body && typeof body.weight !== "string") errors.push("weight must be a string");
    if ("displayOrder" in body && !Number.isFinite(body.displayOrder)) errors.push("displayOrder must be a number");
    if ("hidden" in body && typeof body.hidden !== "boolean") errors.push("hidden must be a boolean");
    if ("outOfStock" in body && typeof body.outOfStock !== "boolean") errors.push("outOfStock must be a boolean");
    if (!requiredFields.length && !Object.keys(body).length) errors.push("At least one field is required");
    if (errors.length) throw validationError(errors);
};

const validate = (method, validation) => (req, res, next) => {
    logValidation(method, "started", { route: req.originalUrl });
    try {
        validation(req);
        logValidation(method, "completed", { route: req.originalUrl });
        next();
    } catch (error) {
        console.warn("[Item][" + method + "] Validation failed", { errors: error.errors || [error.message] });
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Validation failed", errors: error.errors || [] });
    }
};

export const validateItemCreate = validate("POST", (req) => validateItemBody(req.body, createFields, ["category", "name", "price"]));
export const validateItemUpdate = validate("PATCH", (req) => validateItemBody(req.body, updateFields, []));

export const validateItemId = validate("REQUEST", (req) => {
    if (!isValidObjectId(req.params.id)) throw validationError(["id must be a valid MongoDB ObjectId"]);
});

export const validateItemList = validate("GET", (req) => {
    const { page = "1", limit = "20", search, category, hidden, outOfStock } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const errors = [];
    const parseBoolean = (value, field) => {
        if (value === undefined) return undefined;
        if (value === "true") return true;
        if (value === "false") return false;
        errors.push(field + " must be true or false");
    };
    if (!Number.isInteger(pageNumber) || pageNumber < 1) errors.push("page must be a positive integer");
    if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) errors.push("limit must be an integer between 1 and 100");
    if (search !== undefined && typeof search !== "string") errors.push("search must be a string");
    if (category !== undefined && !isValidObjectId(category)) errors.push("category must be a valid MongoDB ObjectId");
    const hiddenValue = parseBoolean(hidden, "hidden");
    const outOfStockValue = parseBoolean(outOfStock, "outOfStock");
    if (errors.length) throw validationError(errors);
    req.itemQuery = { page: pageNumber, limit: limitNumber, search: search?.trim(), category, hidden: hiddenValue, outOfStock: outOfStockValue };
});

export const validateItemReorder = validate("PATCH", (req) => {
    if (!Array.isArray(req.body) || !req.body.length) throw validationError(["Request body must be a non-empty array"]);
    const errors = [];
    const ids = new Set();
    req.body.forEach((entry, index) => {
        if (!isPlainObject(entry)) return errors.push("reorder entry " + index + " must be an object");
        if (!isValidObjectId(entry.id)) errors.push("reorder entry " + index + ".id must be a valid MongoDB ObjectId");
        if (!Number.isFinite(entry.displayOrder)) errors.push("reorder entry " + index + ".displayOrder must be a number");
        if (ids.has(entry.id)) errors.push("Duplicate item id: " + entry.id);
        ids.add(entry.id);
    });
    if (errors.length) throw validationError(errors);
});
