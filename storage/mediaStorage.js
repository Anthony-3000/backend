import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import appConfig from "../config/appConfig.js";

const STORAGE_URL_PREFIX = "/uploads";
const getStorageRoot = () => path.resolve(process.env.UPLOADS_DIR || "uploads");

const extensionByMimeType = new Map([
    ["image/webp", "webp"],
    ["video/mp4", "mp4"],
    ["video/webm", "webm"],
    ["video/quicktime", "mov"]
]);

const isSafeBakeryId = (value) => /^[a-f\d]{24}$/i.test(String(value));
const isSafeStorageKey = (value) => /^(images|videos)\/[a-f\d]{24}\/[a-f\d-]+\.(webp|mp4|webm|mov)$/i.test(value);

const getPublicBaseUrl = () => (process.env.PUBLIC_BASE_URL || `http://localhost:${appConfig.port}`).replace(/\/$/, "");

const buildStorageKey = ({ bakeryId, type, mimeType, filenameSeed }) => {
    if (!isSafeBakeryId(bakeryId)) throw new Error("Invalid bakery storage identifier");

    const extension = extensionByMimeType.get(mimeType);
    if (!extension) throw new Error("Unsupported stored media type");

    const directory = type === "image" ? "images" : type === "video" ? "videos" : null;
    if (!directory) throw new Error("Unsupported media type");

    const filename = filenameSeed || crypto.randomUUID();
    if (!/^[a-f\d-]+$/i.test(filename)) throw new Error("Invalid storage filename");
    return `${directory}/${bakeryId}/${filename}.${extension}`;
};

const getPathForKey = (storageKey) => {
    if (!isSafeStorageKey(storageKey)) throw new Error("Invalid storage key");

    const storageRoot = getStorageRoot();
    const absolutePath = path.resolve(storageRoot, storageKey);
    if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) throw new Error("Invalid storage path");
    return absolutePath;
};

export const getUploadsRoot = () => getStorageRoot();
export const getUploadsUrlPrefix = () => STORAGE_URL_PREFIX;
export const getMediaUrl = (storageKey) => `${getPublicBaseUrl()}${STORAGE_URL_PREFIX}/${storageKey}`;

export const saveMedia = async ({ bakeryId, type, buffer, mimeType, filenameSeed }) => {
    const storageKey = buildStorageKey({ bakeryId, type, mimeType, filenameSeed });
    const destination = getPathForKey(storageKey);
    const temporaryPath = `${destination}.${crypto.randomUUID()}.tmp`;

    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
        await fs.writeFile(temporaryPath, buffer, { flag: "wx" });
        await fs.rename(temporaryPath, destination);
    } catch (error) {
        await fs.unlink(temporaryPath).catch(() => {});
        throw error;
    }

    return { storageKey, url: getMediaUrl(storageKey) };
};

export const deleteStoredMedia = async (storageKey) => {
    if (!storageKey) return;

    try {
        await fs.unlink(getPathForKey(storageKey));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
};
