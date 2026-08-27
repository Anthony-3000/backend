import Category from "../database/schema/category.js";
import Item from "../database/schema/items.js";
import Media from "../database/schema/media.js";

const latestItemFields = "name slug category price media hidden outOfStock displayOrder createdAt";
const latestCategoryFields = "name slug image active displayOrder createdAt";

export const getDashboard = async (bakeryId) => {
    console.log("[Dashboard][SERVICE] Service started", { bakeryId: bakeryId.toString() });
    const categoryFilter = { bakery: bakeryId };
    const itemFilter = { bakery: bakeryId };

    const [totalCategories, totalItems, totalMedia, activeCategories, hiddenItems, outOfStockItems, latestItems, latestCategories] = await Promise.all([
        Category.countDocuments(categoryFilter),
        Item.countDocuments(itemFilter),
        Media.countDocuments({ bakery: bakeryId }),
        Category.countDocuments({ ...categoryFilter, active: true }),
        Item.countDocuments({ ...itemFilter, hidden: true }),
        Item.countDocuments({ ...itemFilter, outOfStock: true }),
        Item.find(itemFilter).select(latestItemFields).populate("category", "name slug").populate("media", "url type originalName").sort({ createdAt: -1 }).limit(5).lean(),
        Category.find(categoryFilter).select(latestCategoryFields).populate("image", "url type originalName").sort({ createdAt: -1 }).limit(5).lean()
    ]);

    console.log("[Dashboard][SERVICE] Database queries completed", { bakeryId: bakeryId.toString(), latestItemCount: latestItems.length, latestCategoryCount: latestCategories.length });
    return { totalCategories, totalItems, totalMedia, activeCategories, hiddenItems, outOfStockItems, latestItems, latestCategories };
};
