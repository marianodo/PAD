# PAD Backend - FastAPI

API backend para la plataforma P.A.D. (Participación Activa Digital)

## Setup Local

1. Crear entorno virtual:
```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. Iniciar PostgreSQL local (con Docker):
```bash
docker run --name pad-postgres \
  -e POSTGRES_USER=pad_user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pad_db \
  -p 5432:5432 \
  -d postgis/postgis:15-3.3
```

5. Iniciar servidor:
```bash
uvicorn app.main:app --reload
```

La API estará disponible en: http://localhost:8000

Documentación interactiva: http://localhost:8000/api/v1/docs

## Estructura

```
backend/
├── app/
│   ├── api/
│   │   └── endpoints/      # Endpoints de la API
│   ├── core/              # Configuración
│   ├── db/                # Database setup
│   ├── models/            # Modelos SQLAlchemy
│   ├── schemas/           # Schemas Pydantic
│   └── services/          # Lógica de negocio
├── requirements.txt
└── .env
```

## Deploy en Railway

1. Crear nuevo proyecto en Railway
2. Agregar PostgreSQL database
3. Conectar repositorio GitHub
4. Railway detectará automáticamente Python y usará el Procfile
5. Configurar variables de entorno en Railway:
   - `DATABASE_URL` (auto-generada por Railway)
   - `SECRET_KEY`
   - `BACKEND_CORS_ORIGINS`

## API Endpoints

### Users
- `POST /api/v1/users` - Crear usuario
- `GET /api/v1/users/{user_id}` - Obtener usuario
- `GET /api/v1/users/email/{email}` - Obtener usuario por email
- `PATCH /api/v1/users/{user_id}` - Actualizar usuario
- `GET /api/v1/users/{user_id}/points` - Obtener puntos

### Surveys
- `GET /api/v1/surveys/active` - Obtener encuesta activa
- `GET /api/v1/surveys/{survey_id}` - Obtener encuesta
- `POST /api/v1/surveys` - Crear encuesta (Admin)
- `POST /api/v1/surveys/responses` - Enviar respuesta
- `GET /api/v1/surveys/can-respond/{survey_id}/{user_id}` - Verificar si puede responder

## Modelos de Datos

### Tipos de Preguntas
- `multiple_choice` - Selección múltiple
- `single_choice` - Selección única
- `percentage_distribution` - Distribución porcentual (suma 100%)
- `rating` - Calificación 1-5 estrellas
- `open_text` - Texto abierto

### Sistema de Puntos
- Puntos por pregunta respondida (configurable, default: 10)
- Puntos bonus por completar encuesta (configurable, default: 50)
- No se puede responder la misma encuesta más de 1 vez al mes
