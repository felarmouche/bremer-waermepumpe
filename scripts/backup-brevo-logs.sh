#!/usr/bin/env bash
# ============================================================
# Brevo SMS-Log-Archiv — bremer-waermepumpe.de
#
# Lädt die Transaktionslogs (SMS) der letzten 30 Tage von der
# Brevo-API herunter und speichert sie als JSON in backups/brevo/.
#
# ZWECK: Unabhängiger Nachweis, dass SMS-Codes tatsächlich gesendet
# wurden. Brevo ist ein Drittanbieter — diese Logs können nicht
# nachträglich von Ferris verfälscht werden. In Kombination mit
# dem D1-Backup ergibt sich ein korroborierter Einwilligungsnachweis
# nach § 7a UWG.
#
# Nutzung:
#   BREVO_API_KEY=xxx bash scripts/backup-brevo-logs.sh
#
# API-Key findest du unter: https://app.brevo.com → Settings → API Keys
# ============================================================

set -euo pipefail

if [ -z "${BREVO_API_KEY:-}" ]; then
  echo "FEHLER: BREVO_API_KEY ist nicht gesetzt."
  echo "Nutzung: BREVO_API_KEY=xxx bash scripts/backup-brevo-logs.sh"
  exit 1
fi

BACKUP_DIR="backups/brevo"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_FILE="${BACKUP_DIR}/sms_logs_${TIMESTAMP}.json"

mkdir -p "$BACKUP_DIR"

echo "→ Lade Brevo SMS-Transaktionslogs ..."

# Brevo Transactional SMS API: letzte 500 Nachrichten der letzten 90 Tage
curl -s \
  -H "api-key: ${BREVO_API_KEY}" \
  -H "accept: application/json" \
  "https://api.brevo.com/v3/transactionalSMS/statistics/aggregatedReport" \
  > /dev/null  # Test ob API erreichbar

# Hole detaillierte SMS-Liste (Empfänger-Hash, Status, Timestamp)
# Limit: 500 pro Request — bei mehr Leads Pagination implementieren
curl -s \
  -H "api-key: ${BREVO_API_KEY}" \
  -H "accept: application/json" \
  "https://api.brevo.com/v3/transactionalSMS/statistics/eventsReport?limit=500&sort=desc" \
  > "$OUTPUT_FILE"

RECORD_COUNT=$(python3 -c "import json,sys; d=json.load(open('$OUTPUT_FILE')); print(len(d.get('events', [])))" 2>/dev/null || echo "?")

echo "✓ Brevo-Logs gespeichert: ${OUTPUT_FILE}"
echo "  Datensätze: ${RECORD_COUNT}"
echo ""
echo "HINWEIS: Diese Logs enthalten Telefonnummern (teilweise maskiert)"
echo "und Sendezeiten. Sie dienen als externer Beweis für das"
echo "SMS-Code-Ident-Verfahren (§ 7a UWG, BGH I ZR 164/09)."
echo ""
echo "Aufbewahrung: Mindestens 5 Jahre."
