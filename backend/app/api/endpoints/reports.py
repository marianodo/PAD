from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.report import Report

router = APIRouter()


@router.get("/{slug}")
def get_report(slug: str, db: Session = Depends(get_db)):
    """Devuelve el documento del reporte público por slug (ej: 'alta-gracia-2026').

    El frontend genérico renderiza `config` + `segments`. Público (sin auth).
    """
    report = db.query(Report).filter(
        Report.slug == slug,
        Report.is_published == True,
    ).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reporte no encontrado",
        )

    doc = report.document or {}
    return {
        "slug": report.slug,
        "period": report.period,
        "title": report.title,
        "config": doc.get("config", {}),
        "segments": doc.get("segments", []),
    }
