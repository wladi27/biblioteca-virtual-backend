const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors'); 
const seedNiveles = require('./seed/seedNiveles');
const seedUsuarios = require('./seed/seedUsuarios'); // Importar seedUsuarios
const authRoutes = require('./routes/auth'); 
const referralCodesRoutes = require('./routes/referralCodes');
const usuariosRouter = require('./routes/usuarios');
const withdrawalRoutes = require('./routes/withdrawals'); // Importar las rutas de withdrawals
const authAdminRoutes = require('./routes/authAdmin');
const aporteRoutes = require('./routes/aporteRoutes');
const publicacionRoutes = require('./routes/publicacionRoutes');
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
app.use(cors());
app.use(express.json());
// Middleware para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de bienvenida
app.get('/ruta', async (req, res) => {
  try {
    res.send('¡Bienvenido a la API de MLS!');
  } catch (error) {
    console.error(error); // Imprimir el error en los logs
    res.status(500).send('Error interno del servidor');
  }
});

app.use('/usuarios', usuariosRouter);
app.use('/api/referralCodes', referralCodesRoutes);
app.use('/usuarios', require('./routes/usuarios'));
app.use('/niveles', require('./routes/niveles'));
app.use('/auth', authRoutes);
app.use('/withdrawals', withdrawalRoutes); // Usar las rutas de withdrawals
app.use('/api/auth', authAdminRoutes);
app.use('/api/aportes', aporteRoutes)
app.use('/api/publicaciones', publicacionRoutes);

// Insertar niveles y usuarios iniciales
seedNiveles();

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});