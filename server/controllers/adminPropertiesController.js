const prisma = require('../lib/prisma');
const { nanoid } = require('nanoid');
const photoService = require('../services/photoService');

// ===== Хелперы =====

const ALLOWED_LABEL_COLORS = ['blue', 'yellow', 'red', 'green', 'purple', 'gray'];
const ALLOWED_CONDITIONS = [
  'Без отделки',
  'Черновая отделка',
  'Предчистовая отделка',
  'Косметический ремонт',
  'Хороший ремонт',
  'Дизайнерский ремонт',
  'Свободная планировка',
];

const ALLOWED_PAYMENT_TYPES = ['cash', 'mortgage', 'any'];

function sanitizeLabels(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(item => item && typeof item.text === 'string' && item.text.trim())
    .slice(0, 2)  // максимум 2 лейбла
    .map(item => ({
      text: String(item.text).trim().slice(0, 30),  // максимум 30 символов
      color: ALLOWED_LABEL_COLORS.includes(item.color) ? item.color : 'blue',
    }));
}

// BigInt -> JSON дружественный формат
function serialize(p) {
  if (!p) return null;
  return {
    ...p,
    price: p.priceLabel,
    _priceNumeric: p.price ? p.price.toString() : '0',
    customLabels: Array.isArray(p.customLabels) ? p.customLabels : [],
  };
}

// Нормализация цены из строки "93 400 000" в { numeric: BigInt, label: "93 400 000" }
function parsePrice(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const digits = String(raw).replace(/\s+/g, '').replace(/\D/g, '');
  if (!digits) return null;
  const numeric = BigInt(digits);
  // Форматируем с пробелами: 93400000 → "93 400 000"
  const label = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return { numeric, label };
}

// Валидация обязательных полей
function validatePropertyInput(data, { isNew } = { isNew: false }) {
  const errors = [];
  const required = ['title', 'type', 'deal', 'price', 'district', 'address', 'sqm', 'totalFloors', 'year', 'description', 'agentId'];
  if (isNew) {
    for (const f of required) {
      if (data[f] === undefined || data[f] === null || data[f] === '') {
        errors.push(`Поле «${f}» обязательно`);
      }
    }
  }
  if (data.type && !['Квартира', 'Новостройка', 'Дом', 'Коммерция'].includes(data.type)) {
    errors.push('Недопустимый тип объекта');
  }
  if (data.deal && !['sale', 'rent'].includes(data.deal)) {
    errors.push('Недопустимый тип сделки');
  }
  return errors;
}

// Проверяет что user имеет право трогать этот объект.
// admin — всё; agent — только свои (его user.id в agent.userId).
async function canEditProperty(user, property) {
  if (user.role === 'admin') return true;
  if (!user.agent || !property) return false;
  return property.agentId === user.agent.id;
}

// ===== CRUD =====

