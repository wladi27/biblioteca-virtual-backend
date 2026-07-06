require('dotenv').config();
const cron = require('node-cron');
const { ejecutarRecargaAutomaticaDiaria } = require('./services/recargaMasivaService');
const connectDB = require('./config/db');

connectDB();

cron.schedule('0 7 * * *', async () => {
  try {
    await ejecutarRecargaAutomaticaDiaria();
  } catch (error) {
    console.error('❌ Error en el cron de recarga automática diaria:', error);
  }
}, {
  timezone: 'America/Bogota'
});

console.log('✅ Cron de recarga automática diaria configurado para las 7:00 AM (America/Bogota).');
