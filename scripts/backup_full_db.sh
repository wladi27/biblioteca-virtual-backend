#!/bin/bash

# This script creates a backup of a MongoDB server.

# --- Configuration ---
# The URI of the MongoDB server to backup.
MONGO_URI="mongodb://wladi:Wladi.0127!@72.60.70.200:27000"

# The directory where the backup will be stored.
BACKUP_DIR="/home/hp/Escritorio/mls/biblioteca-virtual-backend/backups"

# --- Main Logic ---
echo "Starting backup of all databases from: $MONGO_URI"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_PATH="$BACKUP_DIR/full-backup-$TIMESTAMP.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Run mongodump to backup all databases
mongodump --uri="$MONGO_URI" --archive="$ARCHIVE_PATH" --gzip

if [ $? -eq 0 ]; then
    echo "Backup successful: $ARCHIVE_PATH"
else
    echo "Error: Backup failed."
    exit 1
fi