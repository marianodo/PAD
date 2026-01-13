#!/bin/bash

# Script para detener el entorno de desarrollo de PAD
# Autor: Claude
# Uso: ./stop-dev.sh

echo "🛑 Deteniendo entorno de desarrollo de P.A.D."
echo "=============================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Función para matar proceso por PID
kill_process() {
    local pid=$1
    local name=$2

    if [ -n "$pid" ] && ps -p $pid > /dev/null 2>&1; then
        echo "   Deteniendo $name (PID: $pid)..."
        kill $pid 2>/dev/null
        sleep 1

        # Si todavía está corriendo, forzar
        if ps -p $pid > /dev/null 2>&1; then
            echo "   Forzando detención de $name..."
            kill -9 $pid 2>/dev/null
        fi
        echo -e "${GREEN}✅ $name detenido${NC}"
    else
        echo -e "${YELLOW}⚠️  $name no está corriendo${NC}"
    fi
}

# Leer PIDs guardados
if [ -f /tmp/pad-backend.pid ]; then
    BACKEND_PID=$(cat /tmp/pad-backend.pid)
    kill_process "$BACKEND_PID" "Backend"
    rm /tmp/pad-backend.pid
fi

if [ -f /tmp/pad-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/pad-frontend.pid)
    kill_process "$FRONTEND_PID" "Frontend"
    rm /tmp/pad-frontend.pid
fi

# Matar cualquier proceso que quede en los puertos
echo ""
echo "🔍 Verificando puertos 3000 y 8000..."

if lsof -ti:8000 > /dev/null 2>&1; then
    echo "   Matando procesos en puerto 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
fi

if lsof -ti:3000 > /dev/null 2>&1; then
    echo "   Matando procesos en puerto 3000..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
fi

echo ""
echo -e "${GREEN}✅ Entorno de desarrollo detenido${NC}"
echo ""
echo "📝 Los logs se mantienen en:"
echo "   /tmp/pad-backend.log"
echo "   /tmp/pad-frontend.log"
echo ""
