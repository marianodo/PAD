# API de Integración para Proveedores de Pagos

Documentación técnica para integrar el sistema de puntos PAD con proveedores de sistemas de pago de impuestos.

## Resumen

Esta API permite a los proveedores de pagos:
1. **Consultar puntos** de un contribuyente por CUIL
2. **Informar canjeo de puntos** cuando un contribuyente usa puntos como descuento en el pago de impuestos

## Autenticación

Todas las requests requieren una **API Key** en el header `X-API-Key`.

```
X-API-Key: <tu_api_key>
```

La API key se genera al crear el proveedor y se muestra **una sola vez**. Debe guardarse de forma segura ya que no se puede recuperar después (se almacena hasheada con bcrypt).

### Errores de autenticación

| Status | Descripción |
|--------|-------------|
| 401 | API key inválida, proveedor inactivo, o key no proporcionada |
| 429 | Rate limit excedido (100 requests/minuto por proveedor) |

## Endpoints

Base URL: `/api/v1/integration`

---

### GET /points/{cuil}

Consulta los puntos de un contribuyente.

**Parámetros:**

| Parámetro | Tipo | Ubicación | Descripción |
|-----------|------|-----------|-------------|
| cuil | string | path | CUIL del contribuyente (11 dígitos) |

**Headers:**

```
X-API-Key: <tu_api_key>
```

**Response 200:**

```json
{
  "cuil": "20345678901",
  "total_points": 150,
  "available_points": 100,
  "redeemed_points": 50
}
```

**Campos de respuesta:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| cuil | string | CUIL consultado |
| total_points | int | Total de puntos acumulados históricamente |
| available_points | int | Puntos disponibles para canjear |
| redeemed_points | int | Puntos ya canjeados |

**Errores:**

| Status | Descripción |
|--------|-------------|
| 401 | API key inválida |
| 403 | El contribuyente no pertenece a un municipio autorizado para este proveedor |
| 404 | Contribuyente no encontrado |
| 429 | Rate limit excedido |

**Ejemplo con curl:**

```bash
curl -H "X-API-Key: tu_api_key_aqui" \
  https://tu-dominio.com/api/v1/integration/points/20345678901
```

---

### POST /points/redeem

Informa que un contribuyente canjeó puntos por un descuento en el pago de impuestos.

Este endpoint es **idempotente**: si se envía el mismo `reference_id` más de una vez, devuelve la transacción original sin volver a descontar puntos. Esto previene cobros dobles por errores de red o reintentos.

**Headers:**

```
X-API-Key: <tu_api_key>
Content-Type: application/json
```

**Request body:**

```json
{
  "cuil": "20345678901",
  "points": 30,
  "reference_id": "PAGO-2026-02-16-00123",
  "description": "Descuento en pago de tasa municipal - Feb 2026"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| cuil | string | Sí | CUIL del contribuyente (11 dígitos numéricos) |
| points | int | Sí | Cantidad de puntos a canjear (debe ser > 0) |
| reference_id | string | Sí | ID único de la operación en el sistema del proveedor (máx. 255 chars) |
| description | string | No | Descripción del canjeo (máx. 500 chars) |

**Response 200 (primera vez):**

```json
{
  "cuil": "20345678901",
  "points_redeemed": 30,
  "available_points": 70,
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "reference_id": "PAGO-2026-02-16-00123",
  "already_processed": false
}
```

**Response 200 (idempotente - mismo reference_id):**

```json
{
  "cuil": "20345678901",
  "points_redeemed": 30,
  "available_points": 70,
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "reference_id": "PAGO-2026-02-16-00123",
  "already_processed": true
}
```

**Campos de respuesta:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| cuil | string | CUIL del contribuyente |
| points_redeemed | int | Puntos canjeados en esta operación |
| available_points | int | Puntos disponibles después del canjeo |
| transaction_id | UUID | ID de la transacción en PAD |
| reference_id | string | ID de referencia enviado por el proveedor |
| already_processed | bool | `true` si el `reference_id` ya fue procesado anteriormente |

**Errores:**

| Status | Descripción |
|--------|-------------|
| 400 | Puntos insuficientes |
| 401 | API key inválida |
| 403 | El contribuyente no pertenece a un municipio autorizado |
| 404 | Contribuyente no encontrado |
| 422 | Datos inválidos (CUIL mal formateado, puntos <= 0, etc.) |
| 429 | Rate limit excedido |

**Ejemplo con curl:**

```bash
curl -X POST \
  -H "X-API-Key: tu_api_key_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "cuil": "20345678901",
    "points": 30,
    "reference_id": "PAGO-2026-02-16-00123",
    "description": "Descuento tasa Feb 2026"
  }' \
  https://tu-dominio.com/api/v1/integration/points/redeem
