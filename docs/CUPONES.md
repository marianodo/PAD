# Cupones de descuento (PoC)

El ciudadano canjea los puntos que ganó respondiendo consultas por un cupón de
descuento, y lo usa en un comercio adherido: le muestra el código, el vendedor lo
valida en pantalla y lo consume.

## Principio de diseño

**Los puntos se acumulan por entidad, no globalmente.** Un cupón nace de los
puntos ganados en UNA entidad (municipio, provincia o privado — todas son filas
de `clients`) y solo puede consumirse en comercios adheridos a esa misma entidad.

Sin este scoping, un ciudadano podría participar en el Municipio A y gastar el
descuento en los comercios del Municipio B, que terminarían subsidiando una
participación que no ocurrió ahí. Con la jerarquía ciudad/provincia que ya existe
en `clients.parent_id`, el caso aparece de entrada.

## Flujos

**Generar** — El ciudadano elige un tier del catálogo de una entidad donde tiene
saldo. Se toma un lock sobre su fila de puntos, se valida el saldo, se debita y
se emite el cupón con un código de 6 caracteres.

**Validar** — El comercio tipea el código. Se verifica que exista, que sea de su
entidad, que esté activo y que no haya vencido. No consume nada.

**Consumir** — Se toma un lock sobre el cupón, se revalida el estado dentro de la
misma transacción y se marca como usado. El lock es lo que evita que dos cajas
consuman el mismo cupón simultáneamente.

## Decisiones y sus consecuencias

| Decisión | Por qué | Consecuencia |
|---|---|---|
| Débito **al generar** | Si se debitara al consumir, un ciudadano podría emitir varios cupones respaldados por el mismo saldo y todos serían válidos | La pantalla exige confirmación explícita antes de gastar |
| Vence a los **60 días**, **sin reintegro** | Decisión de producto | No hace falta ningún cron job: el vencimiento se evalúa al mirar el cupón |
| Código de **6 caracteres** | Se dicta y se tipea en el mostrador | Alfabeto sin `I L O U 0 1` para que no se confunda O con 0. 30⁶ ≈ 729 millones |
| Condiciones **congeladas** en el cupón | El catálogo se edita por BD | Editar un tier no cambia lo prometido en cupones ya emitidos |
| Comercio **aprobado a mano** | Hay que verificar con la entidad que esté adherido | Puede registrarse y entrar, pero no operar hasta que se lo habilite |

## Seguridad

- **Token de comercio separado.** El JWT lleva `account_type: "merchant"`, así que
  un token de ciudadano no sirve en los endpoints de comercio ni al revés. En el
  navegador se guarda bajo otra clave (`merchant_token`) para que las dos sesiones
  no se pisen.
