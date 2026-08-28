import { randomUUID } from "node:crypto";
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import Media from "../database/schema/media.js";
import Bakery from "../database/schema/bakery.js";
import { IMAGE_MIME_TYPES } from "../middleware/upload.middleware.js";

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

let r2Client = null;

const getR2Client = () => {
    if (r2Client) return r2Client;

    const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

    if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw createError("R2 is not configured", 500);
    }

    r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY
        }
    });

    return r2Client;
};

const uploadToR2 = async ({ buffer, r2Key, contentType }) => {
    const { R2_BUCKET_NAME } = process.env;
    await getR2Client().send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: buffer,
        ContentType: contentType
    }));
};

const deleteFromR2 = async (r2Key) => {
    const { R2_BUCKET_NAME } = process.env;
    await getR2Client().send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key
    }));
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
    const { R2_PUBLIC_URL } = process.env;
    if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${r2Key}`;
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
