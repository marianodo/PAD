# PAD Frontend - Next.js

Frontend de la plataforma P.A.D. (Participación Activa Digital)

## Setup

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.local.example .env.local
# Editar .env.local con la URL de tu API
```

3. Iniciar desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en: http://localhost:3000

## Estructura

```
frontend/
├── app/                  # App Router de Next.js
│   ├── page.tsx         # Landing page
│   └── survey/          # Flujo de encuesta
│       ├── register/    # Registro de usuario
│       ├── questions/   # Preguntas de encuesta
│       └── success/     # Página de éxito
├── components/          # Componentes reutilizables
├── lib/                 # Utilidades y configuración
│   ├── api.ts          # Cliente API
│   └── store.ts        # Estado global (Zustand)
└── types/              # TypeScript types
```

## Features Implementados

### Tipos de Preguntas Soportados
- ✅ Single Choice (Opción única)
- ✅ Multiple Choice (Opción múltiple)
- ✅ Percentage Distribution (Distribución porcentual que suma 100%)
- ✅ Rating (Calificación con estrellas 1-5)
- ✅ Open Text (Texto abierto)

### Sistema de Puntos
- Puntos por cada pregunta respondida
- Puntos bonus por completar la encuesta
- Visualización de puntos ganados

### Validaciones
- Campos requeridos
- Validación de distribución porcentual (debe sumar 100%)
- Validación de rating (1-5)
- Prevención de respuestas duplicadas (1 vez por mes)

## Deploy

### Vercel (Recomendado)
1. Conecta tu repositorio a Vercel
2. Configura la variable de entorno:
   - `NEXT_PUBLIC_API_URL`: URL de tu API (Railway)
3. Deploy automático en cada push

### Railway
También se puede deployar en Railway junto con el backend
