const express = require('express');
const {
  agregarUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  eliminarUsuario,
  obtenerPiramideUsuario,
  obtenerPiramideGlobal,
} = require('../controllers/utesController'); // Verifica que esta ruta sea correcta

const router = express.Router();

// Define tus rutas aquí
router.post('/usuarios', agregarUsuario);
router.get('/usuarios', obtenerUsuarios);
router.get('/usuarios/:usuario_id', obtenerUsuarioPorId);
router.delete('/usuarios/:usuario_id', eliminarUsuario);
router.get('/usuarios/:usuario_id/piramide', obtenerPiramideUsuario);
router.get('/piramide', obtenerPiramideGlobal);

module.exports = router;
