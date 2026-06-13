<!--
Título del PR: usá Conventional Commits, ej:
  feat: agregar export de resultados a Excel
  fix: corregir cálculo de puntos en redeem
El CI valida el formato del título automáticamente.
-->

## ¿Qué cambia?

<!-- Resumen claro del cambio y el motivo. Linkeá el issue si aplica (#123). -->

## Tipo de cambio

- [ ] `feat` — nueva funcionalidad
- [ ] `fix` — corrección de bug
- [ ] `refactor` — cambio interno sin alterar comportamiento
- [ ] `docs` / `chore` / `test` / `ci` — otros

## Rama destino

- [ ] `develop` (default para features/fixes)
- [ ] `staging` (promoción dev → QA)
- [ ] `main` (release a producción — solo desde `staging`)

## Checklist

- [ ] El título sigue Conventional Commits
- [ ] CI en verde (backend tests + frontend lint/build)
- [ ] Probado localmente
- [ ] ¿Requiere migración o script de seed? (detallar abajo)
- [ ] ¿Agrega/cambia variables de entorno? (detallar abajo y avisar para setearlas en Railway)
- [ ] Screenshots / video si hay cambios de UI

## Notas de deploy

<!--
Migraciones a correr, variables nuevas, pasos manuales post-deploy, etc.
Dejar "Ninguna" si no aplica.
-->
Ninguna
