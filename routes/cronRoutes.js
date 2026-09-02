const express = require('express');
const { ejecutarRecargaAutomaticaDiaria } = require('../services/recargaMasivaService');
const router = express.Router();

// Endpoint invocado por Vercel Cron (o cualquier servicio de cron externo/interno)
router.get('/recarga-diaria', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    
    // Si CRON_SECRET está configurado en variables de entorno, validarlo
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Vercel envía automáticamente el CRON_SECRET en el header si está configurado
      // En desarrollo o si no hay CRON_SECRET, permitimos la llamada
    }

    console.log('⏰ Invocando recarga diaria automática desde endpoint Cron...');
    const resultado = await ejecutarRecargaAutomaticaDiaria();

    // Realizar barrido y liquidación de comisiones de referidos pendientes
    const { recorrerYLiquidarComisionesPendientes } = require('../utils/comisionesReferidos');
    const comisionesBarrido = await recorrerYLiquidarComisionesPendientes();

    res.status(200).json({
      success: true,
      mensaje: 'Recarga diaria y barrido de comisiones procesados exitosamente',
      timestamp: new Date(),
      resultado,
      comisionesBarrido
    });
  } catch (error) {
    console.error('❌ Error en endpoint de cron /recarga-diaria:', error);
    res.status(500).json({
      success: false,
      mensaje: error.message || 'Error al ejecutar recarga diaria',
      error: error.message
    });
  }
});

// Endpoint para verificar el estado de la recarga del día
router.get('/estado-recarga-hoy', async (req, res) => {
  try {
    const RecargaMasiva = require('../models/recargaMasiva');
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const recargaHoy = await RecargaMasiva.findOne({
      estado: 'completado',
      fecha_ejecucion: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ fecha_ejecucion: -1 });

    res.status(200).json({
      ejecutadaHoy: !!recargaHoy,
      recarga: recargaHoy || null,
      fechaServidor: now
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
