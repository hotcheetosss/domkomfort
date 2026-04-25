const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const sharp = require('sharp');
const { nanoid } = require('nanoid');

const UPLOADS_ROOT = path.join(__dirname, '../../uploads/properties');

// Сохраняет фото объекта, возвращает относительный URL
async function saveOne(buffer, propertyId) {
  const dir = path.join(UPLOADS_ROOT, propertyId);
  await fs.mkdir(dir, { recursive: true });

  const filename = nanoid(10) + '.jpg';
  const fullPath = path.join(dir, filename);

  // Обрабатываем через sharp: макс. 1920px, JPEG качества 85
  await sharp(buffer)
    .rotate()                                         // учитывает EXIF-ориентацию телефонных фото
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(fullPath);

  // URL, по которому фото будет доступно через браузер
  return `/uploads/properties/${propertyId}/${filename}`;
}

// Сохраняет массив фото (batch)
async function saveMany(buffers, propertyId) {
  const urls = [];
  for (const buf of buffers) {
    urls.push(await saveOne(buf, propertyId));
  }
  return urls;
}

// Удаляет физический файл по URL
async function deleteByUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, '../..', url);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    // файла может не быть — не критично
    if (err.code !== 'ENOENT') throw err;
  }
}

// Удаляет всю папку объекта
async function deletePropertyFolder(propertyId) {
  const dir = path.join(UPLOADS_ROOT, propertyId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
// Сохраняет фото агента (квадратное)
async function saveAgentAvatar(buffer, agentId) {
  const dir = path.join(__dirname, '../../uploads/agents');
  await fs.mkdir(dir, { recursive: true });

  const filename = agentId + '_' + nanoid(6) + '.jpg';
  const fullPath = path.join(dir, filename);

  await sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: 'cover' })   // квадрат для аватара
    .jpeg({ quality: 88, progressive: true })
    .toFile(fullPath);

  return `/uploads/agents/${filename}`;
}

async function deleteAgentAvatar(url) {
  if (!url || !url.startsWith('/uploads/agents/')) return;
  const filePath = path.join(__dirname, '../..', url);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { saveOne, saveMany, deleteByUrl, deletePropertyFolder, saveAgentAvatar, deleteAgentAvatar };