- **`get_current_user` rechaza comercios explícitamente.** Los endpoints de
  encuestas autorizan con deny-lists ("si es `User`, 403; si es `Client` de otra
  entidad, 403"), así que una cuenta de un tipo nuevo los atraviesa sin control.
  Como el alta de comercio es pública, eso alcanzaba para leer nombre, email y
  barrio de los respondentes de cualquier entidad. Cualquier tipo de cuenta que se
  agregue en el futuro tiene que sumarse a ese rechazo o convertir las deny-lists
  en allow-lists.
- **El catálogo se valida al canjear.** `points_cost <= 0` se rechaza aunque esté
  activo en la tabla: como el catálogo se edita por SQL a mano, un tier de costo
  cero emitiría cupones infinitos y uno negativo acreditaría puntos.
- **Rate limit de 20/min por comercio** sobre validar y consumir. El espacio de
  códigos es grande, pero un comercio con cuenta podría sondearlo; un mostrador
  real no tipea más que unos pocos códigos por minuto.
- **Sin filtración entre entidades.** Un cupón de otra entidad devuelve exactamente
  la misma respuesta que un código inexistente. Si se distinguieran, un comercio
  podría descubrir códigos ajenos por sondeo.
- **La respuesta al comercio no incluye datos del ciudadano**: solo si el cupón
  sirve y qué descuento aplicar.

## Puesta en marcha

El scoping de puntos por entidad se aplica **solo al arrancar la app**
(`app/main.py`), igual que el resto de las migraciones del proyecto, porque
`create_all()` no altera tablas existentes. No hace falta ningún paso manual en el
deploy. El script existe para correrlo aparte y ver el reporte de atribución:

```bash
# Opcional: aplicar/inspeccionar el scoping a mano (idempotente)
python scripts/migrate_add_client_to_points.py

# Catálogo por defecto: 100 puntos = 5% en cada entidad
python scripts/seed_coupon_rewards.py
python scripts/seed_coupon_rewards.py --list

# 3. Habilitar un comercio que se registró
python scripts/approve_merchant.py --list
python scripts/approve_merchant.py --approve comercio@ejemplo.com
```

Tiers adicionales se agregan por BD, que es cómo se administra el catálogo:

```sql
INSERT INTO coupon_rewards (id, client_id, name, points_cost, discount_pct, is_active)
VALUES (gen_random_uuid(), '<client_uuid>', '10% de descuento', 200, 10, true);
```

## Pantallas

- `/cupones` — saldo por entidad, catálogo, generación con confirmación e historial.
- `/comercio` — alta y login del comercio; aviso de cuenta en revisión si está
  pendiente; validador de mostrador si está habilitado.

## API

```text
Ciudadano (JWT de ciudadano)
  GET  /api/v1/coupons/balances          saldos por entidad + catálogo
  GET  /api/v1/coupons/me                mis cupones
  POST /api/v1/coupons                   generar {client_id, reward_id}

Comercio (JWT de comercio)
  GET  /api/v1/merchants/entities        público: entidades para el alta
  POST /api/v1/merchants/register        queda pendiente
  POST /api/v1/merchants/login
  GET  /api/v1/merchants/me              incluye status
  GET  /api/v1/coupons/validate/{code}   solo habilitados
  POST /api/v1/coupons/{code}/redeem     solo habilitados
```

Los errores de cupón devuelven `detail: {code, message}`. Los `code` son
`invalid_code`, `already_redeemed`, `expired`, `insufficient_points` y
`reward_not_found`, para que la pantalla del comercio sepa qué mostrar.

## Limitaciones conocidas

- **`Survey.client_id` es nullable.** Las encuestas sin entidad acumulan en un
  saldo histórico sin `client_id`, que no puede convertirse en cupones (queda
  excluido de `/coupons/balances`). El script de migración reporta cuántos puntos
  quedaron en esa situación.
- **Saldos ambiguos en la migración.** Si un ciudadano ganó puntos en más de una
  entidad, su saldo global único no se puede repartir sin una decisión de negocio.
  El script los deja sin entidad y los reporta en vez de adivinar.
- **`integration.py` elige la entidad con `next(iter(matched))`.** Si un proveedor
  está autorizado para varias entidades del ciudadano, toma una arbitrariamente.
  Ya era ambiguo antes; ahora además define de qué saldo se debita.
- **`merchants.email` es único global.** Una cadena con sucursales en dos entidades
  necesita una cuenta por entidad.
- **El lock de fila no está cubierto por tests.** Los tests corren sobre SQLite,
  donde `with_for_update()` es un no-op. Se testea la revalidación de estado, que
  es la garantía lógica; la carrera real solo se ejerce en Postgres.
- **`_update_user_points` hace get-or-create sin lock.** Dos respuestas
  concurrentes del mismo ciudadano en una entidad donde todavía no tiene saldo
  pueden intentar dos INSERT y la segunda choca contra el unique. Es preexistente,
  pero ahora la ventana se repite cada vez que participa en una entidad nueva.
- **El rate limit de cupones cuenta también los consumos válidos.** Son 20 por
  minuto por comercio; un local con varias cajas en hora pico podría recibir un
  429 operando normalmente.
