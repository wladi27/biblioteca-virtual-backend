const Usuario = require('../models/usuario');
const ReferralCode = require('../models/ReferralCode'); // Asegúrate de importar el modelo de ReferralCode

const agregarUsuario = async (req, res) => {
  try {
    const { 
      nombre_completo, 
      linea_llamadas, 
      linea_whatsapp, 
      cuenta_numero, 
      banco, 
      titular_cuenta, 
      correo_electronico, 
      dni, 
      nombre_usuario, 
      contraseña, 
      codigo_referido 
    } = req.body;

    // Validar el código de referido
    let referralCode = null;
    if (codigo_referido) {
      referralCode = await ReferralCode.findOne({ code: codigo_referido, used: false });
      if (referralCode) {
        // Actualizar el código de referido a usado
        referralCode.used = true;
        await referralCode.save();
      } else {
        return res.status(400).json({ message: 'Código de referido inválido o ya utilizado' });
      }
    }

    // Verificar si el correo electrónico ya existe
    const usuarioExistenteCorreo = await Usuario.findOne({ correo_electronico });
    if (usuarioExistenteCorreo) {
      return res.status(400).json({ message: 'El correo electrónico ya está en uso' });
    }

    // Verificar si el nombre de usuario ya existe
    const usuarioExistenteNombre = await Usuario.findOne({ nombre_usuario });
    if (usuarioExistenteNombre) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }

    const nuevoUsuario = new Usuario({ 
      nombre_completo, 
      linea_llamadas, 
      linea_whatsapp, 
      cuenta_numero, 
      banco, 
      titular_cuenta, 
      correo_electronico, 
      dni, 
      nombre_usuario, 
      contraseña,
      codigo_referido 
    });

    // Lógica para determinar el padre y nivel
    const usuarios = await Usuario.find();
    let padre_id = null;
    let nivel = 1;

    if (usuarios.length > 0) {
      const ultimoUsuario = usuarios[usuarios.length - 1];
      nivel = ultimoUsuario.nivel + 1;

      // Buscar un padre disponible
      const padre = await Usuario.findOne({
        $or: [
          { hijo1_id: null },
          { hijo2_id: null },
          { hijo3_id: null }
        ]
      }).sort({ _id: 1 });

      if (padre) {
        padre_id = padre._id;
      }
    }

    nuevoUsuario.padre_id = padre_id;
    nuevoUsuario.nivel = nivel;

    // Guardar el nuevo usuario
    await nuevoUsuario.save();

    // Asignar al nuevo usuario como hijo del padre
    if (padre_id) {
      await asignarHijo(padre_id, nuevoUsuario._id);
    }

    res.status(201).json(nuevoUsuario);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' }); // Mensaje genérico
  }
};

const asignarHijo = async (padre_id, hijo_id) => {
  const padre = await Usuario.findById(padre_id);
  if (padre) {
    if (!padre.hijo1_id) {
      padre.hijo1_id = hijo_id;
    } else if (!padre.hijo2_id) {
      padre.hijo2_id = hijo_id;
    } else if (!padre.hijo3_id) {
      padre.hijo3_id = hijo_id;
    }
    await padre.save();
  }
};

const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.status(200).json(usuario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.status(200).json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener pirámide por ID de usuario
const obtenerPiramideUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;

    const construirPiramide = async (id) => {
      const usuario = await Usuario.findById(id).populate('hijo1_id hijo2_id hijo3_id');
      if (!usuario) return null;

      return {
        _id: usuario._id,
        nombre_completo: usuario.nombre_completo,
        hijos: [
          await construirPiramide(usuario.hijo1_id),
          await construirPiramide(usuario.hijo2_id),
          await construirPiramide(usuario.hijo3_id),
        ].filter(child => child !== null),
      };
    };

    const piramide = await construirPiramide(usuarioId);
    res.status(200).json(piramide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener pirámide global (desde el primer usuario)
const obtenerPiramideGlobal = async (req, res) => {
  try {
    // Obtener el primer usuario de la colección
    const primerUsuario = await Usuario.findOne().sort({ _id: 1 });
    if (!primerUsuario) return res.status(404).json({ message: 'No hay usuarios disponibles' });

    const construirPiramide = async (id) => {
      const usuario = await Usuario.findById(id).populate('hijo1_id hijo2_id hijo3_id');
      if (!usuario) return null;

      return {
        _id: usuario._id,
        nombre_completo: usuario.nombre_completo,
        hijos: [
          await construirPiramide(usuario.hijo1_id),
          await construirPiramide(usuario.hijo2_id),
          await construirPiramide(usuario.hijo3_id),
        ].filter(child => child !== null),
      };
    };

    // Construir la pirámide a partir del primer usuario
    const piramide = await construirPiramide(primerUsuario._id);
    res.status(200).json(piramide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  agregarUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  eliminarUsuario,
  obtenerPiramideUsuario,
  obtenerPiramideGlobal,
};
