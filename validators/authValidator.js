const validationError = (message, errors) => {
    const error = new Error(message);
    error.statusCode = 400;
    error.errors = errors;
    return error;
};

const requiredString = (value, field, minimumLength) => {
    if (typeof value !== "string" || !value.trim()) {
        return `${field} is required`;
    }

    if (minimumLength && value.length < minimumLength) {
        return `${field} must be at least ${minimumLength} characters long`;
    }

    return null;
};

const validate = (rules) => (req, res, next) => {
    try {
        const errors = rules
            .map((rule) => requiredString(req.body?.[rule.field], rule.label, rule.minimumLength))
            .filter(Boolean);

        if (errors.length) {
            throw validationError("Validation failed", errors);
        }

        next();
    } catch (error) {
        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || "Validation failed",
            errors: error.errors || []
        });
    }
};

export const validateRegister = validate([
    { field: "bakeryName", label: "bakeryName" },
    { field: "username", label: "username" },
    { field: "password", label: "password", minimumLength: 8 }
]);

export const validateLogin = validate([
    { field: "username", label: "username" },
    { field: "password", label: "password" }
]);

export const validateChangePassword = validate([
    { field: "currentPassword", label: "currentPassword" },
    { field: "newPassword", label: "newPassword", minimumLength: 8 }
]);

export const validateForgotPassword = validate([
    { field: "username", label: "username" }
]);

export const validateResetPassword = validate([
    { field: "username", label: "username" },
    { field: "resetSecret", label: "resetSecret" },
    { field: "newPassword", label: "newPassword", minimumLength: 8 }
]);
