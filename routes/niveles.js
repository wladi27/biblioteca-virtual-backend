const express = require('express');
const router = express.Router();
const nivelController = require('../controllers/nivelController');

router.post('/', nivelController.agregarNivel);
router.get('/', nivelController.obtenerNiveles);
router.get('/:nivel_id', nivelController.obtenerNivelPorId);
router.put('/:nivel_id', nivelController.actualizarNivel);
router.delete('/:nivel_id', nivelController.eliminarNivel);

module.exports = router;
