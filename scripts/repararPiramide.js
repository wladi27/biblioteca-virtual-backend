const mongoose = require('mongoose');
const Usuario = require('../models/usuario');

const repararPiramide = async () => {
  try {
    // Conectar a la base de datos
    await mongoose.connect('mongodb://wladi:Wladi.0127!@72.60.70.200:27000', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Conectado a MongoDB...');

    // Obtener todos los usuarios ordenados por fecha de creación
    const usuarios = await Usuario.find().sort({ _id: 1 });
    
    // El primer usuario es la raíz de la pirámide
    const usuarioRaiz = usuarios[0];
    usuarioRaiz.nivel = 1;
    usuarioRaiz.nivel_piramide = 1;
    usuarioRaiz.padre_id = null;
    await usuarioRaiz.save();

    // Reconstruir la pirámide nivel por nivel
    let nivelActual = 1;
    let usuariosPorNivel = {
      1: [usuarioRaiz]
    };

    // Función para asignar hijos a un padre
    const asignarHijoAPadre = async (padre, hijo) => {
      if (!padre.hijo1_id) {
        padre.hijo1_id = hijo._id;
      } else if (!padre.hijo2_id) {
        padre.hijo2_id = hijo._id;
      } else if (!padre.hijo3_id) {
        padre.hijo3_id = hijo._id;
      }
      
      hijo.padre_id = padre._id;
      hijo.nivel = padre.nivel + 1;
      hijo.nivel_piramide = padre.nivel + 1;
      
      await padre.save();
      await hijo.save();
      
      return hijo;
    };

    // Reconstruir la pirámide
    for (let i = 1; i < usuarios.length; i++) {
      const usuario = usuarios[i];
      
      // Buscar un padre que tenga espacio disponible
      let padreEncontrado = null;
      
      for (let n = nivelActual; n >= 1; n--) {
        if (usuariosPorNivel[n]) {
          for (const padre of usuariosPorNivel[n]) {
            const padreCompleto = await Usuario.findById(padre._id);
            
            if (!padreCompleto.hijo1_id || !padreCompleto.hijo2_id || !padreCompleto.hijo3_id) {
              padreEncontrado = padreCompleto;
              break;
            }
          }
        }
        if (padreEncontrado) break;
      }

      if (padreEncontrado) {
        const usuarioActualizado = await asignarHijoAPadre(padreEncontrado, usuario);
        
        // Actualizar la estructura de niveles
        const nuevoNivel = padreEncontrado.nivel + 1;
        if (!usuariosPorNivel[nuevoNivel]) {
          usuariosPorNivel[nuevoNivel] = [];
        }
        usuariosPorNivel[nuevoNivel].push(usuarioActualizado);
        
        nivelActual = Math.max(nivelActual, nuevoNivel);
        
        console.log(`Usuario ${usuario.nombre_usuario} asignado como hijo de ${padreEncontrado.nombre_usuario} en nivel ${nuevoNivel}`);
      } else {
        console.log(`No se encontró padre disponible para: ${usuario.nombre_usuario}`);
      }
    }

    console.log('¡Piramide reparada exitosamente!');
    
  } catch (error) {
    console.error('Error al reparar la pirámide:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
};

// Ejecutar la reparación
repararPiramide();