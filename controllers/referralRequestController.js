const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario');
const Aporte = require('../models/aporteModel');

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

    const solicitud = await ReferralRequest.create({ solicitante_id, referido_id, requestType: 'referrer_initiated' });
    res.status(201).json({ message: 'Solicitud de referido creada con éxito.', solicitud });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la solicitud de referido.', error: error.message });
  }
};

// Crear solicitud de referido desde el referido hacia el patrocinador
exports.crearSolicitudDesdeReferido = async (req, res) => {
  try {
    const { solicitante_id, patrocinador_id } = req.body; // solicitante_id es el referido, patrocinador_id es el patrocinador

    // No puedes referirte a ti mismo
    if (solicitante_id === patrocinador_id) {
      return res.status(400).json({ message: 'No puedes referirte a ti mismo.' });
    }

    // Verifica que ambos usuarios existan
    const solicitante = await Usuario.findById(solicitante_id); // Este es el referido
    const patrocinador = await Usuario.findById(patrocinador_id); // Este es el patrocinador

    if (!solicitante || !patrocinador) {
      return res.status(404).json({ message: 'Usuario (patrocinador o referido) no encontrado.' });
    }

    // Un usuario (solicitante_id) solo puede ser referido por una persona (solicitud aceptada)
    // En este flujo, el solicitante_id es el referido, por lo que verificamos si ya tiene un patrocinador aceptado
    const existingAcceptedRequestForReferred = await ReferralRequest.findOne({
        solicitante_id, // El referido ya tiene un patrocinador aceptado
        estado: 'aceptado'
    });

    if (existingAcceptedRequestForReferred) {
        return res.status(400).json({ message: 'Ya tienes un patrocinador asignado.' });
    }

    // Un usuario (solicitante_id) no puede tener multiples solicitudes pendientes
    const existingPendingRequestForReferred = await ReferralRequest.findOne({
        solicitante_id, // El referido ya tiene una solicitud pendiente
        estado: 'pendiente'
    });

    if (existingPendingRequestForReferred) {
        return res.status(400).json({ message: 'Ya tienes una solicitud de patrocinio pendiente.' });
    }

    // Prevenir referencias circulares (el patrocinador no puede ser un referido del solicitante)
    let current_id = patrocinador_id;
    while (current_id) {
        if (current_id.toString() === solicitante_id.toString()) {
            return res.status(400).json({ message: 'No puedes solicitar patrocinio a alguien que ya es tu referido (referencia circular detectada).' });
        }
        // Buscamos si el current_id es referido por alguien
        const request = await ReferralRequest.findOne({ referido_id: current_id, estado: 'aceptado' });
        current_id = request ? request.solicitante_id : null;
    }

    const solicitud = await ReferralRequest.create({
      solicitante_id: solicitante_id, // El referido
      referido_id: patrocinador_id, // El patrocinador
      requestType: 'referred_initiated'
    });
    res.status(201).json({ message: 'Solicitud de patrocinio creada con éxito.', solicitud });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la solicitud de patrocinio.', error: error.message });
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

    if (estado === 'aceptado') {
      let userIdForAporteCheck;
      if (solicitud.requestType === 'referred_initiated') {
        // Si la solicitud fue iniciada por el referido, el aporte debe ser del solicitante_id (el referido)
        userIdForAporteCheck = solicitud.solicitante_id;
      } else {
        // Si la solicitud fue iniciada por el referente, el aporte debe ser del referido_id (el referido)
        userIdForAporteCheck = solicitud.referido_id;
      }

      const aporte = await Aporte.findOne({ usuarioId: userIdForAporteCheck, aporte: true });
      if (!aporte) {
        return res.status(400).json({ message: 'El usuario referido debe haber realizado el aporte para aceptar la solicitud.' });
      }
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

// Aceptar todas las solicitudes pendientes que cumplan con las condiciones
exports.aceptarTodasLasSolicitudes = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'El ID del usuario es requerido.' });
  }

  try {
    // Busca todas las solicitudes pendientes para el usuario actual (que es el referido_id)
    const solicitudesPendientes = await ReferralRequest.find({
      referido_id: userId,
      estado: 'pendiente'
    }).populate('solicitante_id', 'nivel');

    if (solicitudesPendientes.length === 0) {
      return res.status(200).json({ message: 'No hay solicitudes pendientes para procesar.' });
    }

    const resultados = {
      aceptadas: [],
      fallidas: []
    };

    for (const solicitud of solicitudesPendientes) {
      let userIdForAporteCheck;
      let referrerUserIdForRecarga;
      let referredUserLevel;

      // Determinar el referido y el referente basado en el tipo de solicitud
      if (solicitud.requestType === 'referred_initiated') {
        userIdForAporteCheck = solicitud.solicitante_id._id;
        referrerUserIdForRecarga = solicitud.referido_id;
      } else {
        userIdForAporteCheck = solicitud.referido_id;
        referrerUserIdForRecarga = solicitud.solicitante_id._id;
      }
      
      // Verificar si el usuario referido ha hecho el aporte
      const aporte = await Aporte.findOne({ usuarioId: userIdForAporteCheck, aporte: true });

      if (aporte) {
        // Si el aporte existe, aceptar la solicitud
        solicitud.estado = 'aceptado';
        await solicitud.save();

        // Obtener el nivel del usuario que hizo el aporte
        const referredUser = await Usuario.findById(userIdForAporteCheck);
        referredUserLevel = referredUser.nivel;

        // Aquí se podría llamar a la lógica de recarga/comisión
        // Por simplicidad, solo se cambia el estado y se añade a la lista de aceptadas
        // La lógica de recarga se manejará en el frontend para consistencia
        resultados.aceptadas.push({
          solicitudId: solicitud._id,
          referredUserId: userIdForAporteCheck,
          referredUserLevel: referredUserLevel,
          referrerUserId: referrerUserIdForRecarga
        });
      } else {
        // Si no hay aporte, se añade a la lista de fallidas
        resultados.fallidas.push({
          solicitudId: solicitud._id,
          reason: 'El usuario referido no ha realizado el aporte.'
        });
      }
    }

    res.status(200).json({
      message: `Proceso completado. Aceptadas: ${resultados.aceptadas.length}. Fallidas: ${resultados.fallidas.length}.`,
      resultados
    });

  } catch (error) {
    res.status(500).json({ message: 'Error al procesar las solicitudes.', error: error.message });
  }
};
