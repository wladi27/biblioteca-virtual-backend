const express = require('express');
const referralRequestController = require('../controllers/referralRequestController');

const router = express.Router();

// Ruta: GET /api/referralRequests/
router.get('/', referralRequestController.listarTodasLasSolicitudes);

// Ruta: POST /api/referralRequests/
router.post('/', referralRequestController.crearSolicitud);

// Ruta: GET /api/referralRequests/recibidas/:id
router.get('/recibidas/:id', referralRequestController.listarSolicitudesRecibidas);

// Ruta: GET /api/referralRequests/enviadas/:id
router.get('/enviadas/:id', referralRequestController.listarSolicitudesEnviadas);

// Ruta: PATCH /api/referralRequests/:id
router.patch('/:id', referralRequestController.cambiarEstado);

// Ruta: POST /api/referralRequests/aceptar-multiples
router.post('/aceptar-multiples', referralRequestController.aceptarMultiplesSolicitudes);

// Ruta: GET /api/referralRequests/patrocinador/:usuarioId
router.get('/patrocinador/:usuarioId', referralRequestController.obtenerPatrocinador);

// Ruta: GET /api/referralRequests/referidos-directos/:usuarioId
router.get('/referidos-directos/:usuarioId', referralRequestController.obtenerReferidosDirectos);

module.exports = router;