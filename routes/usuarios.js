const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Define la ruta para obtener el nivel más alto completado antes de las rutas con parámetros dinámicos
router.get('/nivel', async (req, res) => {
  try {
    const nivelMasAltoCompletado = await usuarioController.calcularNivelMasAltoCompletado();
    res.status(200).json({ nivelMasAltoCompletado });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', usuarioController.agregarUsuario);
router.get('/', usuarioController.obtenerUsuarios);
router.get('/:usuario_id', usuarioController.obtenerUsuarioPorId);
router.delete('/:usuario_id', usuarioController.eliminarUsuario);

// Nueva ruta para obtener la pirámide de usuarios
router.get('/piramide/:usuario_id', usuarioController.obtenerPiramideUsuarios);

module.exports = router;