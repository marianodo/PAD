# Deployment en Railway - P.A.D.

Este documento contiene las instrucciones para deployar la aplicación P.A.D. en Railway.

## Requisitos Previos

1. Cuenta en [Railway](https://railway.app)
2. Railway CLI instalado (opcional): `npm install -g @railway/cli`
3. Código del proyecto en un repositorio Git

## Pasos para el Deployment

### 1. Crear Proyecto en Railway

1. Ve a [Railway Dashboard](https://railway.app/dashboard)
2. Click en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Autoriza Railway para acceder a tu repositorio
5. Selecciona el repositorio de P.A.D.

### 2. Deployar la Base de Datos PostgreSQL

1. En tu proyecto de Railway, click en "+ New"
2. Selecciona "Database" → "PostgreSQL"
3. Railway creará automáticamente la base de datos
4. Anota las credenciales que se generan automáticamente

**Variables de entorno de la base de datos (generadas automáticamente):**
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `DATABASE_URL` (formato completo)

### 3. Deployar el Backend (FastAPI)

1. En tu proyecto, click en "+ New"
2. Selecciona "GitHub Repo"
3. Selecciona el repositorio y en "Root Directory" pon: `backend`
4. Railway detectará automáticamente que es una app Python

**Configurar Variables de Entorno del Backend:**

Ve a la configuración del servicio backend y agrega estas variables:

```env
# Database - Usar la DATABASE_URL del servicio PostgreSQL
DATABASE_URL=${{Postgres.DATABASE_URL}}

# API Configuration
API_V1_PREFIX=/api/v1
PROJECT_NAME=PAD API
DEBUG=False
SECRET_KEY=<generar-una-clave-secreta-segura>

# CORS - Agregar el dominio del frontend cuando esté disponible
BACKEND_CORS_ORIGINS=["https://tu-frontend.railway.app"]

# PostgreSQL (referenciadas automáticamente desde el servicio)
POSTGRES_USER=${{Postgres.PGUSER}}
POSTGRES_PASSWORD=${{Postgres.PGPASSWORD}}
POSTGRES_DB=${{Postgres.PGDATABASE}}
```

**Generar SECRET_KEY segura:**
```python
import secrets
print(secrets.token_urlsafe(32))
```

### 4. Ejecutar Migraciones

Una vez que el backend esté deployado:

1. Ve al servicio backend en Railway
2. Click en "Settings" → "Deploy Triggers"
3. Agrega un "Deploy Command" o conéctate via Railway CLI:

```bash
railway run python backend/scripts/migrate_separate_tables.py
railway run python backend/scripts/create_admin_user.py
railway run python backend/scripts/create_client_user.py
railway run python backend/scripts/add_is_active_to_surveys.py
```

### 5. Deployar el Frontend (Next.js)

1. En tu proyecto, click en "+ New"
2. Selecciona "GitHub Repo"
3. Selecciona el repositorio y en "Root Directory" pon: `frontend`
4. Railway detectará automáticamente que es una app Next.js

**Configurar Variables de Entorno del Frontend:**

```env
# API URL - Usar la URL del backend deployado
NEXT_PUBLIC_API_URL=https://tu-backend.railway.app
```

### 6. Actualizar CORS en el Backend

Una vez que el frontend esté deployado y tengas su URL:

1. Ve a las variables de entorno del backend
2. Actualiza `BACKEND_CORS_ORIGINS`:

```env
BACKEND_CORS_ORIGINS=["https://tu-frontend.railway.app","http://localhost:3000"]
```

3. El backend se redespleará automáticamente

### 7. Configurar Dominios Personalizados (Opcional)

1. En cada servicio, ve a "Settings" → "Domains"
2. Puedes generar un dominio `.railway.app` gratuito
3. O configurar tu propio dominio custom

## Estructura de Servicios en Railway

Tu proyecto debería tener 3 servicios:

```
PAD Project
├── PostgreSQL (Database)
├── Backend (FastAPI - /backend)
└── Frontend (Next.js - /frontend)
```

## URLs Finales

Después del deployment tendrás:

- **Frontend**: `https://pad-frontend.railway.app`
- **Backend API**: `https://pad-backend.railway.app`
- **PostgreSQL**: (interno, solo accesible por los servicios)

## Credenciales Iniciales

### Admin
- Email: `mardom4164@gmail.com`
- Password: `admin123`

### Cliente (Municipalidad de Alta Gracia)
- Email: `muni.altagracia@gmail.com`
- Password: `muni123`

## Monitoreo y Logs

1. Ve a cada servicio en Railway
2. Click en "Deployments" para ver el historial
3. Click en "Logs" para ver logs en tiempo real
4. Railway también provee métricas de uso

## Troubleshooting

### Error de conexión a la base de datos
- Verifica que `DATABASE_URL` esté correctamente referenciada desde el servicio PostgreSQL
- Asegúrate de que el formato sea: `postgresql+psycopg2://user:pass@host:port/db`

### Error de CORS
- Verifica que `BACKEND_CORS_ORIGINS` incluya la URL del frontend
- Asegúrate de que las URLs no tengan trailing slash

### Frontend no puede conectar al backend
- Verifica que `NEXT_PUBLIC_API_URL` tenga la URL correcta del backend
- Asegúrate de que el backend esté deployado y funcionando

## Comandos Útiles con Railway CLI

```bash
# Login
railway login

# Linkear proyecto
railway link

# Ver logs en tiempo real
railway logs

# Ejecutar comando en el servicio
railway run <comando>

# Ver variables de entorno
railway variables

# Redeploy
railway up
```

## Costos

Railway ofrece:
- $5 USD de crédito gratis al mes
- Después se cobra por uso (CPU, RAM, Network)
- PostgreSQL hobby plan incluido en el tier gratuito

## Backup de Base de Datos

```bash
# Exportar
railway run pg_dump $DATABASE_URL > backup.sql

# Importar
railway run psql $DATABASE_URL < backup.sql
```
