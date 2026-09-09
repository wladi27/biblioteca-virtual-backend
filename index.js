require('dotenv').config();

const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors'); 
const seedDolar = require('./seed/seedDolar');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { initializeWebSocket } = require('./websocket');

// Rutas
const authRoutes = require('./routes/auth'); 
const referralCodesRoutes = require('./routes/referralCodes');
const usuariosRouter = require('./routes/usuarios');
const withdrawalRoutes = require('./routes/withdrawals'); 
const authAdminRoutes = require('./routes/authAdmin');
const aporteRoutes = require('./routes/aporteRoutes');
const publicacionRoutes = require('./routes/publicacionRoutes');
const tusersRoutes = require('./routes/tusersRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const billeteraRoutes = require('./routes/billeteraRoutes');
const transaccionRoutes = require('./routes/transaccionRoutes');

// Cron de recarga diaria
require('./cron-recarga-diaria');

// Crear la carpeta uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const port = process.env.PORT || 5005;

connectDB();
seedDolar();

// Configuración de CORS para desarrollo y producción
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir cualquier origen en desarrollo (localhost, 127.0.0.1, devtunnels, IPs locales o llamadas sin origen)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Ruta de estado / bienvenida
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '¡Bienvenido a la API de Granja Raíz de Vida!',
    timestamp: new Date()
  });
});

// Rutas de la API
app.use('/auth', authRoutes);
app.use('/usuarios', usuariosRouter);
app.use('/api/usuario', require('./routes/usuarioRoutes'));
app.use('/api/auth', authAdminRoutes);
app.use('/api/billetera', billeteraRoutes);
app.use('/api/transacciones', transaccionRoutes);
app.use('/api/referralCodes', referralCodesRoutes);
app.use('/api/referralRequests', require('./routes/referralRequestRoutes'));
app.use('/niveles', require('./routes/niveles'));
app.use('/withdrawals', withdrawalRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/aportes', aporteRoutes);
app.use('/api/publicaciones', publicacionRoutes);
app.use('/api/tusuarios', tusersRoutes);
app.use('/api/dolar', require('./routes/dolarRoutes'));
app.use('/api/summary', summaryRoutes);
app.use('/api/cron', require('./routes/cronRoutes'));

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const server = http.createServer(app);
initializeWebSocket(server);

// Exportar la app de Express para Vercel Serverless Functions
module.exports = app;

server.listen(port, () => {
  console.log(`🚀 Servidor Granja Raíz de Vida escuchando en http://localhost:${port}`);
});
