#!/bin/bash

# Script para restaurar un backup de MongoDB a una nueva base de datos.

# !!! IMPORTANTE !!!
# Edita la siguiente línea con la URI de conexión de la base de datos de DESTINO.
# Ejemplo: MONGO_URI_DEST="mongodb://user:password@host:port/nueva_base_de_datos"
MONGO_URI_DEST="mongodb://usuario:contraseña@host:puerto/basededatos_destino"

# Ruta al directorio del backup que quieres restaurar.
# Puedes pasar la ruta como primer argumento al ejecutar el script.
# Ejemplo: ./restore_mongodb.sh backups/mongodb_backup_20251031_113046
BACKUP_PATH=$1

# Verifica que se haya proporcionado la ruta del backup
if [ -z "$BACKUP_PATH" ]; then
  echo "Error: No se proporcionó la ruta al directorio del backup."
  echo "Uso: $0 <ruta_al_directorio_del_backup>"
  exit 1
fi

# Comando mongorestore
# --drop: Elimina las colecciones de la base de datos de destino antes de restaurar.
mongorestore --uri="$MONGO_URI_DEST" --dir="$BACKUP_PATH" --drop

echo "Restauración de MongoDB completada."
