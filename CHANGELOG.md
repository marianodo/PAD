# Changelog

Todos los cambios notables de P.A.D. se documentan acá.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Flujo de ramas `develop → staging → main` con un entorno de Railway por rama.
- GitHub Actions de CI: tests de backend (pytest), lint + build del frontend y validación de título de PR (Conventional Commits).
- Documentación de proceso: `CONTRIBUTING.md`, `docs/RELEASING.md`, `docs/ENVIRONMENTS.md` y template de PR.

### Changed
- `.gitignore` ampliado para excluir secretos, dumps SQL y caché de runtime.

### Removed
- Archivos versionados que no debían estarlo: `frontend/.env.production`, `backup_local.sql` y `backend/cache/`.

### Security
- Secretos sacados del control de versiones. La Google Maps API key y el `SECRET_KEY` que estuvieron en el repo deben **rotarse** (quedan en el historial de git).

---

<!--
Plantilla para cada release:

## [X.Y.Z] - AAAA-MM-DD
### Added
### Changed
### Fixed
### Removed
### Security
-->
