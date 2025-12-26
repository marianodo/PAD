# Guía de Setup - Plataforma P.A.D.

Guía paso a paso para poner en marcha la plataforma completa.

## 1. Requisitos Previos

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (o cuenta en Railway)
- Git

## 2. Setup Backend

### Opción A: Local (Desarrollo)

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar .env
cp .env.example .env
# Editar .env con tus credenciales
```

**PostgreSQL Local con Docker:**
```bash
docker run --name pad-postgres \
  -e POSTGRES_USER=pad_user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pad_db \
  -p 5432:5432 \
  -d postgis/postgis:15-3.3
```

**Iniciar servidor:**
```bash
uvicorn app.main:app --reload
```

API disponible en: http://localhost:8000
Docs: http://localhost:8000/api/v1/docs

### Opción B: Railway (Producción)

1. Crear cuenta en [Railway.app](https://railway.app)

2. Crear nuevo proyecto

3. **Agregar PostgreSQL:**
   - Click en "+ New"
   - Seleccionar "Database" → "PostgreSQL"
   - Railway generará automáticamente `DATABASE_URL`

4. **Agregar Backend:**
   - Click en "+ New"
   - Seleccionar "GitHub Repo"
   - Conectar tu repositorio
   - Seleccionar carpeta `backend`
   - Railway detectará Python automáticamente

5. **Configurar Variables de Entorno:**
   ```
   DATABASE_URL=(auto-generado por Railway)
   SECRET_KEY=your-secret-key-change-this
   BACKEND_CORS_ORIGINS=["https://your-frontend.vercel.app"]
   ```

6. **Deploy automático** se ejecutará en cada push a main

## 3. Crear Encuesta de Ejemplo

Una vez que el backend esté corriendo:

```bash
cd backend
python -m scripts.create_sample_survey
```

Esto creará una encuesta con las 3 preguntas del PMV:
1. Distribución del presupuesto (porcentual)
2. Selección de obra pública (single choice)
3. Calificación de gestión (rating)

## 4. Setup Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar .env.local
cp .env.local.example .env.local
# Editar con la URL de tu backend
```

**Para desarrollo local:**
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Iniciar servidor:**
```bash
npm run dev
```

Frontend disponible en: http://localhost:3000

## 5. Deploy Frontend en Vercel

1. Push tu código a GitHub

2. Ir a [Vercel](https://vercel.com)

3. Importar proyecto desde GitHub

4. Configurar:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. **Variables de Entorno:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
   ```

6. Deploy → Vercel manejará todo automáticamente

## 6. Verificar que Todo Funciona

### Backend
```bash
curl http://localhost:8000/health
# Respuesta: {"status": "ok"}

curl http://localhost:8000/api/v1/surveys/active
# Respuesta: datos de la encuesta activa
```

### Frontend
1. Abrir http://localhost:3000
2. Deberías ver la landing page "Tú Decides"
3. Click en "Comenzar Encuesta"
4. Completa el formulario de registro
5. Responde las 3 preguntas
6. Verifica que te muestre los puntos ganados

## 7. Verificar Datos en Base de Datos

### Usando psql (local):
```bash
docker exec -it pad-postgres psql -U pad_user -d pad_db

# Ver usuarios
SELECT * FROM users;

# Ver respuestas
SELECT * FROM survey_responses;

# Ver puntos
SELECT u.email, up.total_points, up.available_points
FROM users u
JOIN user_points up ON u.id = up.user_id;
```

### Railway:
1. Ve a tu proyecto en Railway
2. Click en PostgreSQL
3. Tab "Data"
4. Ejecuta queries directamente

## 8. Flujo Completo de Testing

1. **Crear encuesta**:
   ```bash
   python -m scripts.create_sample_survey
   ```

2. **Verificar encuesta activa**:
   ```bash
   curl http://localhost:8000/api/v1/surveys/active
   ```

3. **Abrir frontend**:
   - http://localhost:3000

4. **Completar flujo**:
   - Landing → Registro → Preguntas → Éxito

5. **Verificar puntos en BD**:
   ```sql
   SELECT * FROM user_points;
   ```

## 9. Troubleshooting

### Backend no inicia
- Verificar que PostgreSQL esté corriendo
- Verificar `DATABASE_URL` en `.env`
- Ver logs: `uvicorn app.main:app --reload --log-level debug`

### Frontend no se conecta a API
- Verificar `NEXT_PUBLIC_API_URL` en `.env.local`
- Verificar CORS en backend (`BACKEND_CORS_ORIGINS`)
- Abrir DevTools → Console para ver errores

### No aparece encuesta activa
- Ejecutar script de creación de encuesta
- Verificar que `status = 'active'` en BD
- Verificar que `expires_at` sea futuro

### Error al enviar respuesta
- Verificar que todas las preguntas requeridas estén respondidas
- Para preguntas porcentuales, verificar que sume exactamente 100%
- Verificar que no hayas respondido en el último mes

## 10. Próximos Pasos

Una vez que todo funcione:

1. **Personalizar encuesta**: Editar el script de creación
2. **Agregar más tipos de preguntas**
3. **Integrar con sistema de pagos** (próxima fase)
4. **Desarrollar dashboard** (próxima fase)
5. **Implementar IA para reportes** (próxima fase)

## Estructura de URLs

**Backend:**
- Local: http://localhost:8000
- Railway: https://[proyecto].up.railway.app
- Docs: /api/v1/docs

**Frontend:**
- Local: http://localhost:3000
- Vercel: https://[proyecto].vercel.app

**Páginas:**
- `/` - Landing
- `/survey/register` - Registro
- `/survey/questions` - Preguntas
- `/survey/success` - Éxito
