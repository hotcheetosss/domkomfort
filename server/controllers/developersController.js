const prisma = require('../lib/prisma');

// GET /api/admin/developers?search=BI
exports.list = async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const items = await prisma.developer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { properties: true, complexes: true } } },
    });

    res.json({
      count: items.length,
      items: items.map(d => ({
        id: d.id,
        name: d.name,
        propertiesCount: d._count.properties,
        complexesCount: d._count.complexes,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/developers — создать или вернуть существующего
exports.create = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    if (name.length > 100) return res.status(400).json({ error: 'Слишком длинное название' });

    // upsert по уникальному name
    const dev = await prisma.developer.upsert({
      where:  { name },
      update: {},
      create: { name },
    });

    res.json(dev);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/developers/:id — только если нет привязанных объектов и ЖК
exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dev = await prisma.developer.findUnique({
      where: { id },
      include: { _count: { select: { properties: true, complexes: true } } },
    });
    if (!dev) return res.status(404).json({ error: 'Не найден' });

    if (dev._count.properties > 0 || dev._count.complexes > 0) {
      return res.status(400).json({
        error: `Нельзя удалить — у застройщика ${dev._count.properties} объектов и ${dev._count.complexes} ЖК`,
      });
    }

    await prisma.developer.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};