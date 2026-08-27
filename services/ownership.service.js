import Category from "../database/schema/category.js";
import Item from "../database/schema/items.js";
import Media from "../database/schema/media.js";

export const createHttpError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

export const verifyCategoryOwnership = async ({ bakeryId, categoryId, session }) => {
    const category = await Category.findOne({ _id: categoryId, bakery: bakeryId }).session(session || null);
    if (!category) throw createHttpError("Category not found", 404);
    return category;
};

export const verifyMediaOwnership = async ({ bakeryId, mediaIds, type, session }) => {
    if (!mediaIds?.length) return [];

    const uniqueMediaIds = [...new Set(mediaIds.map((mediaId) => mediaId.toString()))];
    const filter = { _id: { $in: uniqueMediaIds }, bakery: bakeryId };
    if (type) filter.type = type;

    const media = await Media.find(filter).session(session || null);
    if (media.length !== uniqueMediaIds.length) throw createHttpError("One or more media files were not found", 404);
    return media;
};

export const verifyItemOwnership = async ({ bakeryId, itemId, session }) => {
    const item = await Item.findOne({ _id: itemId, bakery: bakeryId }).session(session || null);
    if (!item) throw createHttpError("Item not found", 404);
    return item;
};
export const verifyItemsOwnership = async ({ bakeryId, itemIds, session }) => {
    const uniqueItemIds = [...new Set(itemIds.map((itemId) => itemId.toString()))];
    const itemCount = await Item.countDocuments({ _id: { $in: uniqueItemIds }, bakery: bakeryId }).session(session || null);
    if (itemCount !== uniqueItemIds.length) throw createHttpError("One or more items were not found", 404);
};
