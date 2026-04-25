const prisma = require('../lib/prisma');

// Сериализация: BigInt нельзя напрямую в JSON, превращаем в строку
function serializeProperty(p) {
  if (!p) return null;
  return {
    ...p,
    price: p.priceLabel,       // на фронт отдаём форматированную "93 400 000"
    _priceNumeric: p.price.toString(),  // цифровая версия для JS-фильтров
  };
}

exports.list = async (req, res, next) => {
  try {
    const { type, deal, district, agentId } = req.query;

    const where = { active: true };
    if (type)     where.type = type;
    if (deal)     where.deal = deal;
    if (district) where.district = district;
    if (agentId)  where.agentId = agentId;

    const items = await prisma.property.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      count: items.length,
      items: items.map(serializeProperty),
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const p = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: { agent: true },     // сразу подтянуть данные агента
    });
    if (!p) return res.status(404).json({ error: 'Объект не найден' });
    res.json(serializeProperty(p));
  } catch (err) {
    next(err);
  }
};