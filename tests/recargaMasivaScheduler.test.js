const test = require('node:test');
const assert = require('node:assert/strict');
const { getRecargaAutomaticaConfig, shouldSkipDailyRecarga } = require('../services/recargaMasivaService');

test('usa 40 COP y las 7:00 AM por defecto', () => {
  const config = getRecargaAutomaticaConfig({});

  assert.equal(config.monto, 40);
  assert.equal(config.hora, 7);
  assert.equal(config.cronExpression, '0 7 * * *');
});

test('evita ejecutar la misma recarga dos veces en el mismo día', () => {
  const now = new Date('2026-07-06T10:00:00.000Z');
  const existingRecarga = { fecha_ejecucion: new Date('2026-07-06T07:00:00.000Z') };

  assert.equal(shouldSkipDailyRecarga(existingRecarga, now), true);
  assert.equal(shouldSkipDailyRecarga(null, now), false);
});
