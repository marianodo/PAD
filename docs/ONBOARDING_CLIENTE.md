# Onboarding de un cliente nuevo (municipio)

Runbook paso a paso para dar de alta un municipio en P.A.D. Cubre el alta de datos,
la carga del padrón, la creación de encuestas, el dashboard, el token del proveedor de
pagos y la verificación end-to-end.

> **Regla de oro:** hacé **todo primero en `staging`** (entorno de QA), verificá el flujo
> completo, y recién después repetí los pasos en `production`. Ver [ENVIRONMENTS.md](./ENVIRONMENTS.md).

---

## 1. Conceptos clave (cómo funciona el multi-tenant)

| Entidad | Tabla | Rol |
|---|---|---|
| **Client** | `clients` | El municipio. Tiene email/password para entrar al panel `/client`. |
| **User** | `users` | El ciudadano. Se vincula a un municipio por `client_id`. |
| **ElectoralRoll** | `electoral_roll` | Padrón: CUILs habilitados **por municipio** (`client_id` + `cuil`). |
| **Survey / Question / QuestionOption** | `surveys`, `questions`, `question_options` | La encuesta del municipio (`survey.client_id`). |
| **Provider / ProviderClient** | `providers`, `provider_clients` | El proveedor de pagos y su vínculo (N–N) con municipios. |
| **Points** | `user_points`, `point_transactions` | Puntos del ciudadano (se ganan al responder, se canjean vía proveedor). |

**Cómo se vincula un ciudadano a su municipio:** el endpoint `/auth/register` **no** valida el
padrón ni asigna `client_id`. La vinculación la hace `load_padron.py`: al cargar el padrón corre
un `UPDATE users SET client_id = … WHERE cuil IN (padrón)`. → **Implica un orden** (ver §3 y los
gaps en §10).

---

## 2. Pre-requisitos (pedir al municipio antes de empezar)

- [ ] **Datos institucionales**: nombre, CUIT (sin guiones), ciudad, provincia, dirección, persona de contacto, cargo, teléfono, web.
- [ ] **Padrón electoral en Excel** con el formato esperado por `load_padron.py` (columnas, `C_CUIL` en la **columna 8 / índice 7**: `TIPDOC, MATRIC, APELLIDO, NOMBRE, SEXO, DNI, SEXO, C_CUIL, C_APELLIDO, C_NOMBRE, …`). Si el archivo no respeta ese layout, hay que adaptar el script.
- [ ] **Preguntas de la encuesta** definidas + **configuración de puntos** (puntos por pregunta, bonus por completar, máximo de respuestas por usuario).
- [ ] **Datos del proveedor de pagos** que va a integrar (nombre).
- [ ] **Ciudad/provincia exacta** para los datos geográficos del heatmap (ej: `"Alta Gracia, Córdoba, Argentina"`).
- [ ] **Decisión de dominio/branding** (ver gap §10): ¿usa el `pad-usuarios.datainsights.com.ar` compartido o subdominio propio?

### Helper: ejecutar scripts contra la DB de un entorno

Los scripts del backend usan `settings.DATABASE_URL`. Para correrlos desde tu máquina contra
la DB de un entorno de Railway, usá la URL **pública** de Postgres:

> ⚠️ La base de la app se llama **`pad_db`** en todos los entornos (no el `railway` por
> defecto de Railway). La `DATABASE_PUBLIC_URL` apunta a `railway`, así que hay que cambiar
> el nombre de base a `pad_db` (el `sed` de abajo lo hace).

```bash
# elegí el entorno: develop | staging | production
ENV=staging
export DBURL=$(railway variables -e $ENV -s Postgres --json | jq -r '.DATABASE_PUBLIC_URL' | sed -E 's#/railway$#/pad_db#')

cd backend
# ejemplo:
DATABASE_URL="$DBURL" .venv/bin/python -m scripts.<script> <args>
```

> Alternativa: `railway ssh -e $ENV -s backend` y correr el script dentro del contenedor
> (ahí `DATABASE_URL` interno ya está). Sirve para scripts que **no** necesitan archivos locales;
> para el padrón (Excel local) usá el método de arriba.

---

## 3. Paso a paso

### Paso 1 — Crear el municipio (Client)

> ⚠️ `scripts/create_client_user.py` está **hardcodeado a "Alta Gracia"**. No lo uses tal cual.
> Usá este snippet parametrizable (genera password fuerte y la muestra una sola vez):

