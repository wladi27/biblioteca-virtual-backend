const RecargaMasiva = require('../models/recargaMasiva');
const { ejecutarRecargaMasivaAutomatica } = require('../controllers/billeteraController');

const DEFAULT_CONFIG = {
  monto: 40,
  hora: 7,
  minuto: 0,
  cronExpression: '0 7 * * *'
};

const getRecargaAutomaticaConfig = (overrides = {}) => ({
  ...DEFAULT_CONFIG,
  ...overrides
});

const shouldSkipDailyRecarga = (latestRecarga, now = new Date()) => {
  if (!latestRecarga) return false;

  const latestDate = new Date(latestRecarga.fecha_ejecucion);
  const sameDay = latestDate.getFullYear() === now.getFullYear()
    && latestDate.getMonth() === now.getMonth()
    && latestDate.getDate() === now.getDate();

  return sameDay;
};

const ejecutarRecargaAutomaticaDiaria = async (config = {}) => {
  const resolvedConfig = getRecargaAutomaticaConfig(config);
  const now = new Date();

  const latestRecarga = await RecargaMasiva.findOne({
    estado: 'completado',
    monto_individual: resolvedConfig.monto
  }).sort({ fecha_ejecucion: -1 });

  if (shouldSkipDailyRecarga(latestRecarga, now)) {
    console.log(`⏭️ Recarga automática diaria omitida para hoy (${resolvedConfig.monto} COP).`);
    return { skipped: true, reason: 'already_executed_today' };
  }

  console.log(`▶️ Ejecutando recarga automática diaria de ${resolvedConfig.monto} COP.`);
  return ejecutarRecargaMasivaAutomatica({
    monto: resolvedConfig.monto,
    ejecutadoPor: null,
    registrarTransaccionesIndividuales: true
  });
};

module.exports = {
  getRecargaAutomaticaConfig,
  shouldSkipDailyRecarga,
  ejecutarRecargaAutomaticaDiaria
};
