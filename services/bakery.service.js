import Bakery from "../database/schema/bakery.js";
import { verifyMediaOwnership } from "./ownership.service.js";

const allowedFields = ["name", "tagline", "description", "locations", "social", "contact", "establishedYear", "fssaiLicenseNo", "active", "logo", "coverImages", "coverVideo"];

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bakery";

const createUniqueSlug = async (name, bakeryId) => {
    const baseSlug = toSlug(name);
    let slug = baseSlug;
    let suffix = 1;

    while (await Bakery.exists({ slug, _id: { $ne: bakeryId } })) {
        slug = baseSlug + "-" + suffix;
        suffix += 1;
    }
    return slug;
};


const trimStrings = (value) => {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(trimStrings);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimStrings(item)]));
    return value;
};

const populateBakeryMedia = (query) => query
    .populate("logo", "url type originalName")
    .populate("coverImages", "url type originalName")
    .populate("coverVideo", "url type originalName");

const getPopulatedBakery = async (bakeryId) => {
    const bakery = await populateBakeryMedia(Bakery.findById(bakeryId));
    if (!bakery) throw createError("Bakery not found", 404);
    return bakery;
};

const verifyMediaRelations = async (bakeryId, update) => {
    if (Object.prototype.hasOwnProperty.call(update, "logo") && update.logo) {
        await verifyMediaOwnership({ bakeryId, mediaIds: [update.logo], type: "image" });
    }
    if (Object.prototype.hasOwnProperty.call(update, "coverImages")) {
        await verifyMediaOwnership({ bakeryId, mediaIds: update.coverImages, type: "image" });
    }
    if (Object.prototype.hasOwnProperty.call(update, "coverVideo") && update.coverVideo) {
        await verifyMediaOwnership({ bakeryId, mediaIds: update.coverVideo, type: "video" });
    }
};

export const getBakery = async (bakeryId) => getPopulatedBakery(bakeryId);

export const updateBakery = async (bakeryId, requestBody) => {
    const bakery = await Bakery.findById(bakeryId);
    if (!bakery) throw createError("Bakery not found", 404);

    const update = Object.fromEntries(
        allowedFields.filter((field) => Object.prototype.hasOwnProperty.call(requestBody, field))
            .map((field) => [field, trimStrings(requestBody[field])])
    );

    await verifyMediaRelations(bakeryId, update);

    if (Object.prototype.hasOwnProperty.call(update, "name")) {
        if (!update.name) throw createError("name cannot be empty", 400);
        if (update.name !== bakery.name) update.slug = await createUniqueSlug(update.name, bakery._id);
    }

    Object.assign(bakery, update);
    await bakery.save();
    return getPopulatedBakery(bakery._id);
};
