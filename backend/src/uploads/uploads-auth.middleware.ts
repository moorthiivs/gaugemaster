import { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

/**
 * Creates an Express middleware to protect the /uploads directory.
 * - Protects confidential calibration certificates, gauge diagrams, work instructions, and procedures.
 * - Enforces path-traversal protection.
 * - Allows public access only to /logos for company branding.
 * - Accepts JWT via Authorization header ('Bearer <token>') or ?token=<token> query parameter (for img/iframe/window.open).
 */
export function createUploadsAuthMiddleware(jwtSecretOverride?: string) {
  const uploadRoot = path.resolve(process.cwd(), 'uploads');

  return (req: Request, res: Response, next: NextFunction) => {
    const rawPath = req.path || '/';

    // 1. Path traversal defense
    if (rawPath.includes('..') || rawPath.includes('\0')) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid file path traversal detected.',
      });
    }

    const normalizedPath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '');
    const resolvedPath = path.resolve(uploadRoot, '.' + normalizedPath);

    // Verify file stays within uploads directory
    if (!resolvedPath.startsWith(uploadRoot)) {
      return res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access to the requested path is forbidden.',
      });
    }

    const posixPath = normalizedPath.replace(/\\/g, '/');

    // 2. Allow public access to company branding logos
    if (posixPath.startsWith('/logos/') || posixPath === '/logos') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return next();
    }

    // 3. Protected assets: require valid JWT
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (typeof req.query.token === 'string') {
      token = req.query.token.trim();
    }

    if (!token) {
      return res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required to access protected files.',
      });
    }

    const secret = jwtSecretOverride || process.env.JWT_SECRET || 'gaugemaster';

    try {
      const decoded = jwt.verify(token, secret);
      (req as any).user = decoded;

      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return next();
    } catch {
      return res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token for file access.',
      });
    }
  };
}

export const uploadsAuthMiddleware = createUploadsAuthMiddleware();
