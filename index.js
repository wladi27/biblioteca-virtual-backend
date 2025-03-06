const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors'); 
const seedNiveles = require('./seed/seedNiveles');
const seedUsuarios = require('./seed/seedUsuarios'); // Importar seedUsuarios
const authRoutes = require('./routes/auth'); 
const referralCodesRoutes = require('./routes/referralCodes');
const usuariosRouter = require('./routes/usuarios');
const withdrawalRoutes = require('./routes/withdrawals'); 
const authAdminRoutes = require('./routes/authAdmin');
const aporteRoutes = require('./routes/aporteRoutes');
const publicacionRoutes = require('./routes/publicacionRoutes');
const tusersRoutes = require('./routes/tusersRoutes');
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

// Configuración de CORS
app.use(cors({
  origin: [
    'https://virtualbiblioteca.com',
    'https://bibliotecavirtual-flame.vercel.app/' // Nuevo dominio agregado
  ] // Lista de orígenes permitidos
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de bienvenida
app.get('/ruta', (req, res) => {
  res.send('¡Bienvenido a la API de MLS!');
});

// Rutas de la API
app.use('/usuarios', usuariosRouter);
app.use('/api/referralCodes', referralCodesRoutes);
app.use('/niveles', require('./routes/niveles'));
app.use('/auth', authRoutes);
app.use('/withdrawals', withdrawalRoutes);
app.use('/api/auth', authAdminRoutes);
app.use('/api/aportes', aporteRoutes);
app.use('/api/publicaciones', publicacionRoutes);
app.use('/api/tusuarios', tusersRoutes);

// Insertar niveles y usuarios iniciales
seedNiveles()
  .then(() => {
    console.log('Niveles iniciales insertados');
  })
  .catch(err => {
    console.error('Error al insertar niveles:', err);
  });

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Error interno del servidor');
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
