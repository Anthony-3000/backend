import Account from "../database/schema/account.js";
import { verifyToken } from "../services/authService.js";

const unauthorized = (res, message = "Authentication required") => res.status(401).json({
    success: false,
    message,
    errors: []
});

export const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return unauthorized(res);
        }

        const payload = verifyToken(token);
        const account = await Account.findById(payload.accountId);

        if (!account || !account.active) {
            return unauthorized(res, "Account is not available");
        }

        req.user = account;
        next();
    } catch (error) {
        return unauthorized(res, "Invalid or expired authentication token");
    }
};