```bash
cd backend
DATABASE_URL="$DBURL" .venv/bin/python - <<'PY'
import secrets, string
from app.db.base import get_db
from app.models.client import Client
from app.core.security import get_password_hash

DATA = dict(
    email="muni.ejemplo@gmail.com",
    name="Municipalidad de Ejemplo",
    cuit="30XXXXXXXXX",
    city="Ejemplo", phone="", contact_person="", contact_position="",
    address="", postal_code="", website="", description="",
)
db = next(get_db())
if db.query(Client).filter(Client.email == DATA["email"]).first():
    print("Ya existe un cliente con ese email"); raise SystemExit
pwd = "".join(secrets.choice(string.ascii_letters+string.digits+"!@#$%*-_") for _ in range(20))
c = Client(hashed_password=get_password_hash(pwd), **DATA)
db.add(c); db.commit(); db.refresh(c)
print("CLIENT_ID:", c.id)
print("LOGIN:", DATA["email"], "/", pwd)
PY
```

- 📌 **Guardá el `CLIENT_ID`** → lo necesitás en los pasos 2, 3 y 6.
- Entregá las credenciales al municipio por canal seguro; que cambien la password al primer login.

### Paso 2 — Cargar datos geográficos (barrios + coordenadas) del heatmap

Necesario para el mapa/heatmap del dashboard. La tabla `neighborhoods` alimenta
`GET /neighborhoods/coordinates`.

> ⚠️ `scripts/sync_neighborhoods_table.py` está **hardcodeado** a Alta Gracia
> (constantes `LOCALITY`, `CITY`, `PROVINCE`). Editalas para la ciudad del nuevo cliente
> (o parametrizá el script — ver gap §10) antes de correrlo. Usa OSM (`osmnx`).

```bash
cd backend
# 1) editar LOCALITY/CITY/PROVINCE en scripts/sync_neighborhoods_table.py
DATABASE_URL="$DBURL" .venv/bin/python scripts/sync_neighborhoods_table.py --dry-run   # revisar
DATABASE_URL="$DBURL" .venv/bin/python scripts/sync_neighborhoods_table.py             # aplicar
```

### Paso 3 — Cargar el padrón electoral

```bash
cd backend
DATABASE_URL="$DBURL" .venv/bin/python -m scripts.load_padron "ruta/al/padron.xlsx" <CLIENT_ID>
```

- Inserta los CUILs habilitados en `electoral_roll` para ese `client_id` (idempotente: saltea duplicados).
- **Además vincula** a los usuarios ya registrados cuyo CUIL esté en el padrón (`users.client_id`).
- ⚠️ Los ciudadanos que se registren **después** de esta carga quedan con `client_id = NULL` hasta
  que se vuelva a correr el padrón. Planificar re-cargas o ver gap §10.

### Paso 4 — Crear la encuesta y sus preguntas

Opciones:
- **Panel** (recomendado): el municipio (o el admin) crea la encuesta desde la UI (`/client` / `/admin`).
- **API**: `POST /api/v1/surveys/` con `SurveyCreate` (incluye `client_id`, `points_per_question`,
  `bonus_points`, `max_responses_per_user`, y la lista de `questions` con sus `options`).
- **Script de referencia**: `scripts/create_sample_survey.py` muestra cómo armar una encuesta por código.

Tipos de pregunta soportados: `single_choice`, `multiple_choice`, `percentage_distribution`
(suma 100%), `rating` (config `{"min":1,"max":5}`), `open_text`.

> Definí los **puntos** acá (campos del `Survey`). Es la config que después consulta/canjea el proveedor.
> Asegurate de setear `survey.client_id` al municipio correcto y `is_active = true` cuando esté lista.

### Paso 5 — Dashboard / reporte de resultados

- **Dashboard dinámico (automático)**: `/client/results/[surveyId]` ya muestra resultados,
  segmentaciones y heatmap a partir de `GET /surveys/{id}/results` y `/segments`. No requiere
  trabajo extra salvo tener cargados los barrios (paso 2) para el mapa.
- **Reporte custom (opcional)**: páginas tipo `frontend/app/reports/<ciudad>/<año>` (ej:
  `reports/alta-gracia/2026`) son reportes a medida → **es tarea de desarrollo** (PR contra `develop`).
  Usalo solo si el cliente pide un informe presentable y curado.

