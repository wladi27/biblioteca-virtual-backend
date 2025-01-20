const Usuario = require('../models/usuario');

const agregarUsuario = async (req, res) => {
  try {
    const usuario = new Usuario(req.body);
    await usuario.save();
    res.status(201).json(usuario);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const calcularNivelMasAltoCompletado = async () => {
  const usuarios = await Usuario.find();
  const niveles = {};

  usuarios.forEach(usuario => {
    if (!niveles[usuario.nivel]) {
      niveles[usuario.nivel] = 0;
    }
    niveles[usuario.nivel]++;
  });

  let nivelMasAltoCompletado = 0;
  while (true) {
    const maxUsuariosEnNivel = 3 ** nivelMasAltoCompletado; // 3^n usuarios en el nivel n
    if ((niveles[nivelMasAltoCompletado] || 0) < maxUsuariosEnNivel) {
      break;
    }
    nivelMasAltoCompletado++;
  }

  return nivelMasAltoCompletado - 1; // Restar 1 porque el último nivel no está completo
};

const obtenerPiramideUsuarios = async (req, res) => {
  try {
    const usuarioSesion = await Usuario.findById(req.params.usuario_id);
    if (!usuarioSesion) return res.status(404).json({ message: 'Usuario no encontrado' });

    const nivelUsuarioSesion = usuarioSesion.nivel;

    // Obtener todos los usuarios que están por encima del nivel del usuario en sesión
    let usuarios = await Usuario.find({ nivel: { $gt: nivelUsuarioSesion } });

    // Ordenar usuarios al azar dentro de su mismo nivel
    usuarios = usuarios.sort(() => Math.random() - 0.5);

    const piramide = {
      usuarioRaiz: usuarioSesion,
      niveles: []
    };

    let nivelActual = nivelUsuarioSesion + 1;

    while (true) {
      const usuariosNivelActual = usuarios.filter(usuario => usuario.nivel === nivelActual);
      const maxUsuariosRequeridos = 3 ** nivelActual; // 3^nivelActual usuarios requeridos para completar el nivel

      // Solo incluir niveles que tengan suficientes usuarios
      if (usuariosNivelActual.length >= maxUsuariosRequeridos) {
        piramide.niveles.push({
          nivel: nivelActual,
          usuarios: usuariosNivelActual.slice(0, maxUsuariosRequeridos) // Solo los necesarios
        });
      } else {
        break; // Si no hay suficientes usuarios, salir del bucle
      }

      nivelActual++;
    }

    // Agregar el usuario raíz al nivel correspondiente
    if (!piramide.niveles[0]) {
      piramide.niveles.push({
        nivel: nivelUsuarioSesion,
        usuarios: [usuarioSesion]
      });
    }

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
  calcularNivelMasAltoCompletado,
  obtenerPiramideUsuarios
};
