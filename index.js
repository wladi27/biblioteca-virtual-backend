const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors'); 
const seedNiveles = require('./seed/seedNiveles');
const seedUsuarios = require('./seed/seedUsuarios'); // Importar seedUsuarios
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
//billetera
const billeteraRoutes = require('./routes/billeteraRoutes');
const transaccionRoutes = require('./routes/transaccionRoutes');
// -------------       -           ----------------------------
const path = require('path');
const fs = require('fs');

// Crear la carpeta uploads si no existe
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const app = express();
const port = process.env.PORT || 5000;

// Conectar a la base de datos
connectDB();
seedDolar();

// Configuración de CORS mejorada para permitir dominios específicos
const allowedOrigins = [
    'https://www.granjaraizdevida.lat',
    'https://granjaraizdevida.lat',
    'http://www.granjaraizdevida.lat',
    'http://granjaraizdevida.lat',
    'http://localhost:3000',
    'http://localhost:5000',
    'https://bibliotecavirtual-git-mejoras-wladimirs-projects-be756761.vercel.app',
    'https://bibliotecavirtual-wladimirs-projects-be756761.vercel.app',
    // Agrega aquí cualquier otro dominio que necesites
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir solicitudes sin origen (como apps móviles, Postman, o el mismo servidor)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.log('Origen bloqueado por CORS:', origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200 // Algunos navegadores antiguos (IE11) necesitan esto
};

app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware para logging de peticiones (útil para depuración)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origen: ${req.headers.origin || 'desconocido'}`);
    next();
});

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({ 
        mensaje: '¡Bienvenido a la API de MLS!',
        version: '1.0.0',
        endpoints: {
            auth: '/auth',
            usuarios: '/api/usuarios',
            niveles: '/niveles',
            withdrawals: '/withdrawals',
            aportes: '/api/aportes',
            publicaciones: '/api/publicaciones'
        }
    });
});

// Ruta de health check para Vercel
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rutas de la API
app.use('/api/usuarios', usuariosRouter);
app.use('/usuarios', usuariosRouter);
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
app.use('/api/referralRequests', require('./routes/referralRequestRoutes'));
app.use('/api/dolar', require('./routes/dolarRoutes'));
app.use('/api/summary', summaryRoutes);

// Manejo de rutas no encontradas (404)
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        message: `No se encontró la ruta ${req.originalUrl}`,
        method: req.method
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Error de CORS
    if (err.message === 'No permitido por CORS') {
        return res.status(403).json({ 
            error: 'Acceso no permitido por CORS',
            message: 'El dominio no está autorizado para acceder a esta API'
        });
    }
    
    // Otros errores
    res.status(err.status || 500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Ocurrió un error inesperado'
    });
});

const http = require('http');
const { initializeWebSocket } = require('./websocket');

const server = http.createServer(app);

initializeWebSocket(server);

server.listen(port, () => {
    console.log(`=================================`);
    console.log(`Servidor corriendo en:`);
    console.log(`➜ Local: http://localhost:${port}`);
    console.log(`➜ Red: http://${getLocalIp()}:${port}`);
    console.log(`=================================`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS permitido para: ${allowedOrigins.join(', ')}`);
    console.log(`=================================`);
});

// Función auxiliar para obtener la IP local
function getLocalIp() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// Manejo de señales de terminación
process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT recibido, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});
