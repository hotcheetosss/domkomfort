# Дом Комфорт

Сайт агентства недвижимости «Дом Комфорт» в Астане.

## Стек

- **Backend:** Node.js + Express
- **Frontend:** HTML + Tailwind CSS (CDN) + vanilla JS (ES modules)
- **Данные:** JSON-файлы (на старте, затем можно перенести в MongoDB)

## Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env
cp .env.example .env
#    при желании отредактировать значения

# 3. Запустить в dev-режиме (auto-reload)
npm run dev

# или в обычном режиме
npm start
```

Открыть: http://localhost:3000

## Структура

```
domkomfort/
├── client/                  # Фронтенд (статика)
│   ├── index.html           # Основной HTML (SPA)
│   └── assets/
│       ├── css/styles.css
│       ├── js/              # app.js, agents.js, properties.js, api.js
│       └── img/             # логотип, фото
│
├── server/                  # Backend Node.js
│   ├── server.js            # Точка входа Express
│   ├── routes/              # /api/properties, /api/agents, /api/leads
│   ├── controllers/         # Логика обработки запросов
│   ├── services/            # Email / WhatsApp сервисы
│   ├── middleware/          # errorHandler и пр.
│   └── data/                # JSON с объектами и агентами
│
├── .env                     # Секреты (не коммитить)
├── .env.example             # Шаблон
├── package.json
└── README.md
```

## API

- `GET /api/properties` — список объектов (фильтры `?type=&deal=&district=`)
- `GET /api/properties/:id` — объект по id
- `GET /api/agents` — список агентов (+ leadership)
- `GET /api/agents/:id` — агент по id (с его объектами)
- `POST /api/leads` — отправка заявки

## Что делать дальше

1. Подключить MongoDB и перенести JSON в модели Mongoose.
2. Сделать админ-панель для менеджеров (CRUD объектов).
3. Добавить загрузку фото через multer (`/uploads/`).
4. Интеграция WhatsApp Business API для уведомлений о заявках.
5. SEO: History API (`pushState`) и мета-теги для страниц объектов.
