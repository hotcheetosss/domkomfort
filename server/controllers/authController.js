const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { sign } = require('../lib/jwt');
const { normalizePhone, isValidKzPhone } = require('../lib/phone');

exports.login = async (req, res, next) => {
  try {
    const { phone: rawPhone, password } = req.body;

    if (!rawPhone || !password) {
      return res.status(400).json({ error: 'Номер и пароль обязательны' });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone || !isValidKzPhone(phone)) {
      return res.status(400).json({ error: 'Введите корректный казахстанский номер' });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { agent: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Неверный номер или пароль' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Неверный номер или пароль' });
    }

    // Обновляем дату последнего входа
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = sign({ userId: user.id, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        agent: user.agent,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({
    id: req.user.id,
    phone: req.user.phone,
    name: req.user.name,
    role: req.user.role,
    agent: req.user.agent,
  });
};

exports.logout = (req, res) => {
  // JWT stateless — клиент просто удаляет токен из localStorage.
  // Этот эндпоинт нужен для единообразия и будущих улучшений (blacklist и т.д.)
  res.json({ ok: true });
};