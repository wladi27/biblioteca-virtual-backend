const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors'); 
const seedDolar = require('./seed/seedDolar');
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
const path = require('path');
const fs = require('fs');

const app = express();

// Configuración para Vercel
if (process.env.VERCEL) {
  // En Vercel, el directorio uploads puede no ser persistente
  console.log('Ejecutando en entorno Vercel');
}

// Crear la carpeta uploads si no existe (para desarrollo local)
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)){
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (error) {
        console.log('No se pudo crear directorio uploads:', error.message);
    }
}

// Conectar a la base de datos (solo si no estamos en Vercel o manejamos la conexión adecuadamente)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    connectDB().catch(err => {
        console.error('Error conectando a DB:', err);
    });
}
seedDolar().catch(err => console.error('Error en seedDolar:', err));

// Configuración de CORS
const allowedOrigins = [
    'https://www.granjaraizdevida.lat',
    'https://granjaraizdevida.lat',
    'http://www.granjaraizdevida.lat',
    'http://granjaraizdevida.lat',
    'http://localhost:3000',
    'http://localhost:5000',
    'https://bibliotecavirtual-git-mejoras-wladimirs-projects-be756761.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || process.env.NODE_ENV === 'development') return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Bloqueado por CORS:', origin);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Rutas de salud y bienvenida
app.get('/', (req, res) => {
    res.json({ 
        mensaje: 'API de MLS funcionando correctamente',
        environment: process.env.NODE_ENV || 'development',
        vercel: !!process.env.VERCEL
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Rutas de la API
app.use('/usuarios', usuariosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/referralCodes', referralCodesRoutes);
app.use('/niveles', require('./routes/niveles'));
app.use('/auth', authRoutes);
app.use('/withdrawals', withdrawalRoutes);
app.use('/api/auth', authAdminRoutes);
app.use('/api/aportes', aporteRoutes);
app.use('/api/publicaciones', publicacionRoutes);
app.use('/api/tusuarios', tusersRoutes);
app.use('/api/billetera', billeteraRoutes);
app.use('/api/transacciones', transaccionRoutes);
app.use('/api/usuario', require('./routes/usuarioRoutes'));
app.use('/api/referralRequests', require('./routes/referralRequestRoutes'));
app.use('/api/dolar', require('./routes/dolarRoutes'));
app.use('/api/summary', summaryRoutes);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        path: req.originalUrl
    });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Error inesperado'
    });
});

// Para Vercel, exportamos la app
module.exports = app;

// Solo iniciamos el servidor si no estamos en Vercel
if (!process.env.VERCEL) {
    const http = require('http');
    const { initializeWebSocket } = require('./websocket');
    const mongoose = require('mongoose');
    
    const port = process.env.PORT || 5000;
    const server = http.createServer(app);
    
    try {
        initializeWebSocket(server);
        
        server.listen(port, () => {
            console.log(`Servidor local escuchando en http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Error iniciando servidor local:', error);
    }
}
