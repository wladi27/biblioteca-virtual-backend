const mongoose = require('mongoose');
const Usuario = require('./models/usuario');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('Error de conexión a MongoDB:', err);
    process.exit(1);
  }
};

const deleteAllUsuarios = async () => {
  try {
    await connectDB();
    await Usuario.deleteMany({});
    console.log('Todos los usuarios han sido eliminados.');
    mongoose.connection.close();
  } catch (err) {
    console.error('Error al eliminar usuarios:', err);
    mongoose.connection.close();
  }
};

deleteAllUsuarios();