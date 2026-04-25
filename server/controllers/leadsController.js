const prisma = require('../lib/prisma');

exports.create = async (req, res, next) => {
  try {
    const { name, phone, message, source, propertyId, agentId } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Имя и телефон обязательны' });
    }

    const lead = await prisma.lead.create({
      data: {
        name:       String(name).slice(0, 100),
        phone:      String(phone).slice(0, 30),
        message:    message ? String(message).slice(0, 1000) : null,
        source:     source || 'website',
        propertyId: propertyId || null,
        agentId:    agentId || null,
        ip:         req.ip,
      },
    });

    console.log('📩 Новая заявка:', lead.name, lead.phone, lead.source);

    // TODO: в будущем — уведомление менеджеру (email / WhatsApp / Telegram)

    res.json({
      ok: true,
      message: 'Заявка принята. Мы свяжемся с вами в течение часа.',
    });
  } catch (err) {
    next(err);
  }
};