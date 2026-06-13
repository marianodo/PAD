# Entornos — P.A.D.

Tres entornos en Railway, uno por rama. Cada entorno tiene su propio backend, frontend y PostgreSQL, **aislados** entre sí (datos y variables independientes).

| Entorno      | Rama       | Propósito              | Datos                          |
|--------------|------------|------------------------|--------------------------------|
| **develop**  | `develop`  | Desarrollo / pruebas   | Datos de prueba (sucio, libre) |
| **staging**  | `staging`  | Testing / QA           | Datos de QA (reproducibles)    |
| **production** | `main`   | Cliente (producción)   | Datos reales (limpio)          |

Cada entorno deploya automáticamente al hacer merge en su rama.

## URLs

> Completar con las URLs reales de cada servicio en Railway.

| Servicio | develop                                       | staging | production |
|----------|-----------------------------------------------|---------|------------|
| Frontend | _(pendiente)_                                 | _(pendiente)_ | _(pendiente)_ |
| Backend  | https://backend-develop-cbbc.up.railway.app   | _(pendiente)_ | _(pendiente)_ |
| DB       | interna                                        | interna | interna |

## Variables de entorno

### Backend (FastAPI)

| Variable               | Descripción                                  | Distinta por entorno |
|------------------------|----------------------------------------------|:--------------------:|
| `DATABASE_URL`         | Postgres del entorno (`${{Postgres.DATABASE_URL}}`) | ✅ |
| `SECRET_KEY`           | Clave JWT — **única por entorno**            | ✅ |
| `BACKEND_CORS_ORIGINS` | JSON array con la URL del frontend del entorno | ✅ |
| `ANTHROPIC_API_KEY`    | API key de Claude                            | puede compartirse |
| `CLAUDE_MODEL`         | Modelo (default en código)                   | no |
| `DEBUG`                | `False` en staging/production                | ✅ |
| `API_V1_PREFIX`        | `/api/v1`                                     | no |

Referencia completa de defaults: [backend/.env.example](../backend/.env.example) y `backend/app/core/config.py`.

### Frontend (Next.js)

| Variable                          | Descripción                                  | Distinta por entorno |
|-----------------------------------|----------------------------------------------|:--------------------:|
| `NEXT_PUBLIC_API_URL`             | URL del **backend de ese entorno**           | ✅ |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | API key de Google Maps                       | puede compartirse |

> `NEXT_PUBLIC_*` se hornea en **build time**: si cambia, hay que rebuildear el frontend de ese entorno.
> Estas variables se setean en Railway (panel del servicio), no en archivos commiteados.

## Generar un `SECRET_KEY`

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Notas

- La **DB de producción arranca limpia**: solo se siembra admin + cliente con los scripts de `backend/scripts/`.
- La DB de **develop** conserva los datos de prueba históricos.
- Pasos detallados de configuración en Railway: ver [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## Portabilidad a futuro (AWS)

El stack es portable; el día que se migre desde Railway, el mapeo natural es:

| Hoy (Railway)        | Mañana (AWS)                                  |
|----------------------|-----------------------------------------------|
| Backend (uvicorn/`Procfile`) | ECS Fargate o App Runner (contenedor)  |
| Frontend (`next build/start`) | Amplify Hosting, o S3 + CloudFront (export) |
| PostgreSQL           | RDS for PostgreSQL (+ PostGIS)                |
| Variables de entorno | SSM Parameter Store / Secrets Manager         |
| Branch-per-env       | Una cuenta/stack por entorno, o stages en IaC |

Para facilitar esa migración: mantener el backend ejecutable como contenedor (un `Dockerfile` ayudaría), y las variables fuera del código (ya es el caso).
