import mongoose from "mongoose";
import Category from "../database/schema/category.js";
import Item from "../database/schema/items.js";
import { createHttpError, verifyCategoryOwnership, verifyMediaOwnership } from "./ownership.service.js";
import { deleteMedia as deleteMediaAsset } from "./media.service.js";

const allowedFields = ["name", "tagline", "image", "categoryBadges", "displayOrder", "active"];

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createUniqueSlug = async (name, bakeryId, categoryId) => {
    const baseSlug = toSlug(name);
    let slug = baseSlug;
    let suffix = 1;
    const filter = { bakery: bakeryId };
    if (categoryId) filter._id = { $ne: categoryId };

    while (await Category.exists({ ...filter, slug })) {
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

const getUpdate = (body) => Object.fromEntries(
    allowedFields
        .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
        .map((field) => [field, trimStrings(body[field])])
);

const verifyImageOwnership = async (bakeryId, imageId) => {
    if (!imageId) return;
    console.log("[Category][SERVICE] Verifying image ownership", { bakeryId: bakeryId.toString(), imageId: imageId.toString() });
    await verifyMediaOwnership({ bakeryId, mediaIds: [imageId], type: "image" });
};

const findCategory = async (bakeryId, categoryId) => {
    console.log("[Category][SERVICE] Loading category", { bakeryId: bakeryId.toString(), categoryId });
    return verifyCategoryOwnership({ bakeryId, categoryId });
};

export const createCategory = async (bakeryId, requestBody) => {
    console.log("[Category][SERVICE] Create started", { bakeryId: bakeryId.toString() });
    const categoryData = getUpdate(requestBody);
    await verifyImageOwnership(bakeryId, categoryData.image);
    categoryData.slug = await createUniqueSlug(categoryData.name, bakeryId);
    const category = await Category.create({ ...categoryData, bakery: bakeryId });
    console.log("[Category][SERVICE] Category created", { bakeryId: bakeryId.toString(), categoryId: category._id.toString() });
    return category;
};

export const listCategories = async (bakeryId, { page, limit, search }) => {
    console.log("[Category][SERVICE] List started", { bakeryId: bakeryId.toString(), page, limit, search });
    const filter = { bakery: bakeryId };
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
    const [categories, total] = await Promise.all([
        Category.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Category.countDocuments(filter)
    ]);
    console.log("[Category][SERVICE] Categories loaded", { bakeryId: bakeryId.toString(), count: categories.length, total });
    return { categories, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getCategory = async (bakeryId, categoryId) => {
    console.log("[Category][SERVICE] Get started", { bakeryId: bakeryId.toString(), categoryId });
    return findCategory(bakeryId, categoryId);
};

export const updateCategory = async (bakeryId, categoryId, requestBody) => {
    console.log("[Category][SERVICE] Update started", { bakeryId: bakeryId.toString(), categoryId });
    const category = await findCategory(bakeryId, categoryId);
    const update = getUpdate(requestBody);
    await verifyImageOwnership(bakeryId, update.image);
    if (Object.prototype.hasOwnProperty.call(update, "name") && update.name !== category.name) {
        update.slug = await createUniqueSlug(update.name, bakeryId, category._id);
    }
    Object.assign(category, update);
    await category.save();
    console.log("[Category][SERVICE] Category updated", { bakeryId: bakeryId.toString(), categoryId: category._id.toString() });
    return category;
};

export const deleteCategory = async (bakeryId, categoryId) => {
    console.log("[Category][SERVICE] Delete started", { bakeryId: bakeryId.toString(), categoryId });
    const category = await findCategory(bakeryId, categoryId);
    const itemExists = await Item.exists({ bakery: bakeryId, category: category._id });
    if (itemExists) throw createHttpError("Category contains menu items", 409);
    await Category.deleteOne({ _id: category._id, bakery: bakeryId });
    const categoryImageId = category.image?._id ?? category.image;
    if (categoryImageId) {
        deleteMediaAsset(bakeryId, categoryImageId).catch(() => {});
    }
    console.log("[Category][SERVICE] Category deleted", { bakeryId: bakeryId.toString(), categoryId: category._id.toString() });
};

export const reorderCategories = async (bakeryId, reorderEntries) => {
    console.log("[Category][SERVICE] Reorder started", { bakeryId: bakeryId.toString(), count: reorderEntries.length });
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const categoryIds = reorderEntries.map((entry) => entry.id);
            const categoryCount = await Category.countDocuments({ _id: { $in: categoryIds }, bakery: bakeryId }).session(session);
            if (categoryCount !== categoryIds.length) throw createError("One or more categories were not found", 404);
            const operations = reorderEntries.map((entry) => ({
                updateOne: {
                    filter: { _id: entry.id, bakery: bakeryId },
                    update: { $set: { displayOrder: entry.displayOrder } }
                }
            }));
            await Category.bulkWrite(operations, { session });
        });
    } finally {
        await session.endSession();
    }
    console.log("[Category][SERVICE] Reorder completed", { bakeryId: bakeryId.toString(), count: reorderEntries.length });
};
