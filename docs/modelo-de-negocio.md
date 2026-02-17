# PAD - Participación Activa Digital
## Modelo de Negocio

---

## 1. Descripción del Producto

PAD es una plataforma tecnológica orientada a municipios y gobiernos locales que permite capturar las preferencias y opiniones de los ciudadanos en el momento del pago de tributos, generando datos georreferenciados y periódicos para mejorar la gestión pública.

### Componentes del sistema:
- **Portal de encuesta**: accesible vía QR, donde el ciudadano responde preguntas
- **Dashboard**: panel de control para el municipio con métricas, gráficos, históricos y mapas
- **Engine**: motor de procesamiento de datos con insights generados por IA
- **APIs**: para integración con el sistema de recaudación del municipio

---

## 2. Estructura Comercial

El modelo se divide en dos bloques:

### Bloque 1: Implementación (Pago único)

Pago inicial que se realiza antes de comenzar la operación. **El fee mensual no comienza hasta que la integración esté operativa.**

#### Incluye:
- Consultoría inicial para definir las preguntas de la encuesta (trabajo conjunto con el equipo del municipio)
- Diseño y desarrollo del dashboard personalizado
- Diseño y desarrollo del portal de encuesta
- Generación de códigos QR
- Exposición de APIs para integración con sistema de recaudación
- Acompañamiento técnico durante la integración (el municipio o su proveedor consume las APIs)
- Capacitación inicial al equipo del municipio

#### Tiempo estimado de implementación: 1 mes

### Bloque 2: Operación Mensual (Fee fijo)

Contrato anual con 12 pagos mensuales fijos. El municipio sabe exactamente cuánto pagará cada mes.

#### Incluye:
- Hosting e infraestructura en la nube
- Base de datos (capacidad escalada según población)
- Insights y reportes con IA (uso de LLM externo, optimizado con caché)
- Soporte básico (consultas sobre uso del dashboard, ayuda general)
- Mantenimiento de la plataforma y actualizaciones de seguridad
- Hasta **10 usuarios** con acceso al dashboard
- Hasta **3 revisiones de encuesta por año** (cambios en preguntas, opciones, etc.)

#### Nivel de servicio (SLA):
- Disponibilidad en horario hábil
- Sin garantía de soporte 24/7 (no es un sistema crítico)
- Atención de incidentes en días hábiles

---

## 3. Extras (Se cotizan por separado)

Los siguientes items no están incluidos en el fee mensual y se cotizan según el caso:

- Revisiones de encuesta adicionales (más de 3 por año)
- Cambios significativos en el dashboard o portal
- Integraciones adicionales con otros sistemas
- Usuarios adicionales (más de 10)
- Desarrollos a medida

Cada solicitud de cambio será analizada y se entregará una cotización antes de proceder.

---

## 4. Estructura de Precios

### Implementación (Pago único)

| Tier | Población | Precio |
|------|-----------|--------|
| Pequeño | < 30.000 habitantes | 2.000 - 3.000 USD |
| Mediano | 30.000 - 100.000 habitantes | 3.500 - 5.000 USD |
| Grande | > 100.000 habitantes | 6.000 - 8.000 USD |

### Fee Mensual (Contrato anual)

| Tier | Población | Fee Mensual | Total Anual |
|------|-----------|-------------|-------------|
| Pequeño | < 30.000 habitantes | 300 - 400 USD | 3.600 - 4.800 USD |
| Mediano | 30.000 - 100.000 habitantes | 500 - 700 USD | 6.000 - 8.400 USD |
| Grande | > 100.000 habitantes | 900 - 1.200 USD | 10.800 - 14.400 USD |

### Ejemplo: Municipio Mediano (~50.000 habitantes)

| Concepto | Monto |
|----------|-------|
| Implementación (pago único) | 4.000 USD |
| Fee mensual | 500 USD |
| Total primer año | 10.000 USD |
| Años siguientes (solo operación) | 6.000 USD/año |

---

## 5. Costos Operativos de Referencia

Costos estimados por municipio para el cálculo de márgenes:

| Concepto | Costo mensual estimado |
|----------|------------------------|
| Infraestructura (hosting, base de datos) | ~100 USD |
| LLM externo (con caché) | ~20 USD |
| **Total costo directo** | **~120 USD** |
| Margen de seguridad | ~30 USD |
| **Costo base mensual** | **~150 USD** |

Con un fee de 500 USD/mes, el margen bruto es de ~350 USD/mes para cubrir soporte, mantenimiento y ganancia.

---

## 6. Condiciones Generales

### Inicio del contrato
- El fee mensual comienza a cobrarse una vez que la integración esté operativa y el sistema en producción
- La implementación se paga por adelantado o en hitos acordados

### Duración
- Contrato anual (12 meses)
- Renovación a acordar antes del vencimiento

### Revisiones de encuesta
- 3 revisiones incluidas por año
- Una revisión puede incluir: cambio de preguntas, modificación de opciones, ajuste de textos
- Cambios adicionales se cotizan según complejidad

### Usuarios del dashboard
- Hasta 10 usuarios incluidos
- Usuarios adicionales se cotizan por separado

### Datos
- Los datos generados son propiedad del proveedor
- El municipio tiene derecho a exportar los datos de su gestión
- Los datos pueden ser utilizados de forma anonimizada y agregada para análisis comparativos

### Integración
- El proveedor expone las APIs necesarias
- El municipio (o su proveedor de sistema de recaudación) es responsable de consumir las APIs
- El proveedor acompaña técnicamente durante el proceso de integración

---

## 7. Propuesta de Valor

### Para el municipio:
- Conocer las preferencias de los ciudadanos de forma periódica y georreferenciada
- Datos concretos para justificar decisiones de inversión
- Herramienta de comunicación directa con el contribuyente
- Costo fijo y predecible

### Para el ciudadano:
- Participación directa en el destino de sus tributos
- Beneficios/incentivos por participar
- Reportes personalizados sobre temas de su interés

### Para la democracia:
- Fortalecimiento de la participación ciudadana
- Reducción de la brecha entre percepción y gestión real
- Mecanismo ágil sin la burocracia de los sistemas tradicionales

---

*Documento generado: Enero 2026*
*Versión: 1.0*
