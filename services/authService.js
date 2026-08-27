import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Account from "../database/schema/account.js";
import Bakery from "../database/schema/bakery.js";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const RESET_SECRET_EXPIRY_MS = 15 * 60 * 1000;

const createError = (message, statusCode = 400, errors = []) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.errors = errors;
    return error;
};

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw createError("JWT_SECRET is not configured", 500);
    }

    return process.env.JWT_SECRET;
};

export const getCookieOptions = () => ({
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE
});

const createToken = (accountId) => jwt.sign({ accountId }, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRY
});

const toSlug = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bakery";

const generateUniqueSlug = async (bakeryName, session) => {
    const baseSlug = toSlug(bakeryName);
    let slug = baseSlug;
    let suffix = 1;

    while (await Bakery.exists({ slug }).session(session)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
    }

    return slug;
};

const sanitizeAccount = (account) => {
    const accountObject = account.toObject ? account.toObject() : account;
    delete accountObject.password;
    return accountObject;
};

const populateBakeryMedia = (query) => query.populate({
    path: "bakery",
    populate: [
        { path: "logo", select: "url type originalName" },
        { path: "coverImages", select: "url type originalName" },
        { path: "coverVideo", select: "url type originalName" }
    ]
});

export const register = async ({ bakeryName, username, password }) => {
    const normalizedUsername = username.trim().toLowerCase();
    const session = await mongoose.startSession();

    try {
        let account;
        let bakery;

        await session.withTransaction(async () => {
            const existingAccount = await Account.findOne({ username: normalizedUsername }).session(session);

            if (existingAccount) {
                throw createError("Username already exists", 409);
            }

            const slug = await generateUniqueSlug(bakeryName, session);
            [bakery] = await Bakery.create([{ name: bakeryName.trim(), slug }], { session });

            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            [account] = await Account.create([{
                bakery: bakery._id,
                username: normalizedUsername,
                password: hashedPassword
            }], { session });
        });

        return {
            token: createToken(account._id.toString()),
            account: sanitizeAccount(account),
            bakery: bakery.toObject()
        };
    } catch (error) {
        if (error?.code === 11000 && error?.keyPattern?.username) {
            throw createError("Username already exists", 409);
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

export const login = async ({ username, password }) => {
    const account = await populateBakeryMedia(Account.findOne({ username: username.trim().toLowerCase() }));

    if (!account) {
        throw createError("Invalid username or password", 401);
    }

    if (!account.active || !account.bakery?.active) {
        throw createError("Account is inactive", 403);
    }

    if (!await bcrypt.compare(password, account.password)) {
        throw createError("Invalid username or password", 401);
    }

    account.lastLogin = new Date();
    await account.save();

    return {
        token: createToken(account._id.toString()),
        account: sanitizeAccount(account),
        bakery: account.bakery.toObject()
    };
};

export const getCurrentAccount = async (accountId) => {
    const account = await populateBakeryMedia(Account.findById(accountId));

    if (!account || !account.active || !account.bakery?.active) {
        throw createError("Account is not available", 401);
    }

    return {
        account: sanitizeAccount(account),
        bakery: account.bakery.toObject()
    };
};

export const changePassword = async (accountId, currentPassword, newPassword) => {
    const account = await Account.findById(accountId);

    if (!account || !account.active) {
        throw createError("Account is not available", 401);
    }

    if (!await bcrypt.compare(currentPassword, account.password)) {
        throw createError("Current password is incorrect", 401);
    }

    account.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await account.save();
};

const hashResetSecret = (resetSecret) => crypto
    .createHash("sha256")
    .update(resetSecret)
    .digest("hex");

export const createPasswordResetSecret = async ({ username }) => {
    const account = await Account.findOne({ username: username.trim().toLowerCase() });

    if (!account || !account.active) {
        return null;
    }

    const resetSecret = crypto.randomBytes(32).toString("hex");
    account.passwordResetSecretHash = hashResetSecret(resetSecret);
    account.passwordResetExpiresAt = new Date(Date.now() + RESET_SECRET_EXPIRY_MS);
    await account.save();

    return resetSecret;
};

export const resetPassword = async ({ username, resetSecret, newPassword }) => {
    const account = await Account.findOne({
        username: username.trim().toLowerCase(),
        passwordResetSecretHash: hashResetSecret(resetSecret),
        passwordResetExpiresAt: { $gt: new Date() },
        active: true
    });

    if (!account) {
        throw createError("Reset secret is invalid or has expired", 400);
    }

    account.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    account.passwordResetSecretHash = undefined;
    account.passwordResetExpiresAt = undefined;
    await account.save();
};

export const verifyToken = (token) => jwt.verify(token, getJwtSecret());
