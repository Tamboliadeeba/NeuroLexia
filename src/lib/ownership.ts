import type { Response } from 'express';
import prisma from './prisma';

/**
 * Verify that childId belongs to parentId.
 * Returns true if ownership is confirmed; sends 404 and returns false otherwise
 * (we use 404 rather than 403 to avoid revealing that the child exists).
 */
export async function assertOwnership(
  parentId: string,
  childId: string,
  res: Response,
): Promise<boolean> {
  const child = await prisma.child.findFirst({
    where: { id: childId, parent_id: parentId },
    select: { id: true },
  });
  if (!child) {
    res.status(404).json({ error: 'Child not found' });
    return false;
  }
  return true;
}
