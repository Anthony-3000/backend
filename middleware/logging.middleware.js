const getResponseMessage = (body) => {
    if (body && typeof body === "object" && typeof body.message === "string") {
        return body.message;
    }

    return undefined;
};

export const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const originalJson = res.json.bind(res);
    let responseMessage;

    res.json = (body) => {
        responseMessage = getResponseMessage(body);
        return originalJson(body);
    };

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const log = {
            event: "api_request",
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(1))
        };

        if (req.user?._id) log.accountId = req.user._id.toString();
        if (req.user?.bakery) log.bakeryId = req.user.bakery.toString();

        if (res.statusCode >= 400) {
            log.error = responseMessage || "Request failed without an error message";
            console.error(JSON.stringify(log));
            return;
        }

        console.info(JSON.stringify(log));
    });

    next();
};

export const apiErrorLogger = (error, req, res, next) => {
    console.error(JSON.stringify({
        event: "api_unhandled_error",
        method: req.method,
        path: req.originalUrl,
        message: error.message || "Unhandled server error",
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack
    }));

    if (res.headersSent) {
        return next(error);
    }

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Internal server error",
        errors: []
    });
};
