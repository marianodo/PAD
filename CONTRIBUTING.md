# Guía de contribución — P.A.D.

Cómo trabajamos en este repo: ramas, commits, pull requests y deploy.
Para el detalle de cómo se publica una versión, ver [docs/RELEASING.md](./docs/RELEASING.md).
Para los entornos y sus variables, ver [docs/ENVIRONMENTS.md](./docs/ENVIRONMENTS.md).

---

## Modelo de ramas

Tres ramas de larga vida, cada una conectada a un entorno de Railway:

| Rama       | Entorno     | Propósito                                  |
|------------|-------------|--------------------------------------------|
| `develop`  | develop     | Desarrollo e integración del día a día     |
| `staging`  | staging     | Testing / QA antes de producción           |
| `main`     | production  | Producción (cliente). Solo código probado. |

Flujo de promoción:

```
feature/* , fix/* , chore/*  ──PR──▶  develop   (deploy automático a DEV)
develop                      ──PR──▶  staging   (deploy automático a STAGING/QA)
staging                      ──PR──▶  main       (deploy a PROD + tag vX.Y.Z)
```

> Regla de oro: **nunca** se commitea directo a `main` ni a `staging`. Todo entra por PR.
> `develop` también se trabaja vía PR desde ramas de feature.

### Crear una rama de trabajo

Salí siempre de `develop` actualizado:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/export-excel
```

Prefijos de rama:

| Prefijo     | Para…                                   |
|-------------|-----------------------------------------|
| `feature/`  | nueva funcionalidad                     |
| `fix/`      | corrección de bug                       |
| `chore/`    | mantenimiento, deps, config             |
| `docs/`     | documentación                           |
| `refactor/` | refactors sin cambio de comportamiento  |

Nombre en kebab-case y descriptivo: `feature/redeem-points`, `fix/cors-staging`.

---

## Commits — Conventional Commits

Formato:

```
<tipo>[scope opcional]: <descripción en imperativo>
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `style`, `revert`.

Ejemplos:

```
feat: agregar export de resultados a Excel
fix(redeem): corregir cálculo de puntos disponibles
chore: actualizar dependencias del frontend
docs: documentar proceso de release
```

Por qué importa: habilita changelog y versionado semántico automáticos, y deja un historial legible. El **título del PR** se valida automáticamente contra este formato en el CI.

---

## Pull Requests

1. Pusheá tu rama y abrí un PR. La **base** suele ser `develop`.
2. Completá el [template de PR](./.github/pull_request_template.md).
3. El **título del PR** debe seguir Conventional Commits (el CI lo valida).
4. Esperá a que el **CI** pase en verde:
   - `Backend · pytest` — tests del backend
   - `Frontend · lint + build` — lint + build (incluye type-check)
   - `PR · Conventional Commits` — formato del título
5. Review y merge. Usamos **Squash and merge** para mantener el historial limpio
   (el mensaje del squash debe seguir Conventional Commits).

`main` y `staging` están protegidas: requieren PR y CI en verde para mergear.

---

## Setup local

Requisitos: Python 3.11, Node 20, PostgreSQL (o Docker), y los archivos `.env`.

```bash
# Backend
cd backend
cp .env.example .env            # completar SECRET_KEY, DATABASE_URL, ANTHROPIC_API_KEY
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL + NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
npm install
```

Levantar todo junto desde la raíz:

```bash
./start-dev.sh     # arranca backend + frontend
./status-dev.sh    # estado
./stop-dev.sh      # frenar
```

### Correr lo mismo que el CI antes de pushear

```bash
# Backend
cd backend && pytest -q

# Frontend
cd frontend && npm run lint && npm run build
```

---

## Secretos y variables de entorno

- **Nunca** commitees secretos. Los archivos `.env`, `.env.local` y `.env.production` están en `.gitignore`.
- Para agregar una variable nueva: documentala en el `.example` correspondiente
  (`backend/.env.example`, `frontend/.env.local.example`, `frontend/.env.production.example`)
  y seteala en Railway en **cada entorno** que la necesite.
- Si tu PR agrega/cambia variables, marcalo en el template y avisá para setearlas antes del deploy.
