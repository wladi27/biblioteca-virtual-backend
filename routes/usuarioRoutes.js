const express = require('express');
const { editarUsuario } = require('../controllers/usuarioController');

const router = express.Router();

// Ruta para editar usuario (excepto hijos, padre y contraseña)
router.put('/:id', editarUsuario);

module.exports = router;