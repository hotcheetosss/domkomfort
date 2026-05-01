const prisma = require('../lib/prisma');

// GET /api/admin/complexes?search=Expo&developerId=1
exports.list = async (req, res, next) => {
  try {
    const { search, developerId } = req.query;
    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (developerId) {
      where.developerId = parseInt(developerId, 10);
    }

    const items = await prisma.residentialComplex.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        developer: { select: { id: true, name: true } },
        _count: { select: { properties: true } },
      },
    });

    res.json({
      count: items.length,
      items: items.map(c => ({
        id: c.id,
        name: c.name,
        developer: c.developer,
        developerId: c.developerId,
        propertiesCount: c._count.properties,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/complexes
exports.create = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    if (name.length > 100) return res.status(400).json({ error: 'Слишком длинное название' });

    let developerId = null;
    if (req.body.developerId) {
      developerId = parseInt(req.body.developerId, 10);
      const dev = await prisma.developer.findUnique({ where: { id: developerId } });
      if (!dev) return res.status(400).json({ error: 'Застройщик не найден' });
    }

    // upsert по комбинации (name, developerId)
    const complex = await prisma.residentialComplex.upsert({
      where:  { name_developerId: { name, developerId } },
      update: {},
      create: { name, developerId },
      include: { developer: { select: { id: true, name: true } } },
    });

    res.json(complex);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/complexes/:id
exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const complex = await prisma.residentialComplex.findUnique({
      where: { id },
      include: { _count: { select: { properties: true } } },
    });
    if (!complex) return res.status(404).json({ error: 'Не найден' });

    if (complex._count.properties > 0) {
      return res.status(400).json({
        error: `Нельзя удалить — у ЖК ${complex._count.properties} объектов`,
      });
    }

    await prisma.residentialComplex.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};