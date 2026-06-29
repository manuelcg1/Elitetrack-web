#!/bin/bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Script de actualización de EliteTrack en producción
# Uso: ./deploy.sh [frontend|backend|all]
# ─────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="/home/elitetrack/traccar"
WEB_DIR="$PROJECT_DIR/web"
DIST_DIR="/var/www/elitetrack"
JAR_DIR="/opt/traccar"

# ── Archivos de producción que NUNCA deben sobreescribirse ────
# Solo archivos dentro del repo — los de /etc/ y /opt/ ya están
# fuera del repo y git nunca los toca
PROTECTED_FILES=(
    "traccar.xml"           # credenciales BD producción
    "debug.xml"             # config arranque local
    "web/.env"              # variables entorno frontend
    "web/.env.production"   # variables entorno producción
)

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓] $1${NC}"; }
warn()  { echo -e "${YELLOW}[!] $1${NC}"; }
error() { echo -e "${RED}[✗] $1${NC}"; exit 1; }
info()  { echo -e "${BLUE}[→] $1${NC}"; }

DEPLOY_TARGET=${1:-all}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EliteTrack Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Target: $DEPLOY_TARGET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Proteger archivos de producción ──────────────────────────
protect_configs() {
    info "Protegiendo archivos de configuración..."
    for file in "${PROTECTED_FILES[@]}"; do
        filepath="$PROJECT_DIR/$file"
        backup="/tmp/elitetrack_bak_$(echo $file | tr '/' '_')"
        if [ -f "$filepath" ]; then
            cp "$filepath" "$backup"
            warn "Backup: $file → $backup"
        fi
    done
}

# ── Restaurar archivos protegidos ─────────────────────────────
restore_configs() {
    info "Restaurando archivos de configuración de producción..."
    for file in "${PROTECTED_FILES[@]}"; do
        filepath="$PROJECT_DIR/$file"
        backup="/tmp/elitetrack_bak_$(echo $file | tr '/' '_')"
        if [ -f "$backup" ]; then
            cp "$backup" "$filepath"
            rm "$backup"
            log "Restaurado: $file"
        fi
    done
}

# ── Git pull con protección ───────────────────────────────────
pull_changes() {
    info "Obteniendo últimos cambios de GitHub..."
    cd "$PROJECT_DIR"
    protect_configs
    git pull origin main || { restore_configs; error "Falló git pull — configuración restaurada"; }
    restore_configs
    log "Código actualizado desde GitHub"
}

# ── Deploy Frontend ───────────────────────────────────────────
deploy_frontend() {
    info "Iniciando deploy del frontend..."
    cd "$WEB_DIR"

    # npm install solo si package.json o package-lock.json cambiaron
    if git diff HEAD@{1} --name-only 2>/dev/null | grep -qE "package(-lock)?\.json"; then
        warn "Dependencias cambiaron — ejecutando npm install..."
        npm install
    else
        info "Sin cambios en dependencias — omitiendo npm install"
    fi

    npm run build || error "Falló npm run build"

    info "Copiando build a Nginx..."
    sudo rm -rf "$DIST_DIR"/*
    sudo cp -r build/* "$DIST_DIR/"
    sudo chown -R www-data:www-data "$DIST_DIR"
    log "Frontend desplegado correctamente"
}

# ── Deploy Backend ────────────────────────────────────────────
deploy_backend() {
    info "Iniciando deploy del backend Java..."
    cd "$PROJECT_DIR"

    ./gradlew clean jar || error "Falló ./gradlew jar"

    info "Actualizando JAR en producción..."
    sudo cp target/tracker-server.jar "$JAR_DIR/"

    info "Reiniciando servicio Traccar..."
    sudo systemctl restart traccar
    sleep 5

    if sudo systemctl is-active --quiet traccar; then
        log "Traccar reiniciado correctamente"
    else
        error "Traccar no arrancó — revisa: sudo journalctl -u traccar -n 50"
    fi
}

# ── Verificación final ────────────────────────────────────────
verify_services() {
    info "Verificando servicios..."
    sudo systemctl is-active --quiet traccar    && log "Traccar: activo" || warn "Traccar: inactivo"
    sudo systemctl is-active --quiet nginx      && log "Nginx: activo"   || warn "Nginx: inactivo"
    sudo systemctl is-active --quiet postgresql && log "PostgreSQL: activo" || warn "PostgreSQL: inactivo"
}

# ── Ejecutar ──────────────────────────────────────────────────
pull_changes

case $DEPLOY_TARGET in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    all)
        deploy_frontend
        deploy_backend
        ;;
    *)
        error "Uso: ./deploy.sh [frontend|backend|all]"
        ;;
esac

verify_services

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Deploy completado — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
