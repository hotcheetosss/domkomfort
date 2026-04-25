const prisma = require('../lib/prisma');

exports.list = async (req, res, next) => {
  try {
    const [leadership, agents] = await Promise.all([
      prisma.leadership.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.agent.findMany({ orderBy: { name: 'asc' } }),
    ]);
    res.json({ leadership, agents });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        properties: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!agent) return res.status(404).json({ error: 'Агент не найден' });

    // Сериализуем BigInt у вложенных объектов
    const props = agent.properties.map(p => ({
      ...p,
      price: p.priceLabel,
      _priceNumeric: p.price.toString(),
    }));

    res.json({ ...agent, properties: props });
  } catch (err) {
    next(err);
  }
};