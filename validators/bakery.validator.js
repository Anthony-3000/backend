import mongoose from "mongoose";


const validationError = (errors) => {
    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.errors = errors;
    return error;
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isValidObjectId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);
const stringFields = ["name", "tagline", "description", "fssaiLicenseNo"];
const allowedFields = ["name", "tagline", "description", "locations", "social", "contact", "establishedYear", "fssaiLicenseNo", "active", "logo", "coverImages", "coverVideo"];

export const validateBakeryUpdate = (req, res, next) => {
    try {
        const body = req.body;
        if (!isPlainObject(body)) throw validationError(["Request body must be an object"]);

        const errors = [];
        const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
        if (unknownFields.length) errors.push("Unsupported fields: " + unknownFields.join(", "));
        for (const field of stringFields) {
            if (field in body && typeof body[field] !== "string") errors.push(field + " must be a string");
        }
        if ("establishedYear" in body && (!Number.isFinite(body.establishedYear) || !Number.isInteger(body.establishedYear))) errors.push("establishedYear must be a whole number");
        if ("social" in body && !isPlainObject(body.social)) errors.push("social must be an object");
        if ("contact" in body && !isPlainObject(body.contact)) errors.push("contact must be an object");
        if ("active" in body && typeof body.active !== "boolean") errors.push("active must be a boolean");

        if ("locations" in body) {
            if (!Array.isArray(body.locations) || !body.locations.every(isPlainObject)) {
                errors.push("locations must be an array of objects");
            } else if (body.locations.some((location) => "address" in location && typeof location.address !== "string")) {
                errors.push("locations[].address must be a string");
            }
        }

        for (const field of ["social", "contact"]) {
            if (isPlainObject(body[field]) && Object.values(body[field]).some((value) => typeof value !== "string")) {
                errors.push(field + " values must be strings");
            }
        }

        if ("logo" in body && body.logo !== null && !isValidObjectId(body.logo)) errors.push("logo must be a valid MongoDB ObjectId or null");

        if ("coverImages" in body) {
            if (!Array.isArray(body.coverImages)) {
                errors.push("coverImages must be an array of MongoDB ObjectIds");
            } else {
                body.coverImages.forEach((mediaId, index) => {
                    if (!isValidObjectId(mediaId)) errors.push("coverImages[" + index + "] must be a valid MongoDB ObjectId");
                });
                if (new Set(body.coverImages).size !== body.coverImages.length) errors.push("coverImages must not contain duplicate ids");
            }
        }

        if ("coverVideo" in body && body.coverVideo !== null) {
            if (!Array.isArray(body.coverVideo)) {
                errors.push("coverVideo must be an array of MongoDB ObjectIds or null");
            } else {
                body.coverVideo.forEach((mediaId, index) => {
                    if (!isValidObjectId(mediaId)) errors.push("coverVideo[" + index + "] must be a valid MongoDB ObjectId");
                });
                if (new Set(body.coverVideo).size !== body.coverVideo.length) errors.push("coverVideo must not contain duplicate ids");
            }
        }

        if (!Object.keys(body).length) errors.push("At least one field is required");
        if (errors.length) throw validationError(errors);
        next();
    } catch (error) {
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Validation failed", errors: error.errors || [] });
    }
};
