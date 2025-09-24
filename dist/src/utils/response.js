export const writeSuccess = (res, status, message, data) => {
    res.status(status).json({ success: true, message, data });
};
export const writeError = (res, status, message, error) => {
    res.status(status).json({ success: false, message, error });
};
export const errorHandler = (err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    writeError(res, 500, message);
};
