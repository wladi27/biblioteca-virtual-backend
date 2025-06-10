const Withdrawal = require('../models/Withdrawal');

const crearRetiro = async (req, res) => {
  try {
    const retiro = new Withdrawal(req.body);
    await retiro.save();
    res.status(201).json(retiro);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const obtenerRetiros = async (req, res) => {
  try {
    const retiros = await Withdrawal.find().populate('usuarioId', 'nombre_completo');
    res.status(200).json(retiros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const obtenerRetiroPorId = async (req, res) => {
  try {
    const retiro = await Withdrawal.findById(req.params.id).populate('usuarioId', 'nombre_completo');
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(200).json(retiro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const obtenerRetirosPorUsuario = async (req, res) => {
  try {
    const retiros = await Withdrawal.find({ usuarioId: req.params.usuarioId }).populate('usuarioId', 'nombre_completo');
    res.status(200).json(retiros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const actualizarRetiro = async (req, res) => {
  try {
    const retiro = await Withdrawal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(200).json(retiro);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const actualizarEstadoRetiro = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pendiente', 'completado', 'rechazado', 'pagado'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }
    
    const retiro = await Withdrawal.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(200).json(retiro);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const eliminarRetiro = async (req, res) => {
  try {
    const retiro = await Withdrawal.findByIdAndDelete(req.params.id);
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  crearRetiro,
  obtenerRetiros,
  obtenerRetiroPorId,
  obtenerRetirosPorUsuario,
  actualizarRetiro,
  eliminarRetiro,
  actualizarEstadoRetiro // Exportar la nueva función
};
