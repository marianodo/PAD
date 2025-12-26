# P.A.D. - Participación Activa Digital

Plataforma de participación ciudadana digital para captura de preferencias en el momento del pago de tributos.

## 📋 Descripción

Sistema que permite a los ciudadanos expresar sus preferencias sobre la inversión de recursos públicos mediante encuestas digitales, con un sistema de puntos que incentiva la participación.

### Características Principales

- ✅ **Encuestas multi-tipo**: Selección única/múltiple, distribución porcentual, rating, texto abierto
- ✅ **Sistema de puntos**: Recompensas por participación (no canjeables automáticamente, definidos por el cliente)
- ✅ **Prevención de duplicados**: Límite de 1 respuesta por encuesta cada 30 días
- ✅ **Responsive**: Optimizado para móviles y desktop
- ✅ **API REST completa**: Documentación automática con Swagger
- ✅ **TypeScript end-to-end**: Type-safety en frontend y validación en backend

## 🏗️ Estructura del Proyecto

```
PAD/
├── backend/          # FastAPI + PostgreSQL
│   ├── app/
│   │   ├── api/          # Endpoints
│   │   ├── models/       # Modelos SQLAlchemy
│   │   ├── schemas/      # Schemas Pydantic
│   │   ├── services/     # Lógica de negocio
│   │   └── core/         # Configuración
│   └── scripts/      # Scripts de setup
├── frontend/         # Next.js 14 + TypeScript
│   ├── app/             # App Router
│   ├── components/      # Componentes React
│   ├── lib/            # Utilidades y API client
│   └── types/          # TypeScript types
└── docs/            # Documentación

```

## 🚀 Stack Tecnológico

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **API Client**: Axios

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **ORM**: SQLAlchemy
- **Validation**: Pydantic
- **Database**: PostgreSQL 15+ con PostGIS

### Deployment
- **Frontend**: Vercel
- **Backend + DB**: Railway
- **CI/CD**: GitHub Actions (próximamente)

## 📦 Quick Start

Ver guía completa en [SETUP.md](./SETUP.md)

### 1. Backend (Local)

```bash
cd backend

# Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# PostgreSQL con Docker
docker run --name pad-postgres \
  -e POSTGRES_USER=pad_user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pad_db \
  -p 5432:5432 \
  -d postgis/postgis:15-3.3

# Configurar .env
cp .env.example .env

# Iniciar servidor
uvicorn app.main:app --reload
```

API: http://localhost:8000
Docs: http://localhost:8000/api/v1/docs

### 2. Crear Encuesta de Ejemplo

```bash
python -m scripts.create_sample_survey
```

### 3. Frontend (Local)

```bash
cd frontend

# Setup
npm install
cp .env.local.example .env.local

# Iniciar
npm run dev
```

Frontend: http://localhost:3000

## 🎯 Tipos de Preguntas Soportados

1. **Single Choice**: Selección única entre opciones
2. **Multiple Choice**: Selección múltiple
3. **Percentage Distribution**: Distribución que debe sumar 100%
4. **Rating**: Calificación con estrellas (1-5)
5. **Open Text**: Respuesta abierta

## 📊 Modelo de Datos

### Sistema de Puntos
- **Puntos por pregunta**: Configurable (default: 10 puntos)
- **Bonus por completar**: Configurable (default: 50 puntos)
- **Tracking**: Puntos totales, disponibles y canjeados
- **Restricción**: 1 respuesta por encuesta cada 30 días

### Estructura Principal
```
users → survey_responses → answers
  └→ user_points → point_transactions

surveys → questions → question_options
```

## 🌐 API Endpoints

### Users
- `POST /api/v1/users` - Crear usuario
- `GET /api/v1/users/{user_id}` - Obtener usuario
- `GET /api/v1/users/{user_id}/points` - Obtener puntos

### Surveys
- `GET /api/v1/surveys/active` - Encuesta activa
- `POST /api/v1/surveys` - Crear encuesta (Admin)
- `POST /api/v1/surveys/responses` - Enviar respuesta
- `GET /api/v1/surveys/can-respond/{survey_id}/{user_id}` - Verificar elegibilidad

## 🚢 Deployment

### Railway (Backend + PostgreSQL)

1. Crear proyecto en Railway
2. Agregar PostgreSQL
3. Conectar repo GitHub (carpeta `backend`)
4. Configurar variables de entorno
5. Deploy automático ✅

### Vercel (Frontend)

1. Importar proyecto desde GitHub
2. Root directory: `frontend`
3. Framework: Next.js
4. Variable: `NEXT_PUBLIC_API_URL`
5. Deploy automático ✅

Ver detalles en [SETUP.md](./SETUP.md)

## 📖 Documentación

- [ARQUITECTURA.md](./ARQUITECTURA.md) - Arquitectura completa del sistema
- [SETUP.md](./SETUP.md) - Guía de instalación y deployment
- [backend/README.md](./backend/README.md) - Documentación del backend
- [frontend/README.md](./frontend/README.md) - Documentación del frontend

## 🗂️ Roadmap

### ✅ Fase 1: MVP (Completada)
- [x] Backend FastAPI
- [x] Frontend Next.js
- [x] Sistema de encuestas
- [x] Sistema de puntos
- [x] Validaciones y reglas de negocio

### 🔄 Fase 2: Dashboard y Analytics (Próximamente)
- [ ] Dashboard administrativo
- [ ] Visualizaciones con gráficos
- [ ] Mapas georreferenciados
- [ ] Exportación de datos

### 🔮 Fase 3: IA y Reportes (Futuro)
- [ ] Integración con OpenAI/Claude
- [ ] Generación de reportes personalizados
- [ ] Insights automáticos
- [ ] Análisis predictivo

### 🔌 Fase 4: Integraciones (Futuro)
- [ ] Integración con sistemas de pago
- [ ] API pública para terceros
- [ ] Webhooks
- [ ] Sistema de notificaciones

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto es propiedad de Nameless.

## 📧 Contacto

Para consultas sobre el proyecto, contactar al equipo de desarrollo.
