#!/usr/bin/env bash
# Replica en un entorno Traccar (producción, ensayo o local) la configuración de
# la alarma de Salida 1 del FMC130 probada en producción el 16/11/2026:
#   1. Modelo del dispositivo = FMC130 (para que IO 252 se decodifique como powerCut)
#   2. Atributo calculado "alarm": out1 (salida DOUT1) activa -> agrega input1On
#   3. Notificación de tipo Alarma (powerCut, input1On) por el canal indicado
#   4. Vínculos del atributo y de la notificación con el dispositivo
#
# Es idempotente: si algo ya existe, no lo duplica. Usa solo la API de Traccar.
# Requiere: curl y jq.
#
# Uso (la contraseña se pide sin mostrarla si no se define PASSWORD):
#   BASE_URL=http://localhost:8082 EMAIL=admin NOTIFICATOR=web ./tools/replicar_notificaciones.sh
#
# Variables:
#   BASE_URL     obligatoria. Producción: https://app.elitetrack.site
#                Ensayo (desde el VPS): http://127.0.0.1:8083 · Local: http://localhost:8082
#   EMAIL        obligatoria. Usuario administrador de ESE entorno.
#   NOTIFICATOR  canal o canales de la notificación, separados por coma. Por defecto "web".
#                Producción usa "traccar,web": traccar = push al celular; web = aviso y
#                lista de la campana del mapa (sin "web" la campana queda vacía).
#                En ensayo y local NO uses "traccar": si un canal no está activo en el
#                servidor, Traccar lanza una excepción y se pierden todas las
#                notificaciones de ese evento.
#   IMEI         por defecto 865124073074769 (prueba-jammer)
#   MODEL        por defecto FMC130

set -euo pipefail

BASE_URL="${BASE_URL:?Define BASE_URL, ej. http://localhost:8082}"
BASE_URL="${BASE_URL%/}"
EMAIL="${EMAIL:?Define EMAIL del administrador}"
IMEI="${IMEI:-865124073074769}"
MODEL="${MODEL:-FMC130}"
NOTIFICATOR="${NOTIFICATOR:-web}"

ATTR_DESC="Salida 1 activada (alarma)"
ATTR_EXPR='(out1 ?? false) ? ((alarm ?? "") == "" ? "input1On" : alarm + ",input1On") : (alarm ?? null)'
ALARMS="powerCut,input1On"

command -v jq >/dev/null || { echo "Falta jq (Linux: sudo apt install jq | Windows: winget install jqlang.jq)"; exit 1; }

if [ -z "${PASSWORD:-}" ]; then
  read -r -s -p "Contraseña de $EMAIL en $BASE_URL: " PASSWORD; echo
fi

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

api() { curl -sS -f -b "$JAR" -H 'Content-Type: application/json' "$@"; }

echo "== Iniciando sesión en $BASE_URL"
curl -sS -f -c "$JAR" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASSWORD" \
  "$BASE_URL/api/session" >/dev/null || { echo "   No se pudo iniciar sesión."; exit 1; }
unset PASSWORD

