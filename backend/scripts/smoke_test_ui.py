"""Smoke test VISUAL (Playwright): login del cliente + gráficos renderizados de verdad.

Complementa scripts/smoke_test.py (API): este abre un navegador headless, loguea
con la cuenta del cliente por la UI, va al dashboard de resultados y verifica que
los gráficos (recharts) se pinten.

Requiere (no va en el deploy):
    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/playwright install chromium

Uso:
    cd backend
    .venv/bin/python -m scripts.smoke_test_ui                 # contra dev (default)
    FRONTEND_URL=https://pad-usuarios.datainsights.com.ar \\
      API_URL=https://api.datainsights.com.ar \\
      CLIENT_EMAIL=... CLIENT_PASS=... .venv/bin/python -m scripts.smoke_test_ui
"""

import os
import sys

import httpx
from playwright.sync_api import sync_playwright

FRONTEND = os.getenv("FRONTEND_URL", "https://pad-dev.datainsights.com.ar").rstrip("/")
API = os.getenv("API_URL", "https://backend-develop-cbbc.up.railway.app").rstrip("/")
CLIENT_EMAIL = os.getenv("CLIENT_EMAIL", "muni.altagracia@gmail.com")
CLIENT_PASS = os.getenv("CLIENT_PASS", "muni123")


def main():
    print(f"\nSmoke UI → {FRONTEND}\n")

    # 1. Conseguir una encuesta del cliente vía API (para ir directo a sus resultados)
    login = httpx.post(f"{API}/api/v1/auth/login",
                       json={"cuil": CLIENT_EMAIL, "password": CLIENT_PASS}, timeout=30)
    if login.status_code != 200:
        print(f"❌ login API del cliente falló: HTTP {login.status_code}")
        sys.exit(1)
    token = login.json()["access_token"]
    surveys = httpx.get(f"{API}/api/v1/surveys/",
                        headers={"Authorization": f"Bearer {token}"}, timeout=30).json()
    if not surveys:
        print("❌ el cliente no tiene encuestas")
        sys.exit(1)
    survey_id = surveys[0]["id"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # 2. Login del cliente por la UI (el municipio entra por /auth/admin-login con email)
            page.goto(f"{FRONTEND}/auth/admin-login", wait_until="domcontentloaded")
            page.fill("#email", CLIENT_EMAIL)
            page.fill("#password", CLIENT_PASS)
            page.press("#password", "Enter")
            # login OK = token guardado en localStorage
            page.wait_for_function("() => !!localStorage.getItem('access_token')", timeout=20000)
            print("  ✅ login del cliente por la UI")

            # 3. Dashboard de resultados → los gráficos tienen que renderizar.
            # recharts v3 no emite clases recharts-*, así que detectamos los gráficos
            # como SVGs "grandes" (los íconos son chicos y quedan afuera).
            page.goto(f"{FRONTEND}/client/results/{survey_id}", wait_until="domcontentloaded")
            big_svgs = """() => [...document.querySelectorAll('svg')].filter(s => {
                const r = s.getBoundingClientRect(); return r.width >= 150 && r.height >= 120;
            }).length"""
            page.wait_for_function(f"() => ({big_svgs})() > 0", timeout=40000)
            n_charts = page.evaluate(big_svgs)
            print(f"  ✅ gráficos renderizados: {n_charts}")

            browser.close()
            if n_charts > 0:
                print("\n✅ TODO OK")
                sys.exit(0)
            print("\n❌ no se renderizó ningún gráfico")
            sys.exit(1)
        except Exception as e:
            page.screenshot(path="/tmp/smoke_ui_fail.png")
            browser.close()
            print(f"\n❌ FALLÓ: {e}\n(screenshot en /tmp/smoke_ui_fail.png)")
            sys.exit(1)


if __name__ == "__main__":
    main()
