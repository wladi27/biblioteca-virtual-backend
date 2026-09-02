const test = require('node:test');
const assert = require('node:assert/strict');

test('Cálculo de saldo contable unificado', () => {
  const transacciones = [
    { tipo: 'recarga_diaria', monto: 40, estado: 'aprobado' },
    { tipo: 'recarga_masiva', monto: 100, estado: 'aprobado' },
    { tipo: 'recarga_individual', monto: 500, estado: 'aprobado' },
    { tipo: 'comision_nivel', monto: 390, estado: 'aprobado' },
    { tipo: 'comision_referido', monto: 1400, estado: 'aprobado' },
    { tipo: 'retiro', monto: 500, estado: 'aprobado' },
    { tipo: 'retiro', monto: 200, estado: 'pendiente' },
    { tipo: 'retiro', monto: 300, estado: 'rechazado' }
  ];

  let totalIngresos = 0;
  let totalEgresos = 0;

  transacciones.forEach((t) => {
    if (t.tipo === 'retiro') {
      if (t.estado !== 'rechazado') {
        totalEgresos += t.monto;
      }
    } else if (t.estado === 'aprobado' || t.estado === 'completado') {
      totalIngresos += t.monto;
    }
  });

  const saldoFinal = totalIngresos - totalEgresos;

  assert.equal(totalIngresos, 2430);
  assert.equal(totalEgresos, 700);
  assert.equal(saldoFinal, 1730);
});

test('Validación de fondos antes de retiro', () => {
  const saldoDisponible = 500;
  const intentoRetiroExcesivo = 600;
  const intentoRetiroValido = 300;

  const puedeRetirarExcesivo = saldoDisponible >= intentoRetiroExcesivo;
  const puedeRetirarValido = saldoDisponible >= intentoRetiroValido;

  assert.equal(puedeRetirarExcesivo, false);
  assert.equal(puedeRetirarValido, true);
});

test('Cálculo de niveles de matriz ternaria (3^nivel)', () => {
  assert.equal(1, 1);
  assert.equal(Math.pow(3, 1), 3);
  assert.equal(Math.pow(3, 2), 9);
  assert.equal(Math.pow(3, 3), 27);
  assert.equal(Math.pow(3, 4), 81);
});

test('Regla de negocio: Comisión de referido directo solo se paga con doble verificación', () => {
  const evaluarComisionReferido = (patrocinadorVerificado, referidoVerificado) => {
    if (patrocinadorVerificado && referidoVerificado) {
      return { pagar: true, monto: 1400, motivo: 'Liquidada' };
    }
    return { pagar: false, monto: 0, motivo: 'Pendiente' };
  };

  assert.equal(evalar(false, false).pagar, false);
  assert.equal(evalar(true, false).pagar, false);
  assert.equal(evalar(false, true).pagar, false);
  assert.equal(evalar(true, true).pagar, true);

  function evalar(p, r) {
    return evaluarComisionReferido(p, r);
  }
});

test('Validación de anti-ciclos y auto-referidos en red de patrocinio', () => {
  const redPatrocinio = [
    { solicitante_id: 'A', referido_id: 'B', estado: 'aceptado' },
    { solicitante_id: 'B', referido_id: 'C', estado: 'aceptado' },
    { solicitante_id: 'C', referido_id: 'D', estado: 'aceptado' }
  ];

  const validarVinculacion = (patrocinador, nuevoReferido, red) => {
    if (patrocinador === nuevoReferido) return { valido: false, motivo: 'Auto-referido' };
    const inverso = red.some(r => r.solicitante_id === nuevoReferido && r.referido_id === patrocinador && r.estado === 'aceptado');
    if (inverso) return { valido: false, motivo: 'Patrocinio inverso directo' };

    let actual = patrocinador;
    while (actual) {
      const parent = red.find(r => r.referido_id === actual && r.estado === 'aceptado');
      if (!parent) break;
      if (parent.solicitante_id === nuevoReferido) return { valido: false, motivo: 'Ciclo ascendente' };
      actual = parent.solicitante_id;
    }
    return { valido: true };
  };

  assert.equal(validarVinculacion('A', 'A', redPatrocinio).valido, false);
  assert.equal(validarVinculacion('B', 'A', redPatrocinio).valido, false);
  assert.equal(validarVinculacion('D', 'A', redPatrocinio).valido, false);
  assert.equal(validarVinculacion('A', 'E', redPatrocinio).valido, true);
});

