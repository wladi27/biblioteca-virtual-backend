const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario');

// Crear solicitud de referido
exports.crearSolicitud = async (req, res) => {
  try {
    const { solicitante_id, referido_id } = req.body;

    // No puedes referirte a ti mismo
    if (solicitante_id === referido_id) {
      return res.status(400).json({ message: 'No puedes referirte a ti mismo.' });
    }

    // Verifica que ambos usuarios existan
    const solicitante = await Usuario.findById(solicitante_id);
    const referido = await Usuario.findById(referido_id);

    if (!solicitante || !referido) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Un usuario solo puede ser referido por una persona (solicitud aceptada)
    const existingAcceptedRequest = await ReferralRequest.findOne({
        referido_id,
        estado: 'aceptado'
    });

    if (existingAcceptedRequest) {
        return res.status(400).json({ message: 'Este usuario ya es referido de otra persona.' });
    }

    // Un usuario no puede tener multiples solicitudes pendientes
    const existingPendingRequest = await ReferralRequest.findOne({
        referido_id,
        estado: 'pendiente'
    });

    if (existingPendingRequest) {
        return res.status(400).json({ message: 'Este usuario ya tiene una solicitud de referido pendiente.' });
    }

    // Prevenir referencias circulares
    let current_id = solicitante_id;
    while (current_id) {
        if (current_id.toString() === referido_id.toString()) {
            return res.status(400).json({ message: 'No puedes referir a tu patrocinador (referencia circular detectada).' });
        }
        const request = await ReferralRequest.findOne({ referido_id: current_id, estado: 'aceptado' });
        current_id = request ? request.solicitante_id : null;
    }

    const solicitud = await ReferralRequest.create({ solicitante_id, referido_id });
    res.status(201).json({ message: 'Solicitud de referido creada con éxito.', solicitud });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la solicitud de referido.', error: error.message });
  }
};

// Listar solicitudes recibidas por usuario
exports.listarSolicitudesRecibidas = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitudes = await ReferralRequest.find({ referido_id: id }).populate('solicitante_id', 'nombre_usuario nombre_completo');
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las solicitudes recibidas.', error: error.message });
  }
};

// Listar solicitudes enviadas por usuario
exports.listarSolicitudesEnviadas = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitudes = await ReferralRequest.find({ solicitante_id: id }).populate('referido_id', 'nombre_usuario nombre_completo');
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las solicitudes enviadas.', error: error.message });
  }
};

// Cambiar estado de la solicitud (aceptar/rechazar)
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido. Use \'aceptado\' o \'rechazado\'.' });
    }

    const solicitud = await ReferralRequest.findById(id);

    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }

    if (solicitud.estado !== 'pendiente') {
        return res.status(400).json({ message: `Esta solicitud ya fue ${solicitud.estado}.` });
    }

    solicitud.estado = estado;
    await solicitud.save();

    if (estado === 'aceptado') {
      // Lógica adicional si es necesaria cuando se acepta una solicitud
    }

    res.json({ message: `Solicitud ${estado} con éxito.`, solicitud });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el estado de la solicitud.', error: error.message });
  }
};

// Listar todas las solicitudes
exports.listarTodasLasSolicitudes = async (req, res) => {
  try {
    const solicitudes = await ReferralRequest.find().populate('solicitante_id', 'nombre_usuario nombre_completo').populate('referido_id', 'nombre_usuario nombre_completo');
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener todas las solicitudes', error: error.message });
  }
};
