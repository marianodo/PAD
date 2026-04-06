#!/bin/bash

# Script para levantar el entorno de desarrollo completo de PAD
# Autor: Claude
# Uso: ./start-dev.sh

set -e

echo "🚀 Iniciando entorno de desarrollo de P.A.D."
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directorio base del proyecto
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo ""
echo "📁 Directorio del proyecto: $PROJECT_DIR"
echo ""

# Función para verificar si un puerto está en uso
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Puerto $1 ya está en uso${NC}"
        return 0
    else
        return 1
    fi
}

# Función para esperar que un servicio esté listo
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0

    echo "⏳ Esperando que $service_name esté listo..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name está listo${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    echo -e "${RED}❌ $service_name no respondió después de $max_attempts segundos${NC}"
    return 1
}

# 1. Verificar base de datos
echo "1️⃣  Verificando base de datos..."
# La BD es Railway (remota) — no se necesita PostgreSQL local
DB_URL=$(cd "$BACKEND_DIR" && grep -E "^DATABASE_URL" .env 2>/dev/null | head -1 || true)
if echo "$DB_URL" | grep -q "railway\|postgresql://"; then
    echo -e "${GREEN}✅ Base de datos remota (Railway) configurada${NC}"
else
    echo -e "${YELLOW}⚠️  Verificá que .env tenga DATABASE_URL apuntando a Railway${NC}"
fi

# 2. Verificar Redis (opcional, si lo usás)
echo ""
echo "2️⃣  Verificando Redis..."
if command -v redis-cli &> /dev/null; then
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "   📦 Iniciando Redis..."
        brew services start redis
        sleep 2
    fi
    echo -e "${GREEN}✅ Redis está corriendo${NC}"
else
    echo -e "${YELLOW}⚠️  Redis no está instalado (opcional)${NC}"
fi

# 3. Backend
echo ""
echo "3️⃣  Iniciando Backend (FastAPI)..."
cd "$BACKEND_DIR"

# Verificar virtual environment
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment no existe${NC}"
    echo "   Creando virtual environment..."
    python3 -m venv venv
fi

# Activar virtual environment e instalar dependencias
source venv/bin/activate
echo "   📦 Instalando/actualizando dependencias..."
pip install -q -r requirements.txt

# Verificar puerto 8000
if check_port 8000; then
    echo -e "${YELLOW}   Matando proceso en puerto 8000...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Iniciar backend en background
echo "   🚀 Iniciando servidor FastAPI en http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/pad-backend.log 2>&1 &
BACKEND_PID=$!
echo "   PID del backend: $BACKEND_PID"

# Esperar que el backend esté listo
wait_for_service "http://localhost:8000" "Backend"

# 4. Frontend
echo ""
echo "4️⃣  Iniciando Frontend (Next.js)..."
cd "$FRONTEND_DIR"

# Instalar dependencias si es necesario
if [ ! -d "node_modules" ]; then
    echo "   📦 Instalando dependencias de npm..."
    npm install
fi

# Verificar puerto 3000
if check_port 3000; then
    echo -e "${YELLOW}   Matando proceso en puerto 3000...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Iniciar frontend en background
echo "   🚀 Iniciando servidor Next.js en http://localhost:3000"
npm run dev > /tmp/pad-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   PID del frontend: $FRONTEND_PID"

# Esperar que el frontend esté listo
wait_for_service "http://localhost:3000" "Frontend"

# Resumen
echo ""
echo "=============================================="
echo -e "${GREEN}✅ ¡Entorno de desarrollo iniciado correctamente!${NC}"
echo "=============================================="
echo ""
echo "📌 Servicios corriendo:"
echo "   🔹 Backend:  http://localhost:8000"
echo "   🔹 API Docs: http://localhost:8000/api/v1/docs"
echo "   🔹 Frontend: http://localhost:3000"
echo ""
echo "📋 PIDs de los procesos:"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/pad-backend.log"
echo "   Frontend: tail -f /tmp/pad-frontend.log"
echo ""
echo "🛑 Para detener todos los servicios:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   O ejecutá: ./stop-dev.sh"
echo ""
echo "💡 Presioná Ctrl+C para detener este script (los servicios seguirán corriendo en background)"
echo ""

# Guardar PIDs para el script de stop
echo "$BACKEND_PID" > /tmp/pad-backend.pid
echo "$FRONTEND_PID" > /tmp/pad-frontend.pid

# Mantener el script corriendo y mostrar logs
echo "📊 Mostrando logs en tiempo real (Ctrl+C para salir)..."
echo ""
tail -f /tmp/pad-backend.log /tmp/pad-frontend.log

