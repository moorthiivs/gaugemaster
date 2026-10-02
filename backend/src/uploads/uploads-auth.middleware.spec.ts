import { createUploadsAuthMiddleware } from './uploads-auth.middleware';
import * as jwt from 'jsonwebtoken';

describe('UploadsAuthMiddleware', () => {
  const secret = 'test-jwt-secret-key-123456';
  const middleware = createUploadsAuthMiddleware(secret);

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  };

  it('should reject path traversal attempts with 400 Bad Request', () => {
    const req: any = { path: '/../secrets.env', headers: {}, query: {} };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('traversal') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow public access to /logos without a token', () => {
    const req: any = { path: '/logos/company-logo.png', headers: {}, query: {} };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(next).toHaveBeenCalled();
  });

  it('should reject access to certificates without token with 401', () => {
    const req: any = { path: '/certificates/cert-123.pdf', headers: {}, query: {} };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Authentication required') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject access to certificates with invalid token with 401', () => {
    const req: any = {
      path: '/certificates/cert-123.pdf',
      headers: { authorization: 'Bearer invalid.token.here' },
      query: {},
    };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Invalid or expired') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow access to certificates with valid Bearer token in header', () => {
    const validToken = jwt.sign({ sub: 'user-1', email: 'test@example.com' }, secret);
    const req: any = {
      path: '/certificates/cert-123.pdf',
      headers: { authorization: `Bearer ${validToken}` },
      query: {},
    };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('user-1');
    expect(next).toHaveBeenCalled();
  });

  it('should allow access to certificates with valid token in query param', () => {
    const validToken = jwt.sign({ sub: 'user-2', email: 'user2@example.com' }, secret);
    const req: any = {
      path: '/work-instructions/doc-abc.pdf',
      headers: {},
      query: { token: validToken },
    };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('user-2');
    expect(next).toHaveBeenCalled();
  });
});
