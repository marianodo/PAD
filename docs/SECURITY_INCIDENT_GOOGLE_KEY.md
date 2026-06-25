# Incidente: Google Maps API key filtrada en el historial de git

**Severidad:** Alta · **Estado:** pendiente de acción manual

## Qué pasó
La key `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` se commiteó en `frontend/.env.production` y,
aunque el archivo se borró y luego se gitignoreó, **sigue siendo recuperable del historial**
de este repositorio, que es **público** (`github.com/marianodo/PAD`).

Commits afectados:
- `74daedf` ("Use google map") — introdujo la key
- `d75db74` — borró el archivo (pero la key queda en el historial)

La key además **sigue activa** (en uso en `frontend/.env` y `frontend/.env.production` locales).

## Acciones requeridas (en orden)

### 1. Rotar la key en Google Cloud Console (URGENTE)
- Crear una key nueva en *APIs & Services → Credentials*.
- Restringirla:
  - **Application restrictions → HTTP referrers**: solo los dominios de producción
    (`*.datainsights.com.ar`) y los de develop/staging (`*.up.railway.app`).
  - **API restrictions**: solo las APIs de Maps que se usan (Maps JavaScript API, etc.).
- Definir un **presupuesto/alerta de billing** para detectar abuso.
- Eliminar/deshabilitar la key vieja una vez migrado.

### 2. Actualizar la key en los entornos
- Railway: variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` por servicio/entorno.
- Local: `frontend/.env` y `frontend/.env.production` (gitignored).

### 3. (Opcional pero recomendado) Purgar el historial de git
Como el repo es público, la key vieja queda accesible aunque se rote. Si la key vieja
no se puede eliminar del todo en Google Cloud, conviene reescribir el historial:

```bash
# Con git-filter-repo (recomendado)
git filter-repo --path frontend/.env.production --invert-paths

# o con BFG
bfg --delete-files .env.production
```

**Ojo:** reescribir el historial es destructivo y requiere coordinar con el equipo
(force-push, re-clonar, ramas protegidas `main`/`staging`). Rotar la key es lo que
realmente neutraliza el riesgo; la purga es defensa en profundidad.

### 4. Verificar que no haya otras keys en el historial
```bash
git log --all -p -S "AIza" --oneline
git log --all -p -S "sk-ant" --oneline
```
