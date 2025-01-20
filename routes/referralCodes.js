const express = require('express');
const router = express.Router();
const {
  getReferralCodes,
  createReferralCode,
  getReferralCodeById,
  getReferralCodesByUserId,
  updateReferralCode,
  deleteReferralCode,
} = require('../controllers/referralCodeController');

// Obtener todos los códigos de referido
router.get('/', getReferralCodes);

// Crear un nuevo código de referido
router.post('/', createReferralCode);

// Obtener un código de referido por ID
router.get('/:id', getReferralCodeById);

// Obtener todos los códigos de referido por usuario
router.get('/user/:userId', getReferralCodesByUserId);

// Actualizar un código de referido
router.put('/:id', updateReferralCode);

// Eliminar un código de referido
router.delete('/:id', deleteReferralCode);

module.exports = router;