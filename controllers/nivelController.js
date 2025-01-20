const Nivel = require('../models/nivel');

exports.agregarNivel = async (req, res) => {
  try {
    const nuevoNivel = new Nivel(req.body);
    await nuevoNivel.save();
    res.status(201).json(nuevoNivel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.obtenerNiveles = async (req, res) => {
  try {
    const niveles = await Nivel.find();
    res.status(200).json(niveles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.obtenerNivelPorId = async (req, res) => {
  try {
    const nivel = await Nivel.findById(req.params.nivel_id);
    if (!nivel) return res.status(404).json({ message: 'Nivel no encontrado' });
    res.status(200).json(nivel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.actualizarNivel = async (req, res) => {
  try {
    const nivel = await Nivel.findByIdAndUpdate(req.params.nivel_id, req.body, { new: true });
    if (!nivel) return res.status(404).json({ message: 'Nivel no encontrado' });
    res.status(200).json(nivel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.eliminarNivel = async (req, res) => {
  try {
    const nivel = await Nivel.findByIdAndDelete(req.params.nivel_id);
    if (!nivel) return res.status(404).json({ message: 'Nivel no encontrado' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
