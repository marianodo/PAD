"""Tests del endpoint público de reportes."""

import uuid

from app.models.report import Report


def _make_report(db, slug="alta-gracia-2026", published=True):
    r = Report(
        id=uuid.uuid4(),
        slug=slug,
        period="2026",
        title="Municipalidad de Alta Gracia",
        is_published=published,
        document={
            "config": {"title": "Acciones 2026", "titleHighlight": "Alta Gracia"},
            "segments": [{"id": "obras", "name": "Obras", "color": "#ec4899", "projects": []}],
        },
    )
    db.add(r)
    db.commit()
    return r


def test_get_report_returns_document(client, db):
    _make_report(db)
    res = client.get("/api/v1/reports/alta-gracia-2026")
    assert res.status_code == 200
    data = res.json()
    assert data["slug"] == "alta-gracia-2026"
    assert data["config"]["titleHighlight"] == "Alta Gracia"
    assert len(data["segments"]) == 1
    assert data["segments"][0]["color"] == "#ec4899"


def test_get_report_404_when_missing(client):
    res = client.get("/api/v1/reports/no-existe-2099")
    assert res.status_code == 404


def test_get_report_404_when_unpublished(client, db):
    _make_report(db, slug="borrador-2026", published=False)
    res = client.get("/api/v1/reports/borrador-2026")
    assert res.status_code == 404
