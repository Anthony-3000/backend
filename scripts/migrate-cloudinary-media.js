import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import Media from "../database/schema/media.js";
import connectDB from "../database/connectdb.js";
import { prepareMediaUpload } from "../services/media.service.js";
import { deleteStoredMedia, saveMedia } from "../storage/mediaStorage.js";

dotenv.config();

const isRemoteUrl = (value) => {
    try {
        return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
};

const contentType = (media, response) => {
    const header = response.headers["content-type"]?.split(";")[0];
    if (media.type === "image") return media.mimeType?.startsWith("image/") ? media.mimeType : header || "image/jpeg";
    return media.mimeType?.startsWith("video/") ? media.mimeType : header || "video/mp4";
};

const migrate = async () => {
    const dryRun = process.argv.includes("--dry-run");
    const filter = { $or: [{ storageKey: { $exists: false } }, { storageKey: null }] };
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    await connectDB();
    for await (const media of Media.find(filter).cursor()) {
        if (!isRemoteUrl(media.url)) {
            skipped += 1;
            console.warn(`Skipping ${media._id}: no remote URL is available`);
            continue;
        }

        if (dryRun) {
            migrated += 1;
            console.log(`Would migrate ${media._id}`);
            continue;
        }

        let stored;
        try {
            const response = await axios.get(media.url, {
                responseType: "arraybuffer",
                timeout: 30000,
                maxContentLength: 25 * 1024 * 1024,
                maxBodyLength: 25 * 1024 * 1024
            });
            const file = {
                buffer: Buffer.from(response.data),
                mimetype: contentType(media, response),
                size: response.data.byteLength
            };
            const prepared = await prepareMediaUpload(file);
            stored = await saveMedia({
                bakeryId: media.bakery.toString(),
                ...prepared,
                filenameSeed: media._id.toString()
            });

            await Media.updateOne(
                { _id: media._id, $or: [{ storageKey: { $exists: false } }, { storageKey: null }] },
                { $set: { storageKey: stored.storageKey, url: stored.url, mimeType: prepared.mimeType, size: prepared.size }, $unset: { publicId: 1 } }
            );
            migrated += 1;
            console.log(`Migrated ${media._id}`);
        } catch (error) {
            if (stored) await deleteStoredMedia(stored.storageKey).catch(() => {});
            failed += 1;
            console.error(`Failed to migrate ${media._id}: ${error.message}`);
        }
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed${dryRun ? " (dry run)" : ""}`);
    if (failed) process.exitCode = 1;
};

try {
    await migrate();
} finally {
