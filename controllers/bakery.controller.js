import { getBakery as getBakeryService, updateBakery as updateBakeryService } from "../services/bakery.service.js";

const sendError = (res, error) => res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
    errors: error.errors || []
});

export const getBakery = async (req, res) => {
    try {
        const bakery = await getBakeryService(req.user.bakery);
        res.status(200).json({ success: true, message: "Bakery loaded successfully", data: bakery });
    } catch (error) {
        sendError(res, error);
    }
};

export const updateBakery = async (req, res) => {
    try {
        const bakery = await updateBakeryService(req.user.bakery, req.body);
        res.status(200).json({ success: true, message: "Bakery updated successfully", data: bakery });
    } catch (error) {
        sendError(res, error);
    }
};