```

---

## Control de acceso

Cada proveedor tiene una lista de **municipios (clients) autorizados**. Solo puede consultar o canjear puntos de contribuyentes que pertenezcan a esos municipios.

- Si un contribuyente existe pero no pertenece a un municipio autorizado del proveedor → **403**
- Si un contribuyente no está vinculado a ningún municipio → **403**
- Si el CUIL no existe en el sistema → **404**

## Rate Limiting

- **100 requests por minuto** por proveedor
- Se aplica a todos los endpoints de integración
- Al exceder el límite se devuelve **429 Too Many Requests** con header `Retry-After`

## Idempotencia

El campo `reference_id` en el endpoint de canjeo garantiza idempotencia:

- Cada `reference_id` debe ser **único por operación** en el sistema del proveedor
- Si se envía un `reference_id` que ya fue procesado, se devuelve la respuesta original sin modificar datos
- Esto permite reintentar requests de forma segura ante errores de red
- Se recomienda usar un formato como: `PAGO-{fecha}-{id_operacion}`

## Auditoría

Todas las interacciones con la API quedan registradas en un log de auditoría que incluye:
- Proveedor que realizó la request
- Endpoint accedido
- CUIL consultado
- Request y response completos
- IP de origen
- Timestamp

---

## Administración de Proveedores

### Crear un proveedor

Desde el directorio `backend/`, ejecutar:

```bash
python -m scripts.create_provider
```

El script interactivo:
1. Solicita el **nombre** del proveedor
2. Muestra los **municipios disponibles** en el sistema
3. Permite seleccionar uno o más municipios a vincular
4. **Genera y muestra la API key** una sola vez
5. Almacena la API key hasheada (no se puede recuperar)

**Ejemplo de ejecución:**

```
=== Crear Proveedor de Pagos ===

Nombre del proveedor: Sistema de Pagos XYZ

Clients (municipios) disponibles:
  1. Municipalidad de Alta Gracia (ID: abc123...)
  2. Municipalidad de Villa María (ID: def456...)

Ingrese los números de los clients a vincular (separados por coma): 1

============================================================
PROVEEDOR CREADO EXITOSAMENTE
============================================================

Nombre: Sistema de Pagos XYZ
ID: 789ghi...
Clients vinculados:
  - Municipalidad de Alta Gracia (abc123...)

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
API KEY (GUARDAR DE FORMA SEGURA - NO SE PUEDE RECUPERAR):

  aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abcdefghijklmn

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

Prefijo (para identificación en logs): aBcDeFgH...
```

### Revocar acceso de un proveedor

Actualmente se realiza directamente en la base de datos:

```sql
-- Desactivar proveedor (revoca acceso inmediatamente)
UPDATE providers SET is_active = false WHERE name = 'Sistema de Pagos XYZ';

-- Desactivar acceso a un municipio específico
UPDATE provider_clients SET is_active = false
WHERE provider_id = '<provider_id>' AND client_id = '<client_id>';
```

### Regenerar API key

No hay una funcionalidad de regenerar API key. Para cambiar la key de un proveedor:
1. Desactivar el proveedor actual
2. Crear uno nuevo con el mismo nombre (eliminar el anterior primero)
3. Comunicar la nueva API key al proveedor

---

## Modelo de datos

### Tablas involucradas

```
providers
├── id (UUID, PK)
├── name (VARCHAR)
├── api_key_hash (VARCHAR) -- bcrypt hash
├── api_key_prefix (VARCHAR(8)) -- primeros 8 chars para logs
├── is_active (BOOLEAN)
├── created_at
└── updated_at

provider_clients (many-to-many)
├── id (UUID, PK)
├── provider_id (FK → providers)
├── client_id (FK → clients)
├── is_active (BOOLEAN)
└── created_at

integration_audit_log
├── id (UUID, PK)
├── provider_id (FK → providers)
├── client_id (FK → clients, nullable)
├── endpoint (VARCHAR)
├── cuil (VARCHAR, nullable)
├── request_body (JSONB)
├── response_body (JSONB)
├── response_status (INTEGER)
├── ip_address (VARCHAR)
└── created_at
```

### Flujo de canjeo

```
Contribuyente → Sistema de Pagos → PAD API

1. Contribuyente inicia pago en sistema del proveedor
2. Proveedor consulta GET /points/{cuil}
3. Si tiene puntos, muestra opción de descuento
4. Contribuyente acepta usar puntos
5. Proveedor llama POST /points/redeem con reference_id único
6. PAD descuenta puntos y confirma
7. Proveedor aplica descuento al monto del impuesto
```
