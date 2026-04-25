const prisma = require('../lib/prisma');

const VALID_STATUSES = ['new', 'in_progress', 'viewing', 'closed', 'rejected'];

// ===== Список =====
exports.list = async (req, res, next) => {
  try {
    const { status, search, period, agentId, unassigned } = req.query;

    const where = {};

    // Контроль прав: агент видит только свои + назначенные ему
    if (req.user.role === 'agent') {
      if (!req.user.agent) return res.json({ count: 0, items: [], stats: {} });
      where.agentId = req.user.agent.id;
    } else {
      // Админ может фильтровать
      if (agentId) where.agentId = agentId;
      if (unassigned === 'true') where.agentId = null;
    }

    if (status) where.status = status;

    if (search) {
      where.OR = [
        { name:    { contains: search, mode: 'insensitive' } },
        { phone:   { contains: search } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (period) {
      const now = new Date();
      let from = null;
      if (period === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'week') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (from) where.createdAt = { gte: from };
    }

    const items = await prisma.lead.findMany({
      where,
      include: {
        property: { select: { id: true, title: true, priceLabel: true, gallery: true, deal: true } },
        agent:    { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Статистика по статусам — для бейджей в тулбаре
    // (вычисляем по тем же правам видимости)
    const baseWhere = req.user.role === 'agent'
      ? { agentId: req.user.agent?.id || '__none__' }
      : {};

    const grouped = await prisma.lead.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    });

    const stats = { all: 0, new: 0, in_progress: 0, viewing: 0, closed: 0, rejected: 0, unassigned: 0 };
    for (const g of grouped) {
      stats[g.status] = g._count;
      stats.all += g._count;
    }
    if (req.user.role === 'admin') {
      const unas = await prisma.lead.count({ where: { agentId: null } });
      stats.unassigned = unas;
    }

    res.json({ count: items.length, items, stats });
  } catch (err) {
    next(err);
  }
};

// ===== Один lead =====
exports.getOne = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: {
        property: true,
        agent:    { select: { id: true, name: true, phone: true } },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Заявка не найдена' });

    if (!canAccessLead(req.user, lead)) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
};

// ===== Обновление (статус, заметки) =====
exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Заявка не найдена' });

    if (!canAccessLead(req.user, lead)) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const updateData = {};

    if (req.body.status !== undefined) {
      if (!VALID_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
      }
      updateData.status = req.body.status;
    }

    if (req.body.notes !== undefined) {
      updateData.notes = String(req.body.notes).slice(0, 5000);
    }

    // Назначение агента — только админ
    if (req.body.agentId !== undefined && req.user.role === 'admin') {
      if (req.body.agentId === null || req.body.agentId === '') {
        updateData.agentId = null;
      } else {
        const agent = await prisma.agent.findUnique({ where: { id: req.body.agentId } });
        if (!agent) return res.status(400).json({ error: 'Агент не найден' });
        updateData.agentId = req.body.agentId;
        // При назначении автоматически переводим в in_progress если ещё new
        if (lead.status === 'new' && req.body.status === undefined) {
          updateData.status = 'in_progress';
        }
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        property: { select: { id: true, title: true, priceLabel: true } },
        agent:    { select: { id: true, name: true, phone: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// ===== Удаление (только админ) =====
exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.lead.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== Helpers =====
function canAccessLead(user, lead) {
  if (user.role === 'admin') return true;
  if (!user.agent) return false;
  return lead.agentId === user.agent.id;
}