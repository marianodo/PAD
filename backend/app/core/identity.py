"""Helpers de identidad: DNI ↔ CUIL.

El padrón oficial trae DNI; el ciudadano se identifica con CUIL (registro o CIDI).
La elegibilidad se matchea por DNI: el CUIL contiene el DNI (CUIL = PP-DNI-V).
"""

import re


def normalize_dni(raw: str) -> str:
    """'29.417.473' / '029417473' -> '29417473' (solo dígitos, sin ceros a la izquierda)."""
    digits = re.sub(r"\D", "", raw or "")
    return str(int(digits)) if digits else ""


def dni_from_cuil(cuil: str) -> str:
    """Extrae el DNI normalizado de un CUIL (PP-DNI-V → los 8 dígitos del medio).

    Devuelve "" si el CUIL no tiene 11 dígitos.
    """
    digits = re.sub(r"\D", "", cuil or "")
    if len(digits) != 11:
        return ""
    return str(int(digits[2:10]))
