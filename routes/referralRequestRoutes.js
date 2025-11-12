const express = require('express');
const {
  crearSolicitud,
  crearSolicitudDesdeReferido, // New import
  listarSolicitudesRecibidas,
  listarSolicitudesEnviadas,
  cambiarEstado,
  listarTodasLasSolicitudes,
  aceptarTodasLasSolicitudes
} = require('../controllers/referralRequestController');

const router = express.Router();

// Obtener todas las solicitudes
router.get('/', listarTodasLasSolicitudes);

// Crear solicitud de referido
router.post('/', crearSolicitud);

// Listar solicitudes recibidas por usuario
router.get('/recibidas/:id', listarSolicitudesRecibidas);

// Listar solicitudes enviadas por usuario
router.get('/enviadas/:id', listarSolicitudesEnviadas);

// Cambiar estado de la solicitud (aceptar/rechazar)
router.patch('/:id', cambiarEstado);

// Crear solicitud de referido desde el referido hacia el patrocinador
router.post('/from-referred', crearSolicitudDesdeReferido);

// Aceptar todas las solicitudes pendientes
router.post('/aceptar-todas', aceptarTodasLasSolicitudes);

module.exports = router;