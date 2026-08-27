import {
    createMedia as createMediaService,
    deleteMedia as deleteMediaService,
    getMedia as getMediaService,
    listMedia as listMediaService
} from "../services/media.service.js";

const sendError = (res, error) => res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
    errors: error.errors || []
});

export const createMedia = async (req, res) => {
    try {
        const media = await createMediaService({
            bakeryId: req.user.bakery,
            accountId: req.user._id,
            file: req.file
        });

        res.status(201).json({ success: true, message: "Media uploaded successfully", data: media });
    } catch (error) {
        sendError(res, error);
    }
};

export const listMedia = async (req, res) => {
    try {
        const result = await listMediaService(req.user.bakery, req.mediaQuery);
        res.status(200).json({ success: true, message: "Media loaded successfully", data: result });
    } catch (error) {
        sendError(res, error);
    }
};

export const getMedia = async (req, res) => {
    try {
        const media = await getMediaService(req.user.bakery, req.params.id);
        res.status(200).json({ success: true, message: "Media loaded successfully", data: media });
    } catch (error) {
        sendError(res, error);
    }
};

export const deleteMedia = async (req, res) => {
    try {
        await deleteMediaService(req.user.bakery, req.params.id);
        res.status(200).json({ success: true, message: "Media deleted successfully", data: {} });
    } catch (error) {
        sendError(res, error);
    }
};
