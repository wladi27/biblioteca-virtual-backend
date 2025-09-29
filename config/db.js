const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log('Conectando a:', process.env.DB_URI);
    await mongoose.connect(process.env.DB_URI);
    console.log('Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('Error de conexión a MongoDB:', err);
    throw err;
  }
};

module.exports = connectDB;
