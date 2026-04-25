// Singleton Prisma Client — один экземпляр на всё приложение.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Корректное завершение при остановке сервера
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;