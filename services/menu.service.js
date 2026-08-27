import Bakery from "../database/schema/bakery.js";
import Category from "../database/schema/category.js";
import Item from "../database/schema/items.js";
import { createHttpError } from "./ownership.service.js";

const bakeryFields = "name slug tagline description social contact establishedYear locations logo coverImages coverVideo";
const categoryFields = "name slug tagline image categoryBadges displayOrder";
const itemFields = "name slug description price media badges details weight outOfStock displayOrder category";

const getActiveBakery = async (bakerySlug) => {
    const bakery = await Bakery.findOne({ slug: bakerySlug.toLowerCase(), active: true })
        .select(bakeryFields)
        .populate("logo", "url type originalName")
        .populate("coverImages", "url type originalName")
        .populate("coverVideo", "url type originalName")
        .lean();
    if (!bakery) throw createHttpError("Bakery not found", 404);
    return bakery;
};

export const getBakeryMenu = async (bakerySlug) => {
    // TODO(redis): Look up the active bakery menu by bakerySlug before querying MongoDB.
    console.log("[Menu][SERVICE] Loading bakery", { bakerySlug });
    const bakery = await getActiveBakery(bakerySlug);
    console.log("[Menu][SERVICE] Database query completed", { resource: "bakery", bakerySlug });

    // TODO(redis): Save bakery data using a bakery menu cache key after a MongoDB cache miss.
    return bakery;
};

export const getMenuCategories = async (bakerySlug) => {
    // TODO(redis): Look up active menu categories by bakerySlug before querying MongoDB.
    console.log("[Menu][SERVICE] Loading categories", { bakerySlug });
    const bakery = await getActiveBakery(bakerySlug);
    const categories = await Category.find({ bakery: bakery._id, active: true })
        .select(categoryFields)
        .populate("image", "url type originalName")
        .sort({ displayOrder: 1 })
        .lean();
    console.log("[Menu][SERVICE] Database query completed", { resource: "categories", bakerySlug, count: categories.length });
    // TODO(redis): Save categories using a bakerySlug-scoped cache key after a MongoDB cache miss.
    return categories;
};

export const getCategoryItems = async (bakerySlug, categorySlug) => {
    // TODO(redis): Look up category items by bakerySlug and categorySlug before querying MongoDB.
    console.log("[Menu][SERVICE] Loading category items", { bakerySlug, categorySlug });
    const bakery = await getActiveBakery(bakerySlug);
    const category = await Category.findOne({ bakery: bakery._id, slug: categorySlug, active: true }).select("_id").lean();
    if (!category) throw createHttpError("Category not found", 404);

    const items = await Item.find({ bakery: bakery._id, category: category._id, hidden: false })
        .select(itemFields)
        .populate("media", "url type originalName")
        .sort({ displayOrder: 1 })
        .lean();
    console.log("[Menu][SERVICE] Database query completed", { resource: "items", bakerySlug, categorySlug, count: items.length });
    // TODO(redis): Save category items using a bakery/category-scoped cache key after a MongoDB cache miss.
    return items;
};

export const getMenuItem = async (bakerySlug, itemSlug) => {
    // TODO(redis): Look up the menu item by bakerySlug and itemSlug before querying MongoDB.
    console.log("[Menu][SERVICE] Loading item", { bakerySlug, itemSlug });
    const bakery = await getActiveBakery(bakerySlug);
    const item = await Item.findOne({ bakery: bakery._id, slug: itemSlug })
        .select(itemFields)
        .populate("category", "name slug tagline image categoryBadges displayOrder")
        .populate("media", "url type originalName")
        .lean();
    if (!item) throw createHttpError("Item not found", 404);
    console.log("[Menu][SERVICE] Database query completed", { resource: "item", bakerySlug, itemSlug });
    // TODO(redis): Save the menu item using a bakery/item-scoped cache key after a MongoDB cache miss.
    return item;
};
