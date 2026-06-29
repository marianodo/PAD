"""Smoke test end-to-end contra un entorno (dev/staging/prod).

Verifica los flujos críticos sin tocar la UI:
  1. Un ciudadano puede entrar con CUIL (registro + login).
  2. Un cliente (municipio) puede entrar y sus encuestas devuelven datos de gráficos.

Uso:
    cd backend
    .venv/bin/python -m scripts.smoke_test                       # contra dev (default)
    BASE_URL=https://api.datainsights.com.ar \\
      CLIENT_EMAIL=... CLIENT_PASS=... .venv/bin/python -m scripts.smoke_test

Exit code 0 si todo pasa, 1 si algo falla.
"""

import os
import sys

import httpx

BASE_URL = os.getenv("BASE_URL", "https://backend-develop-cbbc.up.railway.app").rstrip("/")
API = f"{BASE_URL}/api/v1"

# Cliente (municipio) de prueba. En dev: Alta Gracia.
CLIENT_EMAIL = os.getenv("CLIENT_EMAIL", "muni.altagracia@gmail.com")
CLIENT_PASS = os.getenv("CLIENT_PASS", "muni123")

# Ciudadano de prueba (se registra la primera vez; después solo loguea).
CITIZEN_CUIL = os.getenv("CITIZEN_CUIL", "20999999991")
CITIZEN_PASS = os.getenv("CITIZEN_PASS", "smoke1234")
CITIZEN_EMAIL = os.getenv("CITIZEN_EMAIL", "smoke.citizen@example.com")

# Flags (para entornos sin datos demo, ej: producción limpia → solo health).
SKIP_CITIZEN = os.getenv("SKIP_CITIZEN", "").lower() in ("1", "true", "yes")
SKIP_CLIENT = os.getenv("SKIP_CLIENT", "").lower() in ("1", "true", "yes")

_failures = []


def check(name, ok, detail=""):
    print(f"  {'✅' if ok else '❌'} {name}" + (f"  ({detail})" if detail else ""))
    if not ok:
        _failures.append(name)


def login(identifier, password):
    return httpx.post(f"{API}/auth/login",
                      json={"cuil": identifier, "password": password}, timeout=30)


def main():
    print(f"\nSmoke test → {BASE_URL}\n")

    # ── 0. Health ──────────────────────────────────────────────────
    try:
        h = httpx.get(f"{BASE_URL}/health", timeout=30)
        check("health", h.status_code == 200, f"HTTP {h.status_code}")
    except Exception as e:
        check("health", False, str(e))

    # ── 1. Ciudadano: entrar con CUIL ──────────────────────────────
    if not SKIP_CITIZEN:
        print("\n1) Ciudadano (login con CUIL)")
        reg = httpx.post(f"{API}/auth/register", json={
            "cuil": CITIZEN_CUIL, "email": CITIZEN_EMAIL,
            "password": CITIZEN_PASS, "name": "Smoke Test",
        }, timeout=30)
        # 201 = recién creado, 400 = ya existía. Ambos son OK para el smoke.
        check("registro disponible", reg.status_code in (201, 400), f"HTTP {reg.status_code}")

        rc = login(CITIZEN_CUIL, CITIZEN_PASS)
        cdata = rc.json() if rc.status_code == 200 else {}
        check("login ciudadano con CUIL", rc.status_code == 200 and bool(cdata.get("access_token")),
              f"HTTP {rc.status_code}")

    # ── 2. Cliente: entrar y ver datos de gráficos ─────────────────
    if SKIP_CLIENT:
        _finish()
        return

    print("\n2) Cliente (login + gráficos)")
    rcl = login(CLIENT_EMAIL, CLIENT_PASS)
    cl = rcl.json() if rcl.status_code == 200 else {}
    token = cl.get("access_token")
    check("login cliente", rcl.status_code == 200 and bool(token), f"HTTP {rcl.status_code}")

    if token:
        H = {"Authorization": f"Bearer {token}"}
        rs = httpx.get(f"{API}/surveys/", headers=H, timeout=30)
        surveys = rs.json() if rs.status_code == 200 else []
        check("cliente ve sus encuestas", rs.status_code == 200 and len(surveys) > 0,
              f"{len(surveys)} encuestas")

        if surveys:
            sid = surveys[0]["id"]
            rr = httpx.get(f"{API}/surveys/{sid}/results", headers=H, timeout=60)
            rj = rr.json() if rr.status_code == 200 else {}
            qs = rj.get("questions_summary") or []
            check("resultados con datos para gráficos",
                  rr.status_code == 200 and len(qs) > 0,
                  f"HTTP {rr.status_code}, {len(qs)} preguntas, {rj.get('total_responses', 0)} respuestas")

    _finish()


def _finish():
    print()
    if _failures:
        print(f"❌ FALLÓ: {', '.join(_failures)}")
        sys.exit(1)
    print("✅ TODO OK")
    sys.exit(0)


if __name__ == "__main__":
    main()
