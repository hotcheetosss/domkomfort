const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/developers — список всех застройщиков (только тех, у кого есть активные объекты)
router.get('/developers', async (req, res, next) => {
  try {
    const items = await prisma.developer.findMany({
      where: {
        properties: { some: { active: true } },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// GET /api/complexes — список всех ЖК (только с активными объектами)
router.get('/complexes', async (req, res, next) => {
  try {
    const { developerId } = req.query;
    const where = {
      properties: { some: { active: true } },
    };
    if (developerId) {
      where.developerId = parseInt(developerId, 10);
    }

    const items = await prisma.residentialComplex.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        developerId: true,
        developer: { select: { id: true, name: true } },
      },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;