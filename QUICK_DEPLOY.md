# 🚀 Quick Deploy - P.A.D. en Railway

Guía rápida para deployar P.A.D. en Railway en menos de 10 minutos.

## Pre-requisitos

1. ✅ Cuenta en [Railway.app](https://railway.app)
2. ✅ Repositorio Git con el código
3. ✅ Railway CLI (opcional): `npm install -g @railway/cli`

## Paso 1: Crear Proyecto en Railway

1. Ve a https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio de P.A.D.

## Paso 2: Agregar PostgreSQL

1. En el proyecto, click "+ New" → "Database" → "PostgreSQL"
2. Railway creará automáticamente la base de datos
3. ✅ Anota la variable `DATABASE_URL`

## Paso 3: Deployar Backend

1. En el proyecto, click "+ New" → "GitHub Repo"
2. Selecciona el repo, configura:
   - **Root Directory**: `backend`
   - **Name**: `PAD-Backend`

3. **Variables de Entorno** (Settings → Variables):
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
API_V1_PREFIX=/api/v1
PROJECT_NAME=PAD API
DEBUG=False
SECRET_KEY=<generar-con-comando-abajo>
BACKEND_CORS_ORIGINS=["https://tu-frontend.railway.app"]
```

**Generar SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

4. Espera a que se complete el deploy
5. ✅ Anota la URL del backend

## Paso 4: Ejecutar Migraciones

Conéctate al backend via Railway CLI:

```bash
railway login
railway link  # Selecciona tu proyecto
railway run -s PAD-Backend python scripts/migrate_separate_tables.py
railway run -s PAD-Backend python scripts/create_admin_user.py  
railway run -s PAD-Backend python scripts/create_client_user.py
railway run -s PAD-Backend python scripts/add_is_active_to_surveys.py
```

## Paso 5: Deployar Frontend

1. En el proyecto, click "+ New" → "GitHub Repo"
2. Selecciona el repo, configura:
   - **Root Directory**: `frontend`
   - **Name**: `PAD-Frontend`

3. **Variables de Entorno**:
```env
NEXT_PUBLIC_API_URL=https://tu-backend.railway.app
```

4. ✅ Anota la URL del frontend

## Paso 6: Actualizar CORS

1. Ve al servicio Backend
2. Actualiza `BACKEND_CORS_ORIGINS` con la URL del frontend:
```env
BACKEND_CORS_ORIGINS=["https://pad-frontend-production.railway.app"]
```

## 🎉 ¡Listo!

Tu aplicación está deployada en:
- **Frontend**: https://pad-frontend-production.railway.app
- **Backend API**: https://pad-backend-production.railway.app
- **Docs API**: https://pad-backend-production.railway.app/api/v1/docs

## Credenciales de Acceso

### Admin
- Email: `mardom4164@gmail.com`
- Password: `admin123`
- URL: https://tu-frontend.railway.app/auth/admin-login

### Cliente
- Email: `muni.altagracia@gmail.com`
- Password: `muni123`
- URL: https://tu-frontend.railway.app/auth/admin-login

### Usuario Regular
- Crear desde: https://tu-frontend.railway.app/auth/login

## Troubleshooting Rápido

### ❌ Error 500 en Backend
```bash
railway logs -s PAD-Backend
```
Verifica que `DATABASE_URL` esté correctamente configurada.

### ❌ Error CORS en Frontend
Asegúrate de que `BACKEND_CORS_ORIGINS` incluya la URL exacta del frontend (sin trailing slash).

### ❌ Frontend no conecta al Backend
Verifica que `NEXT_PUBLIC_API_URL` sea la URL correcta del backend.

## Comandos Útiles

```bash
# Ver logs en tiempo real
railway logs -s PAD-Backend
railway logs -s PAD-Frontend

# Redeploy
railway up -s PAD-Backend
railway up -s PAD-Frontend

# Ver variables
railway variables -s PAD-Backend

# Ejecutar comando
railway run -s PAD-Backend <comando>
```

## Costos

- **Gratis**: $5 USD de crédito mensual
- Incluye: PostgreSQL, 2 servicios web
- Pago por uso después del crédito gratuito

## Siguiente Paso: Dominio Personalizado

1. Ve a Settings → Domains en cada servicio
2. Genera dominio `.railway.app` gratis
3. O conecta tu propio dominio

---

**¿Problemas?** Revisa [DEPLOYMENT.md](./DEPLOYMENT.md) para la guía completa.
