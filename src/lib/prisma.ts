import { PrismaClient } from '@prisma/client';

// Single Prisma client instance for the process
const prisma = new PrismaClient();
export default prisma;
