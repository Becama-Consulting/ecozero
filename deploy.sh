#!/bin/bash
set -euo pipefail

########################################
# Config
########################################

# Nombre lógico de la app (solo para logs)
APP_NAME="ecocero"

# Carpeta del repo en el VPS (el código fuente)
REPO_DIR="/srv/repos/ecocero"

# Carpeta generada por el build (Vite / React)
DIST_SOURCE="${REPO_DIR}/dist"

# Carpeta que está montada en el contenedor nginx como /usr/share/nginx/html
WEB_ROOT="/home/ubuntu/ecocero/html"

# Carpeta donde está docker-compose.yml
DOCKER_DIR="/home/ubuntu/ecocero"

# Nombre del servicio/contendor que sirve la web
CONTAINER_NAME="ecocero-web"


########################################
# Paso 0: Traer última versión del repo remoto
########################################
echo "🚀 Deploy script iniciado para ${APP_NAME}"
echo "📥 Paso 0/3: actualizando código desde GitHub en ${REPO_DIR}"

# Configurar GIT_SSH_COMMAND para usar la clave de Becama-Consulting
export GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_becama -o IdentitiesOnly=yes"

# Verificar si el directorio existe, si no, clonarlo
if [ ! -d "${REPO_DIR}" ]; then
  echo "📦 El directorio ${REPO_DIR} no existe. Creando estructura..."
  sudo mkdir -p "${REPO_DIR}"
  
  # Si queremos clonar el repo (necesitarás ajustar la URL del repo)
  echo "⚠️  Nota: Debes clonar el repositorio manualmente o proporcionar la URL"
  echo "   Ejemplo: git clone git@github.com:Becama-Consulting/ecocero.git ${REPO_DIR}"
  exit 1
fi

cd "${REPO_DIR}"

# Aseguramos que estamos en main y sincronizados con origin/main
git fetch origin
git reset --hard origin/main
git clean -fd

########################################
# Paso 1: Build del frontend
########################################
echo "🔨 Paso 1/3: build de producción (npm install + npm run build)"

# Nos aseguramos de tener dependencias (por si han cambiado)
npm install

# Cargar variables de entorno desde .env si existe
if [ -f "${REPO_DIR}/.env" ]; then
  echo "📝 Cargando variables de entorno desde .env"
  export $(cat "${REPO_DIR}/.env" | grep -v '^#' | xargs)
fi

# Construimos la carpeta dist/ con las variables de entorno
npm run build

if [ ! -d "${DIST_SOURCE}" ]; then
  echo "❌ No se ha generado la carpeta dist. Revisa el build."
  exit 1
fi

########################################
# Paso 2: Sincronizar estáticos al volumen que usa nginx en Docker
########################################
echo "📂 Paso 2/3: sincronizando dist -> ${WEB_ROOT}"

# Creamos destino por si no existe
sudo mkdir -p "${WEB_ROOT}"

# Sincronizamos archivos generados al directorio que está montado en el contenedor
# --delete: borra lo que ya no existe en dist para que no queden restos viejos
sudo rsync -rlt --delete --progress "${DIST_SOURCE}/" "${WEB_ROOT}/"

# Archivo de salud opcional
echo "ok" | sudo tee "${WEB_ROOT}/health.txt" >/dev/null

# Permisos de lectura correctos
sudo find "${WEB_ROOT}" -type d -exec chmod 755 {} +
sudo find "${WEB_ROOT}" -type f -exec chmod 644 {} +

echo "✅ Archivos sincronizados en ${WEB_ROOT}"

########################################
# Paso 3: Reiniciar el contenedor nginx que sirve la web
########################################
echo "🐳 Paso 3/3: reiniciando contenedor ${CONTAINER_NAME}"

cd "${DOCKER_DIR}"
docker compose restart "${CONTAINER_NAME}"

echo "🏁 Deploy finalizado. Producción actualizada."
