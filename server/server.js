require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const propertiesRouter = require('./routes/properties');
const agentsRouter = require('./routes/agents');
const leadsRouter = require('./routes/leads');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const authRouter = require('./routes/auth');
const adminPropertiesRouter = require('./routes/adminProperties');
const adminAgentsRouter = require('./routes/adminAgents');
const adminLeadsRouter = require('./routes/adminLeads');

const developersRouter = require('./routes/developers');
const complexesRouter = require('./routes/complexes');
const publicReferencesRouter = require('./routes/publicReferences');

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit на форму заявок (защита от спама)
app.use('/api/leads', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много заявок. Попробуйте через 15 минут.' },
}));

// API
app.use('/api/auth', authRouter);
app.use('/api/admin/properties', adminPropertiesRouter);
app.use('/api/admin/agents',     adminAgentsRouter); 
app.use('/api/admin/leads',      adminLeadsRouter);
app.use('/api/admin/developers', developersRouter);
app.use('/api/admin/complexes',  complexesRouter); 
app.use('/api/properties', propertiesRouter);
app.use('/api/agents', agentsRouter);
app.use('/api', publicReferencesRouter);
app.use('/api/leads', leadsRouter);

// Статика: админка отдельно, публичный сайт отдельно
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// SPA fallback для админки: /admin/* (кроме статических файлов) → admin/index.html
app.get(/^\/admin(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// SPA fallback для публичного сайта: всё остальное (кроме /api и /admin) → client/index.html
app.get(/^\/(?!api|admin).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🏠  Дом Комфорт запущен: http://localhost:${PORT}`);
  console.log(`    API доступен: http://localhost:${PORT}/api\n`);
});
