const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const dataDir = path.join(__dirname, '../server/data');
const leadership  = JSON.parse(fs.readFileSync(path.join(dataDir, 'leadership.json'),  'utf8'));
const agents      = JSON.parse(fs.readFileSync(path.join(dataDir, 'agents.json'),      'utf8'));
const properties  = JSON.parse(fs.readFileSync(path.join(dataDir, 'properties.json'),  'utf8'));

async function main() {
  console.log('🌱 Seeding database...\n');

  console.log('  Очистка старых данных...');
  await prisma.lead.deleteMany();
  await prisma.property.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.leadership.deleteMany();
  await prisma.user.deleteMany();

  // 1. Создаём админа
  console.log('  Создаём админский аккаунт...');
  const adminPassword = await bcrypt.hash('admin12345', 10);
  await prisma.user.create({
    data: {
      phone:    '77085050826',
      password: adminPassword,
      name:     'Мадина Каиржановна',
      role:     'admin',
      active:   true,
    },
  });

  // 2. Руководство
  console.log(`  Загружаем ${leadership.length} руководителей...`);
  for (const [i, person] of leadership.entries()) {
    await prisma.leadership.create({
      data: {
        name:      person.name,
        role:      person.role,
        expertise: person.expertise,
        topics:    person.topics,
        img:       person.img,
        sortOrder: i,
      },
    });
  }

  // 3. Агенты
  console.log(`  Загружаем ${agents.length} агентов...`);
  for (const a of agents) {
    await prisma.agent.create({
      data: {
        id:             a.id,
        name:           a.name,
        role:           a.role,
        specialization: a.specialization,
        listings:       a.listings || 0,
        phone:          a.phone,
        img:            a.img,
        awards:         a.awards || [],
      },
    });
  }

  // 4. Объекты
  console.log(`  Загружаем ${properties.length} объектов...`);
  for (const p of properties) {
    const priceNumeric = BigInt(String(p.price).replace(/\s/g, ''));

    await prisma.property.create({
      data: {
        id:            p.id,
        title:         p.title,
        type:          p.type,
        deal:          p.deal,
        price:         priceNumeric,
        priceLabel:    p.price,
        district:      p.district,
        address:       p.address,
        sqm:           p.sqm,
        rooms:         p.rooms || 0,
        floor:         p.floor || null,
        totalFloors:   p.totalFloors,
        year:          p.year,
        ceilingHeight: p.ceilingHeight || null,
        bathroom:      p.bathroom || null,
        condition:     p.condition || null,
        parking:       p.parking || null,
        balcony:       p.balcony || null,
        description:   p.description,
        features:      p.features || [],
        gallery:       p.gallery || [],
        top:           !!p.top,
        active:        true,
        agentId:       p.agentId,
      },
    });
  }

  console.log('\n✅ Готово! База заполнена.');
  console.log('\n👤 Админский аккаунт:');
  console.log('   Телефон: +7 708 505 0826');
  console.log('   Пароль:  admin12345\n');
}

main()
  .catch(e => {
    console.error('❌ Ошибка при сидировании:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });