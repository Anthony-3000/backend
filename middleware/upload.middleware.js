import multer from "multer";

export const MAX_MEDIA_SIZE_BYTES = 25 * 1024 * 1024;

export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const allowedMimeTypes = new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_MEDIA_SIZE_BYTES,
        files: 1
    },
    fileFilter: (req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            const error = new Error("Unsupported file type");
            error.statusCode = 400;
            return callback(error);
        }

        callback(null, true);
    }
});

export const uploadMedia = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
        if (!error) return next();

        const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? "File must not exceed 25MB"
            : error.message || "File upload failed";

        return res.status(error.statusCode || 400).json({
            success: false,
            message,
            errors: [message]
        });
    });
};
