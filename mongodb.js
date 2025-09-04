const { MongoClient } = require('mongodb');
require('dotenv').config(); // Para leer variables de entorno desde un archivo .env

// 1. Configura tus cadenas de conexión
// Es una mejor práctica usar variables de entorno para las credenciales.
const sourceUri = process.env.SOURCE_MONGO_URI || "mongodb://wladi:Wladi.0127!@72.60.70.200:27000";
const destUri = process.env.DEST_MONGO_URI || "mongodb+srv://wladimir:W27330449@mls.s2hdk.mongodb.net/";

// 2. Nombres de las bases de datos
const sourceDBName = 'biblioteca_db';
const destDBName = 'test'; // Puede ser el mismo o uno nuevo

async function migrate() {
  if (!sourceUri || !destUri) {
    console.error("Por favor, define las variables de entorno SOURCE_MONGO_URI y DEST_MONGO_URI.");
    process.exit(1);
  }

  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);

  try {
    // Conectar a ambos servidores
    await sourceClient.connect();
    console.log("Conectado a la base de datos de origen (Atlas)...");
    await destClient.connect();
    console.log("Conectado a la base de datos de destino...");

    const sourceDb = sourceClient.db(sourceDBName);
    const destDb = destClient.db(destDBName);

    // Obtener la lista de colecciones de la base de datos de origen
    const collections = await sourceDb.listCollections().toArray();

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`--- Migrando colección: ${collectionName} ---`);

      const sourceCollection = sourceDb.collection(collectionName);
      const destCollection = destDb.collection(collectionName);

      // Opcional: Limpiar la colección de destino antes de insertar
      // await destCollection.deleteMany({});

      // Leer todos los documentos de la colección de origen
      const documents = await sourceCollection.find({}).toArray();

      // Insertar los documentos en la colección de destino
      if (documents.length > 0) {
        await destCollection.insertMany(documents, { ordered: false }); // ordered:false para continuar si hay un error
        console.log(` -> Se migraron ${documents.length} documentos a la colección ${collectionName}.`);
      } else {
        console.log(` -> La colección ${collectionName} está vacía, no se migró nada.`);
      }
    }

    console.log("\n¡Migración completada exitosamente!");

  } catch (err) {
    console.error("Ocurrió un error durante la migración:", err);
  } finally {
    // Asegurarse de cerrar las conexiones
    await sourceClient.close();
    await destClient.close();
    console.log("Conexiones cerradas.");
  }
}

migrate();
