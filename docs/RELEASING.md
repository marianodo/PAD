# Cómo publicar un release — P.A.D.

Este documento describe cómo se promueve código hasta producción y cómo se publica una versión. Para el flujo de ramas y commits ver [CONTRIBUTING.md](../CONTRIBUTING.md); para los entornos ver [ENVIRONMENTS.md](./ENVIRONMENTS.md).

## Resumen del flujo

```
feature/* ──▶ develop ──▶ staging ──▶ main ──▶ tag vX.Y.Z
                DEV         QA          PROD
```

Cada merge dispara el deploy automático del entorno asociado en Railway.

---

## Versionado (SemVer)

Usamos versiones `vMAJOR.MINOR.PATCH`:

- **PATCH** (`v1.2.3` → `v1.2.4`): bugfixes, sin cambios de comportamiento.
- **MINOR** (`v1.2.0` → `v1.3.0`): features nuevas compatibles hacia atrás.
- **MAJOR** (`v1.x` → `v2.0.0`): cambios incompatibles (rompen API o datos).

---

## Paso a paso de un release

### 1. Integrar en `develop`
Los PRs de features/fixes se mergean a `develop` y se prueban en el entorno **develop**.

### 2. Promover a `staging` (QA)
Abrí un PR `develop → staging`:

```bash
gh pr create --base staging --head develop --title "chore: promover a staging" --fill
```

Mergealo cuando el CI esté en verde. Railway deploya al entorno **staging**.
Probá ahí el conjunto de cambios (QA): flujos críticos, encuestas, puntos, dashboard.

### 3. Promover a `main` (producción)
Cuando QA está OK, abrí un PR `staging → main`:

```bash
gh pr create --base main --head staging --title "chore(release): vX.Y.Z" --fill
```

Mergealo (requiere CI verde + es rama protegida). Railway deploya a **production**.

### 4. Actualizar el CHANGELOG y taggear
Antes o junto con el merge a `main`:

1. Mové lo de `[Unreleased]` a una sección nueva `[X.Y.Z] - AAAA-MM-DD` en [CHANGELOG.md](../CHANGELOG.md).
2. Creá el tag sobre `main`:

```bash
git checkout main && git pull origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

3. (Opcional) Release en GitHub con las notas del changelog:

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md)
```

### 5. Verificación post-deploy
- Abrir la URL de producción y verificar que carga (health check del frontend `/`).
- Backend: `GET /api/v1/docs` responde.
- Login admin y de cliente funcionan.
- Si el release incluyó **migración o seed**, correrla en producción (ver abajo) y re-verificar.

---

## Migraciones / seeds

Si un release toca el esquema o necesita datos semilla, corré los scripts en el entorno correcto con Railway CLI:

```bash
railway environment production      # seleccionar entorno
railway run python scripts/<script>.py
```

Documentá siempre en el PR qué script hay que correr (campo "Notas de deploy" del template).

---

## Rollback

Si un deploy a producción sale mal:

1. **Rápido (Railway):** en el dashboard del servicio, entrar a *Deployments* y hacer **Redeploy** del deployment anterior que estaba sano.
2. **Por código:** revertir el merge en `main` y dejar que el deploy automático publique el estado anterior:

```bash
git checkout main && git pull
git revert -m 1 <sha-del-merge>
git push origin main
```

3. Si el problema fue de datos/migración, restaurar desde backup (ver sección Backup en [DEPLOYMENT.md](../DEPLOYMENT.md)).

> Regla: ante una incidencia en prod, **primero estabilizar** (rollback), después diagnosticar en `develop`/`staging`.
