const express = require('express');
const {
  crearSolicitud,
  listarSolicitudesRecibidas,
  listarSolicitudesEnviadas,
  cambiarEstado,
  listarTodasLasSolicitudes
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

module.exports = router;