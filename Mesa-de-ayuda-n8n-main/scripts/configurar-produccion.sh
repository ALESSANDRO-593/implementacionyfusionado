#!/usr/bin/env bash
# =====================================================================
# YaviBot — Ajustes de producción (se ejecuta EN EL SERVIDOR)
#
#   Uso:  bash scripts/configurar-produccion.sh <IP-O-DOMINIO>
#   Ej.:  bash scripts/configurar-produccion.sh 169.58.138.164
#
# Hace tres cosas:
#   1. Apunta la URL del QR de los certificados a la dirección pública.
#   2. Cambia el secreto del JWT (venía uno de desarrollo, en 15 workflows).
#   3. Cambia la contraseña de PostgreSQL (en la base, en docker-compose
#      y en los workflows que la usan).
# Y después reimporta los workflows en n8n, porque n8n los lee de su
# volumen y no de los archivos .json del repositorio.
#
# Se puede ejecutar las veces que haga falta: cada paso detecta si ya
# estaba hecho y lo omite en vez de fallar.
# =====================================================================
set -uo pipefail   # (sin -e: los pasos se verifican uno a uno)

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "Falta la dirección pública. Uso: bash $0 <IP-O-DOMINIO>" >&2
  exit 1
fi

cd "$(dirname "$0")/.." || exit 1
RAIZ="$PWD"
echo "Proyecto: $RAIZ"
echo "Dirección pública: $BASE"
echo

SECRETO_VIEJO='yavibot-dev-secret-change-me'
PASS_VIEJA='yavibot_dev_2026'
CREDENCIALES="$RAIZ/.credenciales-produccion.txt"

# --- Copia de seguridad (solo la primera vez) -------------------------
RESPALDO="$RAIZ/.respaldo-preproduccion"
if [[ ! -d "$RESPALDO" ]]; then
  mkdir -p "$RESPALDO"
  cp -r n8n/workflows "$RESPALDO/"
  cp docker-compose.yml "$RESPALDO/"
  echo "Copia de seguridad guardada en $RESPALDO"
  echo
fi

# --- 1) URL del QR de los certificados --------------------------------
ARCHIVOS=$(grep -rl 'http://localhost:4200/verificar/' n8n/workflows/ 2>/dev/null || true)
if [[ -n "$ARCHIVOS" ]]; then
  echo "$ARCHIVOS" | xargs sed -i "s#http://localhost:4200/verificar/#http://$BASE/verificar/#g"
  echo "1/4  URL del QR      -> http://$BASE/verificar/"
else
  YA=$(grep -rl "http://$BASE/verificar/" n8n/workflows/ 2>/dev/null || true)
  if [[ -n "$YA" ]]; then
    echo "1/4  URL del QR      -> ya estaba en http://$BASE/verificar/"
  else
    echo "1/4  URL del QR      -> AVISO: no se encontró ninguna URL de verificación"
  fi
fi

# --- 2) Secreto del JWT -----------------------------------------------
ARCHIVOS=$(grep -rl "$SECRETO_VIEJO" n8n/workflows/ 2>/dev/null || true)
if [[ -n "$ARCHIVOS" ]]; then
  SECRETO_NUEVO="$(openssl rand -hex 32)"
  N=$(echo "$ARCHIVOS" | wc -l)
  echo "$ARCHIVOS" | xargs sed -i "s#$SECRETO_VIEJO#$SECRETO_NUEVO#g"
  echo "2/4  Secreto del JWT -> cambiado en $N workflows"
  { echo "Secreto JWT:              $SECRETO_NUEVO"; } >> "$CREDENCIALES"
else
  SECRETO_NUEVO=""
  echo "2/4  Secreto del JWT -> ya estaba cambiado"
fi

# --- 3) Contraseña de PostgreSQL --------------------------------------
# Ojo: no basta con los archivos .json. Cuatro nodos de los workflows del
# chatbot (Buscar Estudiante, Guardar OTP, Buscar OTP, Marcar Usado) no
# llevan la contraseña escrita, sino que usan una CREDENCIAL guardada
# dentro de n8n. Si no se actualiza también ahí, el chatbot deja de poder
# consultar la base y se queda colgado sin responder.
actualizar_credencial_n8n() {
  local vieja="$1" nueva="$2"
  docker exec yavibot-n8n rm -f /tmp/cred.json >/dev/null 2>&1
  if ! docker exec yavibot-n8n n8n export:credentials --all --decrypted \
         --output=/tmp/cred.json >/dev/null 2>&1; then
    echo "     AVISO: no se pudieron leer las credenciales de n8n."
    return 1
  fi
  docker exec yavibot-n8n sed -i "s#$vieja#$nueva#g" /tmp/cred.json
  docker exec yavibot-n8n n8n import:credentials --input=/tmp/cred.json >/dev/null 2>&1
  # El archivo exportado lleva la contraseña en claro: se borra siempre.
  docker exec yavibot-n8n rm -f /tmp/cred.json >/dev/null 2>&1
  echo "     credencial de PostgreSQL dentro de n8n: actualizada"
}

