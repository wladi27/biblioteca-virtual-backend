const mongoose = require('mongoose');
const Transaccion = require('./models/transaccion'); // Asegúrate de que la ruta sea correcta
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

const deleteAllTransacciones = async () => {
  try {
    await connectDB();
    await Transaccion.deleteMany({});
    console.log('Todas las transacciones han sido eliminadas.');
    mongoose.connection.close();
  } catch (err) {
    console.error('Error al eliminar transacciones:', err);
    mongoose.connection.close();
  }
};

deleteAllTransacciones();
