#!/bin/bash

# Script para ver el estado del entorno de desarrollo de PAD
# Uso: ./status-dev.sh

echo "📊 Estado del entorno de desarrollo de P.A.D."
echo "=============================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Función para verificar servicio
check_service() {
    local port=$1
    local name=$2
    local url=$3

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        local pid=$(lsof -ti:$port)
        echo -e "${GREEN}✅ $name está corriendo${NC}"
        echo "   Puerto: $port | PID: $pid"
        if [ -n "$url" ]; then
            echo "   URL: $url"
        fi
        return 0
    else
        echo -e "${RED}❌ $name NO está corriendo${NC}"
        echo "   Puerto: $port"
        return 1
    fi
}

echo ""
echo "🔌 Servicios:"
echo ""

# Backend
check_service 8000 "Backend (FastAPI)" "http://localhost:8000"
echo ""

# Frontend
check_service 3000 "Frontend (Next.js)" "http://localhost:3000"
echo ""

# PostgreSQL
echo -n "🗄️  PostgreSQL: "
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Corriendo${NC}"
else
    echo -e "${RED}❌ No está corriendo${NC}"
fi

# Redis
echo -n "📦 Redis: "
if command -v redis-cli &> /dev/null && redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Corriendo${NC}"
else
    echo -e "${YELLOW}⚠️  No está corriendo o no instalado${NC}"
fi

echo ""
echo "=============================================="
echo ""

# Mostrar PIDs guardados
if [ -f /tmp/pad-backend.pid ] || [ -f /tmp/pad-frontend.pid ]; then
    echo "📋 PIDs guardados:"
    [ -f /tmp/pad-backend.pid ] && echo "   Backend:  $(cat /tmp/pad-backend.pid)"
    [ -f /tmp/pad-frontend.pid ] && echo "   Frontend: $(cat /tmp/pad-frontend.pid)"
    echo ""
fi

# Comandos útiles
echo "💡 Comandos útiles:"
echo "   Ver logs backend:  tail -f /tmp/pad-backend.log"
echo "   Ver logs frontend: tail -f /tmp/pad-frontend.log"
echo "   Reiniciar todo:    ./stop-dev.sh && ./start-dev.sh"
echo ""
