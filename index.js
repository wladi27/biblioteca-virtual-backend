const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors'); 
const seedNiveles = require('./seed/seedNiveles');
const seedUsuarios = require('./seed/seedUsuarios'); // Importar seedUsuarios
const authRoutes = require('./routes/auth'); 
const referralCodesRoutes = require('./routes/referralCodes');
const usuariosRouter = require('./routes/usuarios');
const withdrawalRoutes = require('./routes/withdrawals'); // Importar las rutas de withdrawals

const app = express();
const port = process.env.PORT || 3000;

connectDB();
app.use(cors());
app.use(express.json());

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

// Insertar niveles y usuarios iniciales
//seedNiveles();

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});