import { Request, Response, NextFunction } from 'express';

export const writeSuccess = (res: Response, status: number, message: string, data?: unknown) => {
	res.status(status).json({ success: true, message, data });
};

export const writeError = (res: Response, status: number, message: string, error?: unknown) => {
	res.status(status).json({ success: false, message, error });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
	const message = err instanceof Error ? err.message : 'Internal Server Error';
	writeError(res, 500, message);
};