### Paso 6 — Crear el token del proveedor (integración de puntos)

El **proveedor** es el sistema de pagos del municipio: consulta los puntos del ciudadano y
nos informa los canjes (descuentos en el pago de tributos). Usa una **API key** (`X-API-Key`).

```bash
cd backend
DATABASE_URL="$DBURL" .venv/bin/python -m scripts.create_provider
# interactivo: nombre del proveedor → seleccionar el/los municipios a vincular
# imprime la API KEY UNA SOLA VEZ → guardarla y entregarla al proveedor por canal seguro
```

Endpoints que usará el proveedor (header `X-API-Key: <key>`):
- `GET  /api/v1/integration/points/{cuil}` — consultar puntos de un contribuyente.
- `POST /api/v1/integration/points/redeem` — informar canje (idempotente por `reference_id`).

Solo puede operar sobre CUILs de municipios vinculados a ese proveedor. Detalle y ejemplos en
[integracion-api.md](./integracion-api.md).

---

## 4. Verificación end-to-end (QA en staging antes de prod)

- [ ] **Ciudadano de prueba**: registrar un usuario con un **CUIL que esté en el padrón** → al recargar
      el padrón debe quedar con `client_id` del municipio.
- [ ] **Responder la encuesta** → se otorgan puntos (revisar `user_points`).
- [ ] **Dashboard**: loguear como el cliente (`/client`) y ver resultados + heatmap del survey.
- [ ] **Proveedor**: `curl -H "X-API-Key: <key>" https://<backend>/api/v1/integration/points/<cuil>` → 200 con puntos.
- [ ] **Canje**: `POST /integration/points/redeem` con un `reference_id` → descuenta `available_points`; repetir el mismo `reference_id` → `already_processed: true`.
- [ ] Revisar `integration_audit_log` (queda registro de cada request del proveedor).

---

## 5. Checklist resumen del alta

```
[ ] 0. Hacer todo en STAGING primero
[ ] 1. Crear Client (guardar CLIENT_ID + credenciales)
[ ] 2. Cargar barrios+coordenadas (editar ciudad en sync_neighborhoods_table.py)
[ ] 3. Cargar padrón electoral (load_padron + vincula usuarios)
[ ] 4. Crear encuesta + preguntas + puntos (panel/API)
[ ] 5. Verificar dashboard dinámico (y reporte custom si aplica)
[ ] 6. Crear provider + API key (entregar al proveedor)
[ ] 7. Verificación end-to-end (QA)
[ ] 8. Repetir en PRODUCTION + entregar credenciales y doc de integración
[ ] 9. Capacitar al municipio en el panel /client
```

---

## 6. Gaps y decisiones pendientes (revisar antes del 2º cliente)

Cosas que hoy funcionan para **un** cliente pero requieren atención al escalar a varios:

1. **`GET /surveys/active` es global** (`get_active_survey` hace `.first()` sin filtrar por cliente).
   Con dos municipios con encuesta activa simultánea, devuelve una arbitraria. → Hay que **scopear la
   encuesta activa por municipio** (cómo sabe el ciudadano a qué ciudad pertenece: subdominio, selección,
   o por `client_id` del padrón). Es el gap más importante.
2. **Sin enforcement de padrón en el registro/voto**: `/auth/register` no valida que el CUIL esté en el
   padrón; un CUIL fuera del padrón puede registrarse (queda sin `client_id`). El voto tampoco valida
   pertenencia al municipio a nivel API. Definir si se quiere **bloquear el registro/voto** a no-empadronados.
3. **Vinculación usuario↔municipio depende de re-correr `load_padron`**. Conviene validar el padrón
   **en el registro** (asignar `client_id` ahí) o automatizar la re-vinculación.
4. **Scripts hardcodeados**: `create_client_user.py` y `sync_neighborhoods_table.py` apuntan a Alta Gracia.
   Conviene parametrizarlos (args/env) para no editar código en cada alta.
5. **Formato fijo del padrón** (columnas específicas). Estandarizar el Excel que se pide al municipio.
6. **Branding por cliente**: el modelo `Client` no tiene logo/colores. Si cada municipio necesita su
   identidad visual, hay que agregarlo.

> Estos gaps son candidatos a tickets de mejora. No bloquean el alta del **primer** cliente.
