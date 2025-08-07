const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario');

// Crear solicitud de referido
exports.crearSolicitud = async (req, res) => {
  try {
    const { solicitante_id, referido_id } = req.body;
    if (solicitante_id === referido_id) {
      return res.status(400).json({ message: 'No puedes referirte a ti mismo.' });
    }
    // Verifica que ambos usuarios existan
    const solicitante = await Usuario.findById(solicitante_id);
    const referido = await Usuario.findById(referido_id);
    if (!solicitante || !referido) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    // Verifica que no exista una solicitud pendiente igual
    const existe = await ReferralRequest.findOne({ solicitante_id, referido_id, estado: 'pendiente' });
    if (existe) {
      return res.status(400).json({ message: 'Ya existe una solicitud pendiente.' });
    }
    const solicitud = await ReferralRequest.create({ solicitante_id, referido_id });
    res.status(201).json(solicitud);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la solicitud', error: error.message });
  }
};

// Listar solicitudes recibidas por usuario
exports.listarSolicitudesRecibidas = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitudes = await ReferralRequest.find({ referido_id: id }).populate('solicitante_id', 'nombre_usuario nombre_completo');
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener solicitudes', error: error.message });
  }
};

// Listar solicitudes enviadas por usuario
exports.listarSolicitudesEnviadas = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitudes = await ReferralRequest.find({ solicitante_id: id }).populate('referido_id', 'nombre_usuario nombre_completo');
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener solicitudes', error: error.message });
  }
};

// Cambiar estado de la solicitud (aceptar/rechazar)
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido.' });
    }
    const solicitud = await ReferralRequest.findByIdAndUpdate(id, { estado }, { new: true });
    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }
    res.json(solicitud);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar estado', error: error.message });
  }
};