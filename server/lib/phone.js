// Нормализация казахстанских номеров в формат "77XXXXXXXXX"
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, ''); // убираем всё кроме цифр

  // Варианты ввода:
  //   "+7 708 505 0826"  → "77085050826"
  //   "87085050826"      → "77085050826"  (8 меняем на 7)
  //   "77085050826"      → "77085050826"
  //   "7085050826"       → "77085050826"  (без кода страны — добавляем 7)
  if (digits.length === 11 && digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return digits;
  }
  if (digits.length === 10) {
    return '7' + digits;
  }
  return null; // невалидный номер
}

function isValidKzPhone(phone) {
  // 11 цифр, начинается на 7, код оператора 700-778
  if (!/^7\d{10}$/.test(phone)) return false;
  const operator = phone.substring(1, 4);
  return parseInt(operator, 10) >= 700 && parseInt(operator, 10) <= 778;
}

module.exports = { normalizePhone, isValidKzPhone };