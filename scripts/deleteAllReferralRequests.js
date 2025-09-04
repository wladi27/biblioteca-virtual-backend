const mongoose = require('mongoose');
const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario');
const connectDB = require('../config/db');

const deleteAllReferralRequests = async () => {
  try {
    await connectDB();
    
    // Eliminar todas las solicitudes de referido
    const deleteResult = await ReferralRequest.deleteMany({});
    console.log(`Se eliminaron ${deleteResult.deletedCount} solicitudes de referido.`);

    // Resetear los campos de referido en todos los usuarios
    const updateResult = await Usuario.updateMany({}, {
      $set: {
        padre_id: null,
        hijo1_id: null,
        hijo2_id: null,
        hijo3_id: null
      }
    });
    console.log(`Se actualizaron ${updateResult.nModified} usuarios para resetear los campos de referido.`);

    mongoose.connection.close();
  } catch (err) {
    console.error('Error al procesar las solicitudes de referido y usuarios:', err);
    mongoose.connection.close();
  }
};

deleteAllReferralRequests();
