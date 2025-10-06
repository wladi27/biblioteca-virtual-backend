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

connectDB();
seedDolar();

// Configuración de CORS para permitir todos los dominios
app.use(cors({
  origin: '*', // Permitir todos los dominios
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'] // Cabeceras permitidas
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.send('¡Bienvenido a la API de MLS!');
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

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Error interno del servidor');
});

const http = require('http');
const { initializeWebSocket } = require('./websocket');

const server = http.createServer(app);

initializeWebSocket(server);

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
