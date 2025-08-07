const mongoose = require('mongoose');
const ReferralRequest = require('../models/referralRequest');

// Cambia la URI por la de tu base de datos si es necesario
const MONGODB_URI = 'mongodb+srv://wladimir:W27330449@mls.s2hdk.mongodb.net/?retryWrites=true&w=majority&appName=mls';

async function deleteAllReferralRequests() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const result = await ReferralRequest.deleteMany({});
    console.log(`Eliminados ${result.deletedCount} registros de referidos directos.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error al eliminar registros:', error);
    process.exit(1);
  }
}

deleteAllReferralRequests();