exports.list = async (req, res, next) => {
  try {
    const { search, type, deal, district, active, agentId } = req.query;

    const where = {};

    // Агент видит только свои объекты, админ — всё
    if (req.user.role === 'agent') {
      if (!req.user.agent) {
        return res.json({ count: 0, items: [] });     // user-agent без привязки к профилю
      }
      where.agentId = req.user.agent.id;
    } else if (agentId) {
      where.agentId = agentId;                         // admin может фильтровать по агенту
    }

    if (type)     where.type = type;
    if (deal)     where.deal = deal;
    if (district) where.district = district;
    if (active === 'true')  where.active = true;
    if (active === 'false') where.active = false;
    if (search) {
      where.OR = [
        { title:   { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.property.findMany({
      where,
      include: {
        agent:              { select: { id: true, name: true, phone: true } },
        developer:          { select: { id: true, name: true } },
        residentialComplex: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ count: items.length, items: items.map(serialize) });
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

    if (!(await canEditProperty(req.user, p))) {
      return res.status(403).json({ error: 'Нет прав для просмотра' });
    }
    

    res.json(serialize(p));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const errors = validatePropertyInput(req.body, { isNew: true });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    const price = parsePrice(req.body.price);
    if (!price) return res.status(400).json({ error: 'Некорректная цена' });

    // Агент может создавать только от своего имени
    let agentId = req.body.agentId;
    if (req.user.role === 'agent') {
      if (!req.user.agent) return res.status(403).json({ error: 'У вашего аккаунта нет профиля агента' });
      agentId = req.user.agent.id;                    // игнорируем что пришло с фронта
    }

    // Проверяем что такой агент есть
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(400).json({ error: 'Агент не найден' });

    const id = 'p' + nanoid(8);

    const created = await prisma.property.create({
      data: {
        id,
        title:         req.body.title,
        type:          req.body.type,
        deal:          req.body.deal,
        price:         price.numeric,
        priceLabel:    price.label,
        district:      req.body.district,
        address:       req.body.address,
        sqm:           parseFloat(req.body.sqm),
        rooms:         parseInt(req.body.rooms || 0, 10),
        floor:         req.body.floor ? parseInt(req.body.floor, 10) : null,
        totalFloors:   parseInt(req.body.totalFloors, 10),
        year:          parseInt(req.body.year, 10),
        ceilingHeight: req.body.ceilingHeight ? parseFloat(req.body.ceilingHeight) : null,
        bathroom:      req.body.bathroom || null,
        condition:     ALLOWED_CONDITIONS.includes(req.body.condition) ? req.body.condition : null,
        parking:       req.body.parking || null,
        balcony:       req.body.balcony || null,
        description:   req.body.description,
        features:      Array.isArray(req.body.features) ? req.body.features : [],
        gallery:       [],                            // фото загружаются отдельно
        top:           !!req.body.top,
        active:        req.body.active !== false,
        housingClass:         req.body.housingClass || null,
        buildingType:         req.body.buildingType || null,
        developerId:          req.body.developerId          ? parseInt(req.body.developerId, 10)          : null,
        residentialComplexId: req.body.residentialComplexId ? parseInt(req.body.residentialComplexId, 10) : null,
        customLabels:         sanitizeLabels(req.body.customLabels),
        videoUrl:             req.body.videoUrl ? String(req.body.videoUrl).trim().slice(0, 500) || null : null,
        paymentType:          ALLOWED_PAYMENT_TYPES.includes(req.body.paymentType) ? req.body.paymentType : null,
        agentId,
      },
    });

    res.json(serialize(created));
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Объект не найден' });

    if (!(await canEditProperty(req.user, existing))) {
      return res.status(403).json({ error: 'Нет прав для редактирования' });
    }

    const errors = validatePropertyInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    const updateData = {};
    const directFields = ['title', 'type', 'deal', 'district', 'address', 'bathroom', 'parking', 'balcony', 'description', 'paymentType'];
    for (const f of directFields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }
    if (req.body.sqm !== undefined)           updateData.sqm = parseFloat(req.body.sqm);
    if (req.body.rooms !== undefined)         updateData.rooms = parseInt(req.body.rooms, 10);
    if (req.body.floor !== undefined)         updateData.floor = req.body.floor ? parseInt(req.body.floor, 10) : null;
    if (req.body.totalFloors !== undefined)   updateData.totalFloors = parseInt(req.body.totalFloors, 10);
    if (req.body.year !== undefined)          updateData.year = parseInt(req.body.year, 10);
    if (req.body.ceilingHeight !== undefined) updateData.ceilingHeight = req.body.ceilingHeight ? parseFloat(req.body.ceilingHeight) : null;
    if (req.body.features !== undefined)      updateData.features = Array.isArray(req.body.features) ? req.body.features : [];
    if (req.body.top !== undefined)           updateData.top = !!req.body.top;
    if (req.body.active !== undefined)        updateData.active = !!req.body.active;
    if (req.body.housingClass !== undefined)         updateData.housingClass = req.body.housingClass || null;
    if (req.body.buildingType !== undefined)         updateData.buildingType = req.body.buildingType || null;
    if (req.body.developerId !== undefined)          updateData.developerId = req.body.developerId ? parseInt(req.body.developerId, 10) : null;
    if (req.body.residentialComplexId !== undefined) updateData.residentialComplexId = req.body.residentialComplexId ? parseInt(req.body.residentialComplexId, 10) : null;
    if (req.body.condition !== undefined) {
      updateData.condition = ALLOWED_CONDITIONS.includes(req.body.condition) ? req.body.condition : null;
    }
    if (req.body.paymentType !== undefined) {
      updateData.paymentType = ALLOWED_PAYMENT_TYPES.includes(req.body.paymentType) ? req.body.paymentType : null;
    }
    if (req.body.customLabels !== undefined)         updateData.customLabels = sanitizeLabels(req.body.customLabels);
    if (req.body.videoUrl !== undefined) {
      updateData.videoUrl = req.body.videoUrl ? String(req.body.videoUrl).trim().slice(0, 500) || null : null;
    }
    if (req.body.price !== undefined) {
      const price = parsePrice(req.body.price);
      if (!price) return res.status(400).json({ error: 'Некорректная цена' });
      updateData.price = price.numeric;
      updateData.priceLabel = price.label;
    }

    // Смена агента — только для админа
    if (req.body.agentId !== undefined && req.user.role === 'admin') {
      const agent = await prisma.agent.findUnique({ where: { id: req.body.agentId } });
      if (!agent) return res.status(400).json({ error: 'Агент не найден' });
      updateData.agentId = req.body.agentId;
    }

    const updated = await prisma.property.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
};

// Soft delete: active = false
exports.deactivate = async (req, res, next) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Объект не найден' });

    if (!(await canEditProperty(req.user, existing))) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const updated = await prisma.property.update({
      where: { id: req.params.id },
      data:  { active: false },
    });
    res.json({ ok: true, property: serialize(updated) });
  } catch (err) {
    next(err);
  }
};

// Полное удаление — только админ
exports.remove = async (req, res, next) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Объект не найден' });

    // Удаляем фото с диска
    await photoService.deletePropertyFolder(req.params.id);

    // Удаляем заявки, привязанные к этому объекту (обнуляем связь)
    await prisma.lead.updateMany({
      where: { propertyId: req.params.id },
      data:  { propertyId: null },
    });

    await prisma.property.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== Фото =====

exports.uploadPhotos = async (req, res, next) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Объект не найден' });

    if (!(await canEditProperty(req.user, existing))) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Не загружено ни одного файла' });
    }

    const buffers = req.files.map(f => f.buffer);
    const newUrls = await photoService.saveMany(buffers, req.params.id);

    const updated = await prisma.property.update({
      where: { id: req.params.id },
      data:  { gallery: [...existing.gallery, ...newUrls] },
    });

    res.json({ ok: true, gallery: updated.gallery, added: newUrls });
  } catch (err) {
    next(err);
  }
};

exports.deletePhoto = async (req, res, next) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Объект не найден' });

    if (!(await canEditProperty(req.user, existing))) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Не указан url фото' });

    // Удаляем файл с диска
    await photoService.deleteByUrl(url);

    // Обновляем массив в БД
    const updated = await prisma.property.update({
      where: { id: req.params.id },
      data:  { gallery: existing.gallery.filter(u => u !== url) },
    });

    res.json({ ok: true, gallery: updated.gallery });
  } catch (err) {
    next(err);
  }
};

exports.reorderPhotos = async (req, res, next) => {
  try {
    const existing = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Объект не найден' });

    if (!(await canEditProperty(req.user, existing))) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const { gallery } = req.body;
    if (!Array.isArray(gallery)) return res.status(400).json({ error: 'Некорректный порядок' });

    // Проверяем что пришёл тот же набор фото, что был (без новых и без удалённых)
    const sameSet = existing.gallery.length === gallery.length &&
      existing.gallery.every(u => gallery.includes(u));
    if (!sameSet) return res.status(400).json({ error: 'Набор фото не совпадает' });

    const updated = await prisma.property.update({
      where: { id: req.params.id },
      data:  { gallery },
    });

    res.json({ ok: true, gallery: updated.gallery });
  } catch (err) {
    next(err);
  }
};