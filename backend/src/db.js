// Cliente de Prisma compartido (pool ajustado para concurrencia)

const { PrismaClient } = require('@prisma/client');

// Optimización de Conexiones Prisma (Pool size y timeout para concurrencia)
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=20&pool_timeout=10';
  process.env.DATABASE_URL = dbUrl;
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = { prisma };
