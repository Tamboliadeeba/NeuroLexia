import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to carry decoded JWT payload
declare global {
  namespace Express {
    interface Request {
      parentId?: string;
      childId?: string;
      jwtPayload?: JwtPayload;
    }
  }
}

export type JwtRole = 'parent' | 'child' | 'pending_child';

export interface JwtPayload {
  role: JwtRole;
  parentId?: string;
  childId?: string;
  iat?: number;
  exp?: number;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function verifyJwt(req: Request, res: Response): JwtPayload | null {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

export function requireParent(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyJwt(req, res);
  if (!payload) return;
  if (payload.role !== 'parent') {
    res.status(403).json({ error: 'Forbidden: parent access required' });
    return;
  }
  req.parentId = payload.parentId;
  req.jwtPayload = payload;
  next();
}

export function requireChild(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyJwt(req, res);
  if (!payload) return;
  if (payload.role !== 'child') {
    res.status(403).json({ error: 'Forbidden: child access required' });
    return;
  }
  req.childId = payload.childId;
  req.jwtPayload = payload;
  next();
}

export function requirePendingChild(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyJwt(req, res);
  if (!payload) return;
  if (payload.role !== 'pending_child') {
    res.status(403).json({ error: 'Forbidden: pending_child token required' });
    return;
  }
  req.childId = payload.childId;
  req.jwtPayload = payload;
  next();
}
