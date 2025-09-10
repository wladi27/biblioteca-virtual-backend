const mongoose = require('mongoose');
const Transaccion = require('../models/transaccion');
const connectDB = require('../config/db');

const deleteRecargaReferidoTransactions = async () => {
  try {
    await connectDB();
    
    const deleteResult = await Transaccion.deleteMany({ descripcion: /^Pago por referido directo/ });
    console.log(`Se eliminaron ${deleteResult.deletedCount} transacciones de recarga por referido directo.`);

    mongoose.connection.close();
  } catch (err) {
    console.error('Error al eliminar las transacciones de recarga por referido directo:', err);
    mongoose.connection.close();
  }
};

deleteRecargaReferidoTransactions();
