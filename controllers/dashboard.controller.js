import { getDashboard as getDashboardService } from "../services/dashboard.service.js";

export const getDashboard = async (req, res) => {
    const startedAt = Date.now();
    const context = { route: req.originalUrl, method: req.method, bakeryId: req.user.bakery.toString(), accountId: req.user._id.toString(), requestId: req.id || req.headers["x-request-id"] };
    console.log("[Dashboard][GET] Loading dashboard", context);
    try {
        const dashboard = await getDashboardService(req.user.bakery);
        console.log("[Dashboard][GET] Dashboard statistics generated", context);
        console.log("[Dashboard][GET] Completed in " + (Date.now() - startedAt) + " ms", context);
        return res.status(200).json({ success: true, message: "Dashboard loaded successfully", data: dashboard });
    } catch (error) {
        const status = error.statusCode || 500;
        console.error("[Dashboard][GET] Failed (" + status + ")", { ...context, message: error.message, stack: error.stack });
        console.log("[Dashboard][GET] Completed in " + (Date.now() - startedAt) + " ms", context);
        return res.status(status).json({ success: false, message: status === 500 ? "Internal server error" : error.message, errors: error.errors || [] });
    }
};
