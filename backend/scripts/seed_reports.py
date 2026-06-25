"""Carga/actualiza los reportes en la DB desde los JSON de scripts/report_seeds/.

Idempotente (upsert por slug). Crea la tabla `reports` si no existe.

Uso:
    cd backend
    DATABASE_URL="$DBURL" .venv/bin/python -m scripts.seed_reports
"""

import sys
import os
import glob
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db, engine
from app.models.report import Report

SEEDS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "report_seeds")


def seed_reports():
    # Asegura que la tabla exista (en deploy la crea create_all en el startup)
    Report.__table__.create(bind=engine, checkfirst=True)

    db = next(get_db())
    try:
        files = sorted(glob.glob(os.path.join(SEEDS_DIR, "*.json")))
        if not files:
            print(f"No hay JSON en {SEEDS_DIR}")
            return

        for path in files:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            slug = data["slug"]
            document = {"config": data["config"], "segments": data["segments"]}

            report = db.query(Report).filter(Report.slug == slug).first()
            if report:
                report.period = data.get("period")
                report.title = data.get("client_name")
                report.document = document
                action = "actualizado"
            else:
                report = Report(
                    slug=slug,
                    period=data.get("period"),
                    title=data.get("client_name"),
                    document=document,
                )
                db.add(report)
                action = "creado"

            db.commit()
            print(f"✓ {slug} {action} ({len(data['segments'])} segmentos)")
    finally:
        db.close()


if __name__ == "__main__":
    seed_reports()
