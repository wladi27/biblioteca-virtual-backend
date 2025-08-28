const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar variables de entorno desde el archivo .env en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Asumimos que tu modelo de Aporte está en ../models/aporte.js
// ¡Asegúrate de que la ruta y el nombre del modelo sean correctos!
const Aporte = require('../models/aporteModel');

/**
 * Script para importar aportes desde un archivo JSON a la base de datos.
 * Este script usa Mongoose para ser consistente con el resto de tu aplicación.
 */
async function importarAportes() {
  try {
    // Conectar a la base de datos usando la URI de .env
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Conectado para la importación...');

    console.log('Iniciando la importación de aportes...');

    // 1. Definir la ruta al archivo JSON
    // El archivo aportes.json debe estar en la raíz del proyecto.
    const filePath = path.join(__dirname, '..', 'aportes.json');
    console.log(`Leyendo datos desde: ${filePath}`);

    // 2. Leer y parsear el archivo JSON
    const fileContent = await fs.readFile(filePath, 'utf8');
    const aportesParaImportar = JSON.parse(fileContent);

    if (!Array.isArray(aportesParaImportar) || aportesParaImportar.length === 0) {
      console.log('El archivo JSON está vacío o no contiene un array. No hay nada que importar.');
      return;
    }

    console.log(`Se encontraron ${aportesParaImportar.length} aportes para importar.`);

    // OPCIONAL: Si quieres borrar todos los aportes antes de importar, descomenta la siguiente línea.
    // console.log('Eliminando datos de aportes existentes...');
    // await Aporte.deleteMany({});

    // 3. Insertar los datos en la base de datos usando insertMany para eficiencia.
    await Aporte.insertMany(aportesParaImportar);

    console.log('✅ ¡Importación completada exitosamente!');

  } catch (error) {
    console.error('❌ Ocurrió un error durante la importación:', error);
    process.exit(1); // Salir del script con un código de error.
  } finally {
    // 4. Cerramos la conexión a la base de datos
    console.log('Cerrando conexión con la base de datos.');
    await mongoose.disconnect();
  }
}

// Ejecutamos la función principal
importarAportes();