ARCHIVOS=$(grep -rl "$PASS_VIEJA" n8n/workflows/ docker-compose.yml 2>/dev/null || true)
if [[ -n "$ARCHIVOS" ]]; then
  PASS_NUEVA="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  # docker-compose solo aplica la contraseña al CREAR la base, así que hay
  # que cambiarla también dentro de PostgreSQL.
  if docker exec yavibot-postgres psql -U yavibot -d yavibot \
       -c "ALTER USER yavibot WITH PASSWORD '$PASS_NUEVA';" >/dev/null 2>&1; then
    echo "$ARCHIVOS" | xargs sed -i "s#$PASS_VIEJA#$PASS_NUEVA#g"
    echo "3/4  Contraseña BD   -> cambiada"
    { echo "Contraseña PostgreSQL:    $PASS_NUEVA"; } >> "$CREDENCIALES"
    actualizar_credencial_n8n "$PASS_VIEJA" "$PASS_NUEVA"
  else
    echo "3/4  Contraseña BD   -> ERROR: no se pudo cambiar en PostgreSQL."
    echo "     Los archivos NO se tocaron, para no dejarlos descuadrados."
    echo "     Revisa que el contenedor esté arriba:  docker compose ps"
  fi
else
  echo "3/4  Contraseña BD   -> ya estaba cambiada"
fi

# --- 4) Reimportar los workflows en n8n -------------------------------
# n8n guarda los workflows en su volumen; hay que volver a cargarlos
# conservando el id que ya tienen, o se duplicarían.
echo "4/4  Reimportando los workflows en n8n…"

docker exec yavibot-n8n rm -f /tmp/actuales.json >/dev/null 2>&1
if ! docker exec yavibot-n8n n8n export:workflow --all --output=/tmp/actuales.json >/dev/null 2>&1; then
  echo "     ERROR: no se pudieron exportar los workflows. ¿Está n8n arriba?"
  exit 1
fi
docker cp yavibot-n8n:/tmp/actuales.json /tmp/actuales.json >/dev/null

rm -rf /tmp/yavibot-import && mkdir -p /tmp/yavibot-import
python3 - "$RAIZ" <<'PY'
import json, os, sys, glob
raiz = sys.argv[1]
ids = {w['name']: w['id'] for w in json.load(open('/tmp/actuales.json', encoding='utf-8'))}
n = 0
for ruta in sorted(glob.glob(os.path.join(raiz, 'n8n', 'workflows', '*.json'))):
    wf = json.load(open(ruta, encoding='utf-8'))
    if wf.get('name') not in ids:
        print('     aviso: no está en n8n ->', wf.get('name')); continue
    wf['id'] = ids[wf['name']]
    json.dump(wf, open(os.path.join('/tmp/yavibot-import', os.path.basename(ruta)), 'w',
                       encoding='utf-8'), ensure_ascii=False)
    n += 1
print('     preparados:', n)
PY

docker exec yavibot-n8n rm -rf /tmp/yavibot-import >/dev/null 2>&1
docker cp /tmp/yavibot-import yavibot-n8n:/tmp/yavibot-import >/dev/null
docker exec yavibot-n8n n8n import:workflow --separate --input=/tmp/yavibot-import 2>&1 | tail -2

# Al importar quedan desactivados: hay que volver a activarlos.
docker exec yavibot-n8n n8n export:workflow --all --output=/tmp/actuales.json >/dev/null 2>&1
docker cp yavibot-n8n:/tmp/actuales.json /tmp/actuales.json >/dev/null
for id in $(python3 -c "import json;print(' '.join(w['id'] for w in json.load(open('/tmp/actuales.json',encoding='utf-8'))))"); do
  docker exec yavibot-n8n n8n update:workflow --id="$id" --active=true >/dev/null 2>&1
done

# Reiniciar para que n8n registre los webhooks con el código nuevo.
docker compose up -d --force-recreate >/dev/null 2>&1

echo "     esperando a que n8n levante…"
for _ in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:5678/healthz && break
  sleep 5
done
sleep 10

ACTIVOS=$(docker logs yavibot-n8n 2>&1 | grep -c "Activated workflow")

echo
echo "===================== LISTO ====================="
echo "Workflows activos:   $ACTIVOS   (deben ser 17)"
echo "Dirección pública:   http://$BASE"
if [[ -f "$CREDENCIALES" ]]; then
  echo
  echo "Credenciales nuevas guardadas en:"
  echo "  $CREDENCIALES"
  echo "Cópialas a un lugar seguro y luego borra ese archivo."
fi
echo
echo "Copia de los archivos originales: $RESPALDO"
echo "================================================="