NOTIFICATOR="$(tr -d ' ' <<<"$NOTIFICATOR")"
echo "== 0. Canales '$NOTIFICATOR' disponibles en este servidor"
DISPONIBLES="$(api "$BASE_URL/api/notifications/notificators" | jq -r '.[].type')"
for canal in ${NOTIFICATOR//,/ }; do
  if ! grep -qx "$canal" <<<"$DISPONIBLES"; then
    echo "   El canal '$canal' no está activo aquí (notificator.types). Canales disponibles:"
    sed 's/^/     - /' <<<"$DISPONIBLES"
    exit 1
  fi
done
echo "   OK."

echo "== 1. Dispositivo $IMEI -> modelo $MODEL"
DEVICE="$(api "$BASE_URL/api/devices?uniqueId=$IMEI" | jq '.[0]')"
if [ "$DEVICE" = "null" ]; then
  echo "   El dispositivo $IMEI no existe en este entorno. Créalo primero."; exit 1
fi
DEVICE_ID="$(jq -r .id <<<"$DEVICE")"
if [ "$(jq -r '.model // ""' <<<"$DEVICE")" != "$MODEL" ]; then
  api -X PUT "$BASE_URL/api/devices/$DEVICE_ID" -d "$(jq --arg m "$MODEL" '.model = $m' <<<"$DEVICE")" >/dev/null
  echo "   Modelo actualizado (id $DEVICE_ID). Se aplica cuando el equipo vuelva a conectarse."
else
  echo "   Ya tenía modelo $MODEL (id $DEVICE_ID)."
fi

echo "== 2. Atributo calculado '$ATTR_DESC'"
# Se busca por contenido (atributo alarm que agrega input1On), no por descripción,
# para reutilizar el creado antes como "Entrada 1 activada (alarma)".
ATTR="$(api "$BASE_URL/api/attributes/computed?all=true" | \
  jq '[.[] | select(.attribute == "alarm" and ((.expression // "") | contains("input1On")))][0]')"
BODY="$(jq -n --arg d "$ATTR_DESC" --arg e "$ATTR_EXPR" \
  '{description: $d, attribute: "alarm", expression: $e, type: "string", priority: 0}')"
if [ "$ATTR" = "null" ]; then
  ATTR_ID="$(api -X POST "$BASE_URL/api/attributes/computed" -d "$BODY" | jq -r .id)"
  echo "   Creado (id $ATTR_ID)."
else
  ATTR_ID="$(jq -r .id <<<"$ATTR")"
  if [ "$(jq -r .expression <<<"$ATTR")" = "$ATTR_EXPR" ] && [ "$(jq -r .description <<<"$ATTR")" = "$ATTR_DESC" ]; then
    echo "   Ya existía igual (id $ATTR_ID)."
  else
    api -X PUT "$BASE_URL/api/attributes/computed/$ATTR_ID" \
      -d "$(jq --argjson id "$ATTR_ID" '. + {id: $id}' <<<"$BODY")" >/dev/null
    echo "   Ya existía (id $ATTR_ID); descripción y expresión actualizadas."
  fi
fi

echo "== 3. Notificación de alarma ($ALARMS)"
# Compara el conjunto de alarmas, sin importar el orden en que se eligieron en la web.
NOTIF="$(api "$BASE_URL/api/notifications?all=true" | jq --arg a "$ALARMS" '
  def set(s): s | gsub(" "; "") | split(",") | map(select(. != "")) | sort;
  [.[] | select(.type == "alarm" and set(.attributes.alarms // "") == set($a))][0]')"
if [ "$NOTIF" = "null" ]; then
  NOTIF_ID="$(api -X POST "$BASE_URL/api/notifications" -d "$(jq -n --arg a "$ALARMS" --arg n "$NOTIFICATOR" \
    '{type: "alarm", always: false, notificators: $n, attributes: {alarms: $a}}')" | jq -r .id)"
  echo "   Creada con canal '$NOTIFICATOR' (id $NOTIF_ID)."
else
  NOTIF_ID="$(jq -r .id <<<"$NOTIF")"
  CANALES="$(jq -r '.notificators // ""' <<<"$NOTIF")"
  # Agrega los canales que falten; no quita los que ya tenga.
  NUEVOS="$(jq -rn --arg a "$CANALES" --arg b "$NOTIFICATOR" '
    ($a | gsub(" "; "") | split(",") | map(select(. != ""))) as $ya
    | ($b | split(",") | map(select(. != ""))) as $req
    | ($ya + ($req - $ya)) | join(",")')"
  if [ "$NUEVOS" = "$CANALES" ]; then
    echo "   Ya existía (id $NOTIF_ID) con canales '$CANALES'."
  else
    api -X PUT "$BASE_URL/api/notifications/$NOTIF_ID" \
      -d "$(jq --arg n "$NUEVOS" '.notificators = $n' <<<"$NOTIF")" >/dev/null
    echo "   Ya existía (id $NOTIF_ID); canales '$CANALES' -> '$NUEVOS'."
  fi
fi

echo "== 4. Vínculos con el dispositivo $DEVICE_ID"
if api "$BASE_URL/api/attributes/computed?deviceId=$DEVICE_ID" | jq -e --argjson id "$ATTR_ID" 'any(.[]; .id == $id)' >/dev/null; then
  echo "   Atributo $ATTR_ID ya vinculado."
else
  api -X POST "$BASE_URL/api/permissions" -d "{\"deviceId\": $DEVICE_ID, \"attributeId\": $ATTR_ID}" >/dev/null
  echo "   Atributo $ATTR_ID vinculado."
fi
if api "$BASE_URL/api/notifications?deviceId=$DEVICE_ID" | jq -e --argjson id "$NOTIF_ID" 'any(.[]; .id == $id)' >/dev/null; then
  echo "   Notificación $NOTIF_ID ya vinculada."
else
  api -X POST "$BASE_URL/api/permissions" -d "{\"deviceId\": $DEVICE_ID, \"notificationId\": $NOTIF_ID}" >/dev/null
  echo "   Notificación $NOTIF_ID vinculada."
fi

echo
echo "Listo. No hace falta reiniciar Traccar: los atributos y notificaciones se aplican de inmediato."
