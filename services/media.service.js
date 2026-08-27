import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import Media from "../database/schema/media.js";
import Bakery from "../database/schema/bakery.js";
import { IMAGE_MIME_TYPES } from "../middleware/upload.middleware.js";

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getR2Config = () => {
    const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;

    if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
        throw createError("R2 is not configured", 500);
    }

    return { accountId: R2_ACCOUNT_ID, bucketName: R2_BUCKET_NAME, publicUrl: R2_PUBLIC_URL };
};

const runWrangler = (args) => new Promise((resolve, reject) => {
    execFile("wrangler", args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            error.stderr = stderr;
            return reject(error);
        }
        resolve(stdout);
    });
});

const uploadToR2 = async ({ buffer, r2Key, contentType }) => {
    const { bucketName } = getR2Config();
    const tmpFile = join(tmpdir(), `r2-upload-${randomUUID()}`);

    await writeFile(tmpFile, buffer);
    try {
        await runWrangler([
            "r2", "object", "put",
            `${bucketName}/${r2Key}`,
            "--file", tmpFile,
            "--content-type", contentType,
            "--remote"
        ]);
    } finally {
        await unlink(tmpFile).catch(() => {});
    }
};

const deleteFromR2 = async (r2Key) => {
    const { bucketName } = getR2Config();
    await runWrangler(["r2", "object", "delete", `${bucketName}/${r2Key}`, "--remote"]);
};

const buildR2Key = (bakeryId, type, ext) => {
    const directory = type === "image" ? "images" : "videos";
    return `model-bakery/${bakeryId}/${directory}/${randomUUID()}.${ext}`;
};

const extensionByMimeType = {
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov"
};

const prepareUpload = async (file) => {
    if (IMAGE_MIME_TYPES.has(file.mimetype)) {
        const buffer = await sharp(file.buffer)
            .rotate()
            .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        return {
            buffer,
            type: "image",
            mimeType: "image/webp",
            ext: "webp",
            size: buffer.length
        };
    }

    return {
        buffer: file.buffer,
        type: "video",
        mimeType: file.mimetype,
        ext: extensionByMimeType[file.mimetype] || "bin",
        size: file.size
    };
};

const buildPublicUrl = (r2Key) => {
    const { publicUrl } = getR2Config();
    if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${r2Key}`;
    return null;
};

const populateMedia = (query) => query.populate("uploadedBy", "username");

export const createMedia = async ({ bakeryId, accountId, file }) => {
    const prepared = await prepareUpload(file);
    const r2Key = buildR2Key(bakeryId.toString(), prepared.type, prepared.ext);

    await uploadToR2({
        buffer: prepared.buffer,
        r2Key,
        contentType: prepared.mimeType
    });

    try {
        const media = await Media.create({
            bakery: bakeryId,
            type: prepared.type,
            url: buildPublicUrl(r2Key),
            r2Key,
            originalName: file.originalname,
            mimeType: prepared.mimeType,
            size: prepared.size,
            uploadedBy: accountId
        });

        return populateMedia(Media.findById(media._id));
    } catch (error) {
        await deleteFromR2(r2Key).catch(() => {});
        throw error;
    }
};

export const listMedia = async (bakeryId, { page, limit, type }) => {
    const filter = { bakery: bakeryId };
    if (type) filter.type = type;

    const [media, total] = await Promise.all([
        populateMedia(
            Media.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        ),
        Media.countDocuments(filter)
    ]);

    return {
        media,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const getMedia = async (bakeryId, mediaId) => {
    const media = await populateMedia(Media.findOne({ _id: mediaId, bakery: bakeryId }));

    if (!media) throw createError("Media not found", 404);
    return media;
};

export const deleteMedia = async (bakeryId, mediaId) => {
    const media = await Media.findOne({ _id: mediaId, bakery: bakeryId });

    if (!media) throw createError("Media not found", 404);

    const usedByBakery = await Bakery.exists({
        _id: bakeryId,
        $or: [{ logo: media._id }, { coverImages: media._id }, { coverVideo: media._id }]
    });
    if (usedByBakery) throw createError("Media is currently used by bakery branding", 409);

    if (media.r2Key) {
        await deleteFromR2(media.r2Key);
    }

    await Media.deleteOne({ _id: media._id, bakery: bakeryId });
};
