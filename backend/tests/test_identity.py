"""Tests de los helpers DNI ↔ CUIL."""

from app.core.identity import dni_from_cuil, normalize_dni


def test_dni_from_cuil_basico():
    assert dni_from_cuil("20294174733") == "29417473"
    assert dni_from_cuil("27125085640") == "12508564"


def test_dni_from_cuil_con_guiones():
    assert dni_from_cuil("20-29417473-3") == "29417473"


def test_dni_from_cuil_7_digitos():
    # DNI de 7 dígitos: el CUIL lo paddea a 8 ("01234567") → sin ceros a la izquierda
    assert dni_from_cuil("20012345670") == "1234567"


def test_dni_from_cuil_invalido():
    assert dni_from_cuil("123") == ""
    assert dni_from_cuil("") == ""
    assert dni_from_cuil(None) == ""


def test_normalize_dni():
    assert normalize_dni("29.417.473") == "29417473"
    assert normalize_dni("01.234.567") == "1234567"
    assert normalize_dni("") == ""
