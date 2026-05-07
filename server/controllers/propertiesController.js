const prisma = require('../lib/prisma');

// Сериализация: BigInt нельзя напрямую в JSON, превращаем в строку
function serializeProperty(p) {
  if (!p) return null;
  return {
    ...p,
    price: p.priceLabel,       // на фронт отдаём форматированную "93 400 000"
    _priceNumeric: p.price.toString(),  // цифровая версия для JS-фильтров
    customLabels: Array.isArray(p.customLabels) ? p.customLabels : [],
  };
}

exports.list = async (req, res, next) => {
  try {
    const {
      type, deal, district, agentId,
      developerId, complexId, housingClass, buildingType,
      condition, paymentType,
      yearMin, yearMax, floorMin, floorMax,
    } = req.query;

    const where = { active: true };
    if (type)         where.type = type;
    if (deal)         where.deal = deal;
    if (district)     where.district = district;
    if (agentId)      where.agentId = agentId;
    if (developerId)  where.developerId = parseInt(developerId, 10);
    if (complexId)    where.residentialComplexId = parseInt(complexId, 10);
    if (housingClass) where.housingClass = housingClass;
    if (buildingType) where.buildingType = buildingType;
    if (condition) where.condition = condition;
    if (paymentType) {
      // объект с paymentType="any" подходит и для cash, и для mortgage
      where.OR = [
        { paymentType: paymentType },
        { paymentType: 'any' },
      ];
    }

    if (yearMin || yearMax) {
      where.year = {};
      if (yearMin) where.year.gte = parseInt(yearMin, 10);
      if (yearMax) where.year.lte = parseInt(yearMax, 10);
    }
    if (floorMin || floorMax) {
      where.floor = {};
      if (floorMin) where.floor.gte = parseInt(floorMin, 10);
      if (floorMax) where.floor.lte = parseInt(floorMax, 10);
    }

    const items = await prisma.property.findMany({
      where,
      include: {
        developer:          { select: { id: true, name: true } },
        residentialComplex: { select: { id: true, name: true } },
      },
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
      include: {
        agent: true,
        developer: true,
        residentialComplex: { include: { developer: true } },
      },
    });
    if (!p) return res.status(404).json({ error: 'Объект не найден' });
    res.json(serializeProperty(p));
  } catch (err) {
    next(err);
  }
};