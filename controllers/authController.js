import {
    changePassword as changePasswordService,
    createPasswordResetSecret,
    getCookieOptions,
    getCurrentAccount,
    login as loginService,
    register as registerService,
    resetPassword as resetPasswordService
} from "../services/authService.js";

const sendError = (res, error) => res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
    errors: error.errors || []
});

export const register = async (req, res) => {
    try {
        const result = await registerService(req.body);
        res.cookie("token", result.token, getCookieOptions());
        res.status(201).json({ success: true, message: "Registration successful", data: { account: result.account, bakery: result.bakery } });
    } catch (error) {
        sendError(res, error);
    }
};

export const login = async (req, res) => {
    try {
        const result = await loginService(req.body);
        res.cookie("token", result.token, getCookieOptions());
        res.status(200).json({ success: true, message: "Login successful", data: { account: result.account, bakery: result.bakery } });
    } catch (error) {
        sendError(res, error);
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie("token", { httpOnly: true, sameSite: "none", secure: process.env.NODE_ENV === "production" });
        res.status(200).json({ success: true, message: "Logout successful", data: {} });
    } catch (error) {
        sendError(res, error);
    }
};

export const getMe = async (req, res) => {
    try {
        const result = await getCurrentAccount(req.user._id);
        res.status(200).json({ success: true, message: "Authenticated user retrieved", data: result });
    } catch (error) {
        sendError(res, error);
    }
};

export const changePassword = async (req, res) => {
    try {
        await changePasswordService(req.user._id, req.body.currentPassword, req.body.newPassword);
        res.status(200).json({ success: true, message: "Password changed successfully", data: {} });
    } catch (error) {
        sendError(res, error);
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const resetSecret = await createPasswordResetSecret(req.body);
        const data = resetSecret ? { resetSecret, expiresInMinutes: 15 } : {};

        res.status(200).json({
            success: true,
            message: "If the account exists, a password reset secret has been created",
            data
        });
    } catch (error) {
        sendError(res, error);
    }
};

export const resetPassword = async (req, res) => {
    try {
        await resetPasswordService(req.body);
        res.status(200).json({ success: true, message: "Password reset successfully", data: {} });
    } catch (error) {
        sendError(res, error);
    }
};
