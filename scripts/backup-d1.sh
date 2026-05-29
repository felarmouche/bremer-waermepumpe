#!/usr/bin/env bash
# ============================================================
# D1 Backup-Skript — bremer-waermepumpe.de
#
# Exportiert die Produktions-D1-Datenbank als SQL-Dump in
# das Verzeichnis backups/d1/ mit Zeitstempel im Dateinamen.
#
# Aufbewahrungspflicht: § 7a UWG → 5 Jahre für Einwilligungs-
# nachweise. Diese Backups MÜSSEN entsprechend lang archiviert
# werden. Empfehlung: monatlicher Lauf, ältere Backups erst nach
# 5+ Jahren löschen.
#
# Nutzung:
#   bash scripts/backup-d1.sh
#
# Voraussetzung: wrangler muss installiert und authentifiziert sein
#   npx wrangler login
# ============================================================

set -euo pipefail

DB_NAME="anonymous-leads"
BACKUP_DIR="backups/d1"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "→ Exportiere D1-Datenbank '${DB_NAME}' ..."
npx wrangler d1 export "$DB_NAME" --remote --output "$OUTPUT_FILE"

echo "✓ Backup gespeichert: ${OUTPUT_FILE}"
echo ""
echo "Dateigröße: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "HINWEIS: Dieses Backup enthält personenbezogene Daten (Name,"
echo "Telefon, Anschrift). Es muss genauso sicher aufbewahrt werden"
echo "wie die Produktionsdatenbank — nicht in öffentlichen Git-Repos!"
echo ""
echo "Aufbewahrung: Mindestens 5 Jahre (§ 7a UWG — Einwilligungsnachweise)."
