import mongoose from "mongoose";
import Item from "../database/schema/items.js";
import {
    verifyCategoryOwnership,
    verifyItemOwnership,
    verifyItemsOwnership,
    verifyMediaOwnership
} from "./ownership.service.js";
import { deleteMedia as deleteMediaAsset } from "./media.service.js";

const allowedFields = ["category", "name", "description", "price", "media", "badges", "details", "weight", "displayOrder", "hidden", "outOfStock"];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

const createUniqueSlug = async (name, bakeryId, itemId) => {
    const baseSlug = toSlug(name);
    let slug = baseSlug;
    let suffix = 1;
    const filter = { bakery: bakeryId };
    if (itemId) filter._id = { $ne: itemId };
    while (await Item.exists({ ...filter, slug })) {
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

const getUpdate = (body) => Object.fromEntries(allowedFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field)).map((field) => [field, trimStrings(body[field])]));
const populateItem = (query) => query.populate("category").populate("media");

const getPopulatedItem = async (bakeryId, itemId) => {
    const item = await populateItem(Item.findOne({ _id: itemId, bakery: bakeryId })).lean();
    if (!item) throw new Error("Item was not found after the operation");
    return item;
};

const verifyRelations = async (bakeryId, update) => {
    if (Object.prototype.hasOwnProperty.call(update, "category")) {
        await verifyCategoryOwnership({ bakeryId, categoryId: update.category });
        console.log("[Item][SERVICE] Category ownership verified", { bakeryId: bakeryId.toString(), categoryId: update.category.toString() });
    }
    if (Object.prototype.hasOwnProperty.call(update, "media")) {
        await verifyMediaOwnership({ bakeryId, mediaIds: update.media });
        console.log("[Item][SERVICE] Media ownership verified", { bakeryId: bakeryId.toString(), mediaCount: update.media.length });
    }
};

export const createItem = async (bakeryId, requestBody) => {
    console.log("[Item][SERVICE] Service started", { operation: "create", bakeryId: bakeryId.toString() });
    const itemData = getUpdate(requestBody);
    await verifyRelations(bakeryId, itemData);
    itemData.slug = await createUniqueSlug(itemData.name, bakeryId);
    console.log("[Item][SERVICE] Slug generated", { bakeryId: bakeryId.toString(), slug: itemData.slug });
    const item = await Item.create({ ...itemData, bakery: bakeryId });
    console.log("[Item][SERVICE] Item created", { bakeryId: bakeryId.toString(), itemId: item._id.toString() });
    return getPopulatedItem(bakeryId, item._id);
};

export const listItems = async (bakeryId, { page, limit, search, category, hidden, outOfStock }) => {
    console.log("[Item][SERVICE] Service started", { operation: "list", bakeryId: bakeryId.toString(), page, limit });
    const filter = { bakery: bakeryId };
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
    if (category) filter.category = category;
    if (hidden !== undefined) filter.hidden = hidden;
    if (outOfStock !== undefined) filter.outOfStock = outOfStock;
    console.log("[Item][SERVICE] Database query executed", { operation: "list", bakeryId: bakeryId.toString() });
    const [items, total] = await Promise.all([
        populateItem(Item.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
        Item.countDocuments(filter)
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getItem = async (bakeryId, itemId) => {
    console.log("[Item][SERVICE] Service started", { operation: "get", bakeryId: bakeryId.toString(), itemId });
    await verifyItemOwnership({ bakeryId, itemId });
    console.log("[Item][SERVICE] Database query executed", { operation: "get", bakeryId: bakeryId.toString(), itemId });
    return getPopulatedItem(bakeryId, itemId);
};

export const updateItem = async (bakeryId, itemId, requestBody) => {
    console.log("[Item][SERVICE] Service started", { operation: "update", bakeryId: bakeryId.toString(), itemId });
    const item = await verifyItemOwnership({ bakeryId, itemId });
    const update = getUpdate(requestBody);
    await verifyRelations(bakeryId, update);
    if (Object.prototype.hasOwnProperty.call(update, "name") && update.name !== item.name) {
        update.slug = await createUniqueSlug(update.name, bakeryId, item._id);
        console.log("[Item][SERVICE] Slug generated", { bakeryId: bakeryId.toString(), slug: update.slug });
    }
    Object.assign(item, update);
    await item.save();
    console.log("[Item][SERVICE] Item updated", { bakeryId: bakeryId.toString(), itemId: item._id.toString() });
    return getPopulatedItem(bakeryId, item._id);
};

export const deleteItem = async (bakeryId, itemId) => {
    console.log("[Item][SERVICE] Service started", { operation: "delete", bakeryId: bakeryId.toString(), itemId });
    const item = await verifyItemOwnership({ bakeryId, itemId });
    await Item.deleteOne({ _id: item._id, bakery: bakeryId });
    const itemMediaIds = Array.isArray(item.media) ? item.media : [];
    itemMediaIds.forEach((mediaId) => {
        deleteMediaAsset(bakeryId, mediaId).catch(() => {});
    });
    console.log("[Item][SERVICE] Item deleted", { bakeryId: bakeryId.toString(), itemId: item._id.toString() });
};

const toggleItemField = async (bakeryId, itemId, field) => {
    console.log("[Item][SERVICE] Service started", { operation: "toggle-" + field, bakeryId: bakeryId.toString(), itemId });
    const item = await verifyItemOwnership({ bakeryId, itemId });
    item[field] = !item[field];
    await item.save();
    console.log("[Item][SERVICE] Item updated", { bakeryId: bakeryId.toString(), itemId: item._id.toString(), field, value: item[field] });
    return getPopulatedItem(bakeryId, item._id);
};

export const toggleOutOfStock = async (bakeryId, itemId) => toggleItemField(bakeryId, itemId, "outOfStock");
export const toggleHidden = async (bakeryId, itemId) => toggleItemField(bakeryId, itemId, "hidden");

export const reorderItems = async (bakeryId, reorderEntries) => {
    console.log("[Item][SERVICE] Service started", { operation: "reorder", bakeryId: bakeryId.toString(), count: reorderEntries.length });
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const itemIds = reorderEntries.map((entry) => entry.id);
            await verifyItemsOwnership({ bakeryId, itemIds, session });
            const operations = reorderEntries.map((entry) => ({ updateOne: { filter: { _id: entry.id, bakery: bakeryId }, update: { $set: { displayOrder: entry.displayOrder } } } }));
            await Item.bulkWrite(operations, { session });
        });
        console.log("[Item][SERVICE] Transaction committed", { bakeryId: bakeryId.toString() });
        console.log("[Item][SERVICE] Reorder completed", { bakeryId: bakeryId.toString(), count: reorderEntries.length });
    } catch (error) {
        console.error("[Item][SERVICE] Transaction rolled back", { bakeryId: bakeryId.toString(), message: error.message, stack: error.stack });
        throw error;
    } finally {
        await session.endSession();
    }
};
