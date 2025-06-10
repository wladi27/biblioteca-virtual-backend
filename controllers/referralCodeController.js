const ReferralCode = require('../models/ReferralCode');

// Obtener todos los códigos de referido
const getReferralCodes = async (req, res) => {
  try {
    const referralCodes = await ReferralCode.find().populate('userId', 'nombre_completo');
    res.json(referralCodes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener códigos de referido', error });
  }
};

// Crear un nuevo código de referido
const createReferralCode = async (req, res) => {
  const { userId } = req.body;

  try {
    // Generar un código único
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const existingCode = await ReferralCode.findOne({ code });
      if (!existingCode) {
        isUnique = true;
      }
    }

    const newReferralCode = new ReferralCode({ code, userId });
    await newReferralCode.save();
    res.status(201).json(newReferralCode);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear código de referido', error });
  }
};

// Obtener un código de referido por ID
const getReferralCodeById = async (req, res) => {
  try {
    const referralCode = await ReferralCode.findById(req.params.id).populate('userId', 'nombre_completo');
    if (!referralCode) {
      return res.status(404).json({ message: 'Código de referido no encontrado' });
    }
    res.json(referralCode);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener código de referido', error });
  }
};

// Obtener todos los códigos de referido por usuario
const getReferralCodesByUserId = async (req, res) => {
  try {
    const referralCodes = await ReferralCode.find({ userId: req.params.userId }).populate('userId', 'nombre_completo');
    res.json(referralCodes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener códigos de referido por usuario', error });
  }
};

// Actualizar un código de referido
const updateReferralCode = async (req, res) => {
  try {
    const updatedReferralCode = await ReferralCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedReferralCode) {
      return res.status(404).json({ message: 'Código de referido no encontrado' });
    }
    res.json(updatedReferralCode);
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar código de referido', error });
  }
};

// Eliminar un código de referido
const deleteReferralCode = async (req, res) => {
  try {
    const deletedReferralCode = await ReferralCode.findByIdAndDelete(req.params.id);
    if (!deletedReferralCode) {
      return res.status(404).json({ message: 'Código de referido no encontrado' });
    }
    res.json({ message: 'Código de referido eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar código de referido', error });
  }
};

module.exports = {
  getReferralCodes,
  createReferralCode,
  getReferralCodeById,
  getReferralCodesByUserId,
  updateReferralCode,
  deleteReferralCode,
};