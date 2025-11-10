#!/bin/bash
# Script para realizar un backup completo de la base de datos MongoDB

# URI de conexión a la base de datos MongoDB
MONGO_URI="mongodb://wladi:Wladi.0127!@72.60.70.200:27000"

# Directorio donde se guardará el backup
BACKUP_DIR="./backups"

# Nombre del archivo de backup (con fecha)
BACKUP_NAME="mongodb_backup_$(date +%Y%m%d_%H%M%S)"

# Comando mongodump
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/$BACKUP_NAME"

echo "Backup de MongoDB completado en: $BACKUP_DIR/$BACKUP_NAME"