test('Reglas de Retiro: Verificación, Mínimo 3 Referidos Validados, Mínimo COP $10,000 e Idempotencia', () => {
  const MONTO_MINIMO = 10000;
  const MINIMO_REFERIDOS = 3;

  const validarSolicitudRetiro = ({
    usuarioVerificado,
    referidosValidadosCount,
    saldoDisponible,
    montoSolicitado,
    tieneRetiroPendiente,
    idempotencyKey,
    keysProcesadas = new Set()
  }) => {
    // 1. Idempotencia
    if (idempotencyKey && keysProcesadas.has(idempotencyKey)) {
      return { permitida: false, motivo: 'Idempotente repetido', esIdempotente: true };
    }
    // 2. Verificación propia
    if (!usuarioVerificado) {
      return { permitida: false, motivo: 'Usuario no verificado' };
    }
    // 3. Mínimo de 3 referidos directos validados
    if (referidosValidadosCount < MINIMO_REFERIDOS) {
      return { permitida: false, motivo: `Requiere mínimo ${MINIMO_REFERIDOS} referidos validados` };
    }
    // 4. Monto mínimo
    if (montoSolicitado < MONTO_MINIMO) {
      return { permitida: false, motivo: `Monto menor al mínimo de COP $${MONTO_MINIMO}` };
    }
    // 5. Saldo suficiente
    if (saldoDisponible < montoSolicitado) {
      return { permitida: false, motivo: 'Saldo insuficiente' };
    }
    // 6. Retiro pendiente existente
    if (tieneRetiroPendiente) {
      return { permitida: false, motivo: 'Ya existe un retiro en trámite' };
    }

    return { permitida: true };
  };

  // Caso 1: Usuario no verificado -> Rechazado
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: false,
    referidosValidadosCount: 5,
    saldoDisponible: 50000,
    montoSolicitado: 20000,
    tieneRetiroPendiente: false
  }).permitida, false);

  // Caso 2: Solo 2 referidos validados (requiere 3) -> Rechazado
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: true,
    referidosValidadosCount: 2,
    saldoDisponible: 50000,
    montoSolicitado: 20000,
    tieneRetiroPendiente: false
  }).permitida, false);

  // Caso 3: Monto menor a $10,000 -> Rechazado
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: true,
    referidosValidadosCount: 3,
    saldoDisponible: 50000,
    montoSolicitado: 5000,
    tieneRetiroPendiente: false
  }).permitida, false);

  // Caso 4: Saldo insuficiente ($15,000 disponible vs $20,000 solicitado) -> Rechazado
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: true,
    referidosValidadosCount: 3,
    saldoDisponible: 15000,
    montoSolicitado: 20000,
    tieneRetiroPendiente: false
  }).permitida, false);

  // Caso 5: Retiro pendiente en trámite -> Rechazado
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: true,
    referidosValidadosCount: 3,
    saldoDisponible: 50000,
    montoSolicitado: 20000,
    tieneRetiroPendiente: true
  }).permitida, false);

  // Caso 6: Cumple todos los requisitos -> APROBADO
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: true,
    referidosValidadosCount: 3,
    saldoDisponible: 50000,
    montoSolicitado: 20000,
    tieneRetiroPendiente: false
  }).permitida, true);

  // Caso 7: Intento idempotente duplicado -> Detectado
  const keysSet = new Set(['wd_key_123']);
  assert.equal(validarSolicitudRetiro({
    usuarioVerificado: true,
    referidosValidadosCount: 3,
    saldoDisponible: 50000,
    montoSolicitado: 20000,
    tieneRetiroPendiente: false,
    idempotencyKey: 'wd_key_123',
    keysProcesadas: keysSet
  }).esIdempotente, true);
});
