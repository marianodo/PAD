from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.base import get_db

router = APIRouter()


@router.get("/coordinates")
def get_neighborhood_coordinates(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT name, lat, lng FROM neighborhoods ORDER BY name"))
    return {row[0]: {"lat": float(row[1]), "lng": float(row[2])} for row in result}
