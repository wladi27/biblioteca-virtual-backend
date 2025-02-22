const mongoose = require('mongoose');
const TestUsuario = require('./models/testusuario'); // Asegúrate de que la ruta sea correcta
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

const deleteAllTestUsuarios = async () => {
  try {
    await connectDB();
    await TestUsuario.deleteMany({});
    console.log('Todos los usuarios de TestUsuario han sido eliminados.');
    mongoose.connection.close();
  } catch (err) {
    console.error('Error al eliminar usuarios de TestUsuario:', err);
    mongoose.connection.close();
  }
};

deleteAllTestUsuarios();
