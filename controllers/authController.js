const Usuario = require('../models/usuario');
const ReferralCode = require('../models/ReferralCode'); // Asegúrate de importar el modelo de ReferralCode
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwtConfig');

// Función para registrar un nuevo usuario
exports.registrarUsuario = async (req, res) => {
  try {
    const { nombre_completo, linea_llamadas, linea_whatsapp, cuenta_numero, banco, titular_cuenta, correo_electronico, dni, nombre_usuario, contraseña, codigo_referido } = req.body;

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({ correo_electronico });
    if (usuarioExistente) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Calcular el nivel correcto para el nuevo usuario
    const usuarios = await Usuario.find();
    const niveles = {};

    usuarios.forEach(usuario => {
      if (!niveles[usuario.nivel]) {
        niveles[usuario.nivel] = 0;
      }
      niveles[usuario.nivel]++;
    });

    let nivelAsignado = 0;
    while (true) {
      const maxUsuariosEnNivel = 3 ** nivelAsignado; // 3^n usuarios en el nivel n
      if ((niveles[nivelAsignado] || 0) < maxUsuariosEnNivel) {
        break;
      }
      nivelAsignado++;
    }

    // Crear el nuevo usuario con el nivel asignado
    const nuevoUsuario = new Usuario({
      nombre_completo,
      linea_llamadas,
      linea_whatsapp,
      cuenta_numero,
      banco,
      titular_cuenta,
      correo_electronico,
      nivel: nivelAsignado,
      dni,
      nombre_usuario,
      contraseña,
      codigo_referido
    });

    // Guardar el nuevo usuario
    await nuevoUsuario.save();

    // Crear y devolver el token JWT
    const token = jwt.sign({ id: nuevoUsuario._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




// Función para autenticar un usuario
exports.autenticarUsuario = async (req, res) => {
  const { nombre_usuario, contraseña } = req.body;

  try {
    const usuario = await Usuario.findOne({ nombre_usuario });
    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const esValido = await usuario.matchPassword(contraseña);
    if (!esValido) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: usuario._id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token, usuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para obtener un usuario por ID
exports.obtenerUsuarioPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json(usuario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para actualizar un usuario
exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, linea_llamadas, linea_whatsapp, cuenta_numero, banco, titular_cuenta, correo_electronico, dni, nombre_usuario } = req.body;

  try {
    const usuario = await Usuario.findByIdAndUpdate(id, {
      nombre_completo,
      linea_llamadas,
      linea_whatsapp,
      cuenta_numero,
      banco,
      titular_cuenta,
      correo_electronico,
      dni,
      nombre_usuario
    }, { new: true });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario actualizado exitosamente', usuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para eliminar un usuario
exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findByIdAndDelete(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
