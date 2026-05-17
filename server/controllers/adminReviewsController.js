const prisma = require('../lib/prisma');

const ALLOWED_SOURCES = ['2GIS', 'Krisha', 'Google', 'WhatsApp', 'Own'];

// ===== Список =====
exports.list = async (req, res, next) => {
  try {
    const { agentId } = req.query;
    const where = {};
    if (agentId) where.agentId = agentId;

    const items = await prisma.review.findMany({
      where,
      include: { agent: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ count: items.length, items });
  } catch (err) {
    next(err);
  }
};

// ===== Один отзыв =====
exports.getOne = async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: { agent: { select: { id: true, name: true } } },
    });
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
    res.json(review);
  } catch (err) {
    next(err);
  }
};

// ===== Создание =====
exports.create = async (req, res, next) => {
  try {
    const { agentId, authorName, text, source, visible, sortOrder } = req.body;

    if (!agentId || !authorName || !text) {
      return res.status(400).json({ error: 'Агент, имя автора и текст обязательны' });
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(400).json({ error: 'Агент не найден' });

    const created = await prisma.review.create({
      data: {
        agentId,
        authorName: String(authorName).trim().slice(0, 100),
        text: String(text).trim().slice(0, 2000),
        source: ALLOWED_SOURCES.includes(source) ? source : null,
        visible: visible !== false,
        sortOrder: Number.isFinite(parseInt(sortOrder, 10)) ? parseInt(sortOrder, 10) : 100,
      },
      include: { agent: { select: { id: true, name: true } } },
    });

    res.json(created);
  } catch (err) {
    next(err);
  }
};

// ===== Обновление =====
exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Отзыв не найден' });

    const updateData = {};
    if (req.body.agentId !== undefined) {
      const agent = await prisma.agent.findUnique({ where: { id: req.body.agentId } });
      if (!agent) return res.status(400).json({ error: 'Агент не найден' });
      updateData.agentId = req.body.agentId;
    }
    if (req.body.authorName !== undefined) updateData.authorName = String(req.body.authorName).trim().slice(0, 100);
    if (req.body.text !== undefined)       updateData.text = String(req.body.text).trim().slice(0, 2000);
    if (req.body.source !== undefined)     updateData.source = ALLOWED_SOURCES.includes(req.body.source) ? req.body.source : null;
    if (req.body.visible !== undefined)    updateData.visible = !!req.body.visible;
    if (req.body.sortOrder !== undefined) {
      const n = parseInt(req.body.sortOrder, 10);
      updateData.sortOrder = Number.isFinite(n) ? n : 100;
    }

    const updated = await prisma.review.update({
      where: { id },
      data: updateData,
      include: { agent: { select: { id: true, name: true } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// ===== Удаление =====
exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Отзыв не найден' });

    await prisma.review.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};