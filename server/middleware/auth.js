const { verify } = require('../lib/jwt');
const prisma = require('../lib/prisma');

// Требует валидный JWT-токен. Кладёт в req.user данные пользователя.
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const payload = verify(token);
    if (!payload) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { agent: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Аккаунт недоступен' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Требует конкретную роль (или массив ролей)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };