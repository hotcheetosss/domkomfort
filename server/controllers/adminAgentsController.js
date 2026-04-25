const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { normalizePhone, isValidKzPhone } = require('../lib/phone');
const photoService = require('../services/photoService');

// ===== Список =====
exports.list = async (req, res, next) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' },
      include: {
        user: {
          select: { id: true, phone: true, role: true, active: true, lastLoginAt: true },
        },
        _count: { select: { properties: true } },
      },
    });

    // Маскируем номер телефона user (на всякий случай — на фронт он не нужен)
    res.json({
      count: agents.length,
      items: agents.map(a => ({
        ...a,
        propertiesCount: a._count.properties,
        _count: undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ===== Один агент =====
exports.getOne = async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, phone: true, role: true, active: true, lastLoginAt: true } },
        _count: { select: { properties: true } },
      },
    });
    if (!agent) return res.status(404).json({ error: 'Агент не найден' });
    res.json({ ...agent, propertiesCount: agent._count.properties, _count: undefined });
  } catch (err) {
    next(err);
  }
};

// ===== Создание агента =====
exports.create = async (req, res, next) => {
  try {
    const { name, role, specialization, phone: rawPhone, awards, withAccount, password } = req.body;

    if (!name || !role || !specialization || !rawPhone) {
      return res.status(400).json({ error: 'Имя, должность, специализация и телефон обязательны' });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone || !isValidKzPhone(phone)) {
      return res.status(400).json({ error: 'Введите корректный казахстанский номер' });
    }

    // Если создаётся аккаунт для входа — пароль обязателен
    // Валидация пароля до начала транзакции
    if (withAccount) {
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов' });
      }
      const existingUser = await prisma.user.findUnique({ where: { phone } });
      if (existingUser) {
        return res.status(400).json({ error: 'Этот номер уже привязан к другому аккаунту' });
      }
    }

    // Генерируем id агента
    const allAgents = await prisma.agent.findMany({
      where: { id: { startsWith: 'a' } },
      select: { id: true },
    });
    let maxNum = 0;
    for (const a of allAgents) {
      const num = parseInt(a.id.slice(1), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const id = 'a' + (maxNum + 1);

    // Транзакция: либо создаются и user, и agent — либо ничего
    const result = await prisma.$transaction(async (tx) => {
      let userId = null;

      if (withAccount) {
        const hashed = await bcrypt.hash(password, 10);
        const user = await tx.user.create({
          data: {
            phone,
            password: hashed,
            name,
            role: 'agent',
            active: true,
          },
        });
        userId = user.id;
      }

      const agent = await tx.agent.create({
        data: {
          id,
          name,
          role,
          specialization,
          phone,
          listings: 0,
          awards: Array.isArray(awards) ? awards : [],
          userId,
        },
      });

      return agent;
    });

    res.json({ ...result, ok: true });
  } catch (err) {
    next(err);
  }
};

// ===== Обновление =====
exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!existing) return res.status(404).json({ error: 'Агент не найден' });

    // Права: admin может редактировать любого, agent — только свой профиль
    if (req.user.role === 'agent') {
      if (!req.user.agent || req.user.agent.id !== existing.id) {
        return res.status(403).json({ error: 'Нет прав' });
      }
    }

    const updateData = {};
    if (req.body.name !== undefined)           updateData.name = String(req.body.name).trim();
    if (req.body.role !== undefined)           updateData.role = String(req.body.role).trim();
    if (req.body.specialization !== undefined) updateData.specialization = String(req.body.specialization).trim();
    if (req.body.awards !== undefined)         updateData.awards = Array.isArray(req.body.awards) ? req.body.awards : [];

    // Телефон — отдельная логика, синхронизируем с user если есть
    if (req.body.phone !== undefined) {
      const phone = normalizePhone(req.body.phone);
      if (!phone || !isValidKzPhone(phone)) {
        return res.status(400).json({ error: 'Введите корректный казахстанский номер' });
      }

      if (existing.userId) {
        // Проверяем, не занят ли этот номер другим юзером
        const conflict = await prisma.user.findFirst({
          where: { phone, NOT: { id: existing.userId } },
        });
        if (conflict) {
          return res.status(400).json({ error: 'Этот номер уже используется' });
        }
        await prisma.user.update({
          where: { id: existing.userId },
          data: { phone },
        });
      }
      updateData.phone = phone;
    }

    const updated = await prisma.agent.update({
      where: { id: existing.id },
      data: updateData,
      include: { user: { select: { id: true, phone: true, role: true, active: true } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// ===== Загрузка аватара =====
exports.uploadAvatar = async (req, res, next) => {
  try {
    const existing = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Агент не найден' });

    if (req.user.role === 'agent') {
      if (!req.user.agent || req.user.agent.id !== existing.id) {
        return res.status(403).json({ error: 'Нет прав' });
      }
    }

    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const newUrl = await photoService.saveAgentAvatar(req.file.buffer, existing.id);

    // Удаляем старый аватар (только если был наш загруженный, не unsplash)
    if (existing.img && existing.img.startsWith('/uploads/')) {
      await photoService.deleteAgentAvatar(existing.img);
    }

    const updated = await prisma.agent.update({
      where: { id: existing.id },
      data: { img: newUrl },
    });

    res.json({ ok: true, img: newUrl, agent: updated });
  } catch (err) {
    next(err);
  }
};

// ===== Управление аккаунтом (только админ) =====

// Создать user-аккаунт для существующего агента (если его не было)
exports.createAccount = async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!agent) return res.status(404).json({ error: 'Агент не найден' });
    if (agent.userId) return res.status(400).json({ error: 'У агента уже есть аккаунт' });

    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов' });
    }

    const existing = await prisma.user.findUnique({ where: { phone: agent.phone } });
    if (existing) return res.status(400).json({ error: 'Номер уже занят другим аккаунтом' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        phone: agent.phone,
        password: hashed,
        name: agent.name,
        role: 'agent',
        active: true,
      },
    });

    await prisma.agent.update({
      where: { id: agent.id },
      data: { userId: user.id },
    });

    res.json({ ok: true, login: agent.phone });
  } catch (err) {
    next(err);
  }
};

// Сбросить пароль
exports.resetPassword = async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!agent || !agent.userId) return res.status(404).json({ error: 'Аккаунт не найден' });

    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: agent.userId },
      data: { password: hashed },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// Заблокировать / разблокировать
exports.toggleActive = async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!agent || !agent.userId) return res.status(404).json({ error: 'Аккаунт не найден' });

    const newState = !agent.user.active;
    await prisma.user.update({
      where: { id: agent.userId },
      data: { active: newState },
    });

    res.json({ ok: true, active: newState });
  } catch (err) {
    next(err);
  }
};

// Полное удаление агента (только админ, и нельзя если есть привязанные объекты)
exports.remove = async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { properties: true } },
      },
    });
    if (!agent) return res.status(404).json({ error: 'Агент не найден' });

    if (agent._count.properties > 0) {
      return res.status(400).json({
        error: `Нельзя удалить — у агента ${agent._count.properties} объектов. Сначала переназначьте их.`,
      });
    }

    // Удаляем аватар с диска
    if (agent.img && agent.img.startsWith('/uploads/')) {
      await photoService.deleteAgentAvatar(agent.img);
    }

    // Обнуляем заявки которые шли на этого агента
    await prisma.lead.updateMany({
      where: { agentId: agent.id },
      data: { agentId: null },
    });

    // Удаляем агента и связанного user (если был)
    if (agent.userId) {
      await prisma.user.delete({ where: { id: agent.userId } });
    }
    await prisma.agent.delete({ where: { id: agent.id } });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};