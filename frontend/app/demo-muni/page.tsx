"use client";

import { useState, useMemo, useCallback } from "react";

const DEBT_DATA = [
  { periodo: "2026/001", desc: "CUOTA BASICA", boleta: "0142130922", venc: "20/01/2026", historico: 14022.83, recargo: 449.90, total: 14472.73 },
  { periodo: "2026/002", desc: "CUOTA BASICA", boleta: "0142130930", venc: "27/02/2026", historico: 14022.83, recargo: 218.76, total: 14241.59 },
  { periodo: "2026/003", desc: "CUOTA BASICA", boleta: "0142130948", venc: "10/03/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/004", desc: "CUOTA BASICA", boleta: "0142130956", venc: "10/04/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/005", desc: "CUOTA BASICA", boleta: "0142130964", venc: "12/05/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/006", desc: "CUOTA BASICA", boleta: "0142130972", venc: "10/06/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/007", desc: "CUOTA BASICA", boleta: "0142130980", venc: "10/07/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/008", desc: "CUOTA BASICA", boleta: "0142130999", venc: "10/08/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/009", desc: "CUOTA BASICA", boleta: "0142131001", venc: "10/09/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/010", desc: "CUOTA BASICA", boleta: "0142131017", venc: "13/10/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/011", desc: "CUOTA BASICA", boleta: "0142131025", venc: "10/11/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
  { periodo: "2026/012", desc: "CUOTA BASICA", boleta: "0142131033", venc: "10/12/2026", historico: 14775.86, recargo: 0.00, total: 14775.86 },
];

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DemoMuniPage() {
  // Demo controls
  const [points, setPoints] = useState(350);
  const [nombre, setNombre] = useState("DOMINGUEZ MARIANO AGUSTIN");
  const [cuenta, setCuenta] = useState("00345007");
  const [cuit, setCuit] = useState("20-33445566-0");

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Discount state
  const [chosenDiscount, setChosenDiscount] = useState(0); // 0 = sin descuento

  const maxDiscount = Math.floor(points / 100); // e.g. 350 pts => max 3%
  const ptsPerPercent = 100;

  const toggleSelect = useCallback((boleta: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(boleta)) next.delete(boleta);
      else next.add(boleta);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === DEBT_DATA.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(DEBT_DATA.map((r) => r.boleta)));
    }
  }, [selected.size]);

  // Totals
  const totals = useMemo(() => {
    const all = DEBT_DATA.reduce(
      (acc, r) => ({ historico: acc.historico + r.historico, recargo: acc.recargo + r.recargo, total: acc.total + r.total }),
      { historico: 0, recargo: 0, total: 0 }
    );
    const sel = DEBT_DATA.filter((r) => selected.has(r.boleta)).reduce(
      (acc, r) => ({ historico: acc.historico + r.historico, recargo: acc.recargo + r.recargo, total: acc.total + r.total }),
      { historico: 0, recargo: 0, total: 0 }
    );
    return { all, sel };
  }, [selected]);

  const selectedCount = selected.size;
  const hasSelection = selectedCount > 0;

  // Discount calculations
  const ahorro = totals.sel.total * (chosenDiscount / 100);
  const totalFinal = totals.sel.total - ahorro;
  const puntosAUsar = chosenDiscount * ptsPerPercent;
  const puntosRestantes = points - puntosAUsar;

  const resetDemo = useCallback(() => {
    setSelected(new Set());
    setChosenDiscount(0);
  }, []);

  const today = new Date().toLocaleDateString("es-AR");

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .mc { max-width: 1140px; margin: 0 auto; padding: 20px; font-family: 'Source Sans Pro', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; }

        /* Demo controls */
        .demo-ctrl { background: #fff3e0; border: 2px dashed #ff9800; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .demo-ctrl h5 { color: #e65100; margin: 0 0 15px; font-weight: 700; font-size: 16px; }
        .demo-ctrl label { font-weight: 600; margin-bottom: 4px; display: block; color: #555; font-size: 14px; }
        .demo-ctrl input[type="range"] { width: 100%; margin: 4px 0 8px; }
        .dc-row { display: flex; gap: 20px; flex-wrap: wrap; }
        .dc-grp { flex: 1; min-width: 200px; }
        .dc-val { font-weight: bold; color: #e65100; font-size: 18px; }
        .dc-hint { font-size: 12px; color: #888; }
        .btn-rst { background: #ff9800; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px; }
        .btn-rst:hover { background: #f57c00; }

        /* Header */
        .hdr { background: linear-gradient(135deg, #b71c1c, #c62828); color: white; padding: 12px 20px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; }
        .hdr h3 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
        .hdr .badge { background: #d32f2f; border: 2px solid rgba(255,255,255,0.5); color: white; padding: 6px 16px; border-radius: 4px; font-weight: bold; font-size: 16px; }

        /* Info section */
        .info { background: white; border: 1px solid #ddd; border-top: none; padding: 20px; }
        .info table { width: 100%; border-collapse: collapse; }
        .info td { padding: 8px 12px; border: 1px solid #eee; font-size: 14px; }
        .info .lc { background: #f8f8f8; font-weight: bold; width: 180px; border-left: 3px solid #999; }

        /* PAD rewards bar */
        .pad-bar { margin-top: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .pad-bar-hdr { background: linear-gradient(135deg, #1565c0, #1976d2, #2196f3); color: white; padding: 14px 24px; display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; }
        .pad-bar-body { background: white; padding: 20px 30px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .ps { display: flex; align-items: center; gap: 14px; }
        .ps-circle { width: 68px; height: 68px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: white; flex-shrink: 0; background: linear-gradient(135deg, #43a047, #66bb6a); box-shadow: 0 3px 8px rgba(67,160,71,0.3); }
        .ps-info .sub { color: #888; font-size: 13px; }
        .ps-info .vl { font-size: 18px; font-weight: 700; color: #333; }
        .ps-prog { width: 130px; height: 6px; background: #e0e0e0; border-radius: 3px; margin-top: 4px; overflow: hidden; }
        .ps-prog-fill { height: 100%; background: linear-gradient(90deg, #1976d2, #42a5f5); border-radius: 3px; transition: width 0.4s; }
        .pad-cta { background: linear-gradient(135deg, #1565c0, #1976d2); color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; text-decoration: none; }
        .pad-cta:hover { background: linear-gradient(135deg, #0d47a1, #1565c0); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(21,101,192,0.3); }

        /* PFP banner */
        .pfp { margin-top: 20px; background: #dff0d8; border: 1px solid #d0e9c6; border-left: 5px solid #5cb85c; padding: 14px 20px; border-radius: 4px; color: #3c763d; font-size: 15px; }
        .pfp a { color: #2e6da4; font-weight: bold; text-decoration: underline; }

        /* Debt table */
        .dt-wrap { margin-top: 20px; background: white; border: 1px solid #ddd; border-radius: 4px; overflow-x: auto; }
        .dt { width: 100%; border-collapse: collapse; min-width: 800px; }
        .dt thead th { background: #f8f8f8; border-bottom: 2px solid #ddd; padding: 10px 12px; font-weight: 600; font-size: 13px; color: #555; text-align: left; white-space: nowrap; }
        .dt tbody td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .dt tbody tr:hover { background: #f5f9ff; }
        .dt tbody tr.row-selected { background: #e3f2fd; }
        .dt .ar { text-align: right; font-variant-numeric: tabular-nums; }
        .dt .ac { text-align: center; }
        .dt .red { color: #c62828; font-weight: 600; }
        .dt input[type="checkbox"] { transform: scale(1.4); cursor: pointer; }

        /* Totals rows */
        .dt tfoot td { padding: 10px 12px; font-size: 14px; font-weight: 600; border-top: 2px solid #ddd; }
        .dt tfoot .sel-row td { border-top: 1px solid #ddd; font-weight: 600; }
        .sel-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 14px; font-weight: bold; }
        .sel-badge.green { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
        .sel-badge.blue { background: #e3f2fd; color: #1565c0; border: 1px solid #bbdefb; }

        /* Boletas vencidas indicator */
        .venc-info { padding: 10px 16px; font-size: 13px; color: #888; display: flex; align-items: center; gap: 6px; }
        .venc-dot { width: 8px; height: 8px; background: #ff9800; border-radius: 50%; display: inline-block; }
        .updated-info { text-align: right; padding: 10px 16px; font-size: 13px; color: #888; }

        /* ========== DISCOUNT SECTION ========== */
        .disc-section { margin-top: 20px; border: 2px solid #c8e6c9; border-radius: 10px; overflow: hidden; background: white; transition: all 0.3s; }
        .disc-hdr { background: white; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e8e8e8; }
        .disc-hdr-left { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; color: #333; }
        .disc-hdr-left .icon { width: 28px; height: 28px; background: #e8f5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #43a047; font-size: 16px; }
        .disc-hdr-right { font-size: 14px; color: #888; }

        .disc-body { padding: 20px 24px; }

        /* Discount buttons */
        .disc-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .disc-btn { padding: 8px 20px; border-radius: 20px; border: 2px solid #ddd; background: white; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; color: #555; }
        .disc-btn:hover { border-color: #43a047; color: #43a047; }
        .disc-btn.active { background: #43a047; color: white; border-color: #43a047; }
        .disc-btn.disabled { opacity: 0.4; cursor: not-allowed; }

        /* Slider */
        .disc-slider-wrap { margin: 12px 0 8px; position: relative; }
        .disc-slider { width: 100%; -webkit-appearance: none; appearance: none; height: 8px; border-radius: 4px; outline: none; transition: background 0.3s; }
        .disc-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: white; border: 3px solid #43a047; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        .disc-slider-labels { display: flex; justify-content: space-between; font-size: 12px; color: #aaa; margin-top: 2px; }

        /* Discount summary */
        .disc-summary { display: flex; gap: 0; margin-top: 16px; background: #fafafa; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
        .disc-summary-item { flex: 1; padding: 14px 16px; border-right: 1px solid #eee; }
        .disc-summary-item:last-child { border-right: none; }
        .disc-summary-item .ds-label { font-size: 11px; text-transform: uppercase; color: #999; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px; }
        .disc-summary-item .ds-value { font-size: 18px; font-weight: 700; color: #333; }
        .disc-summary-item .ds-value.green { color: #2e7d32; }
        .disc-summary-item .ds-value.blue { color: #1565c0; }
        .disc-summary-item .ds-sub { font-size: 12px; color: #aaa; margin-top: 2px; }

        /* Action buttons */
        .actions { display: flex; justify-content: center; gap: 12px; margin-top: 24px; padding: 20px 0; }
        .act-btn { padding: 12px 32px; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
        .act-btn.print { background: #5cb85c; color: white; }
        .act-btn.print:hover { background: #4cae4c; }
        .act-btn.pay { background: #5cb85c; color: white; }
        .act-btn.pay:hover { background: #4cae4c; }
        .act-btn.exit { background: #f5f5f5; color: #666; border: 1px solid #ddd; }
        .act-btn.exit:hover { background: #eee; }

        /* Responsive */
        @media (max-width: 768px) {
          .pad-bar-body { flex-direction: column; align-items: flex-start; }
          .disc-summary { flex-direction: column; }
          .disc-summary-item { border-right: none; border-bottom: 1px solid #eee; }
          .dc-grp { min-width: 100%; }
        }
      `}</style>

      <div className="mc">
        {/* ===== DEMO CONTROLS ===== */}
        <div className="demo-ctrl">
          <h5>&#9881; Panel de Control (Demo - No visible para el usuario final)</h5>
          <div className="dc-row">
            <div className="dc-grp">
              <label>Puntos acumulados: <span className="dc-val">{points}</span></label>
              <input type="range" min={0} max={1000} step={10} value={points} onChange={(e) => { setPoints(+e.target.value); setChosenDiscount(Math.min(chosenDiscount, Math.floor(+e.target.value / 100))); }} />
              <span className="dc-hint">0 - 1000 puntos (max descuento: {maxDiscount}%)</span>
            </div>
            <div className="dc-grp">
              <label>Nombre contribuyente:</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="form-control input-sm" style={{ marginTop: 4 }} />
            </div>
            <div className="dc-grp">
              <label>Cuenta:</label>
              <input type="text" value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="form-control input-sm" style={{ marginTop: 4 }} />
            </div>
          </div>
          <div className="dc-row" style={{ marginTop: 10 }}>
            <div className="dc-grp">
              <label>CUIT:</label>
              <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)} className="form-control input-sm" />
            </div>
            <div className="dc-grp" style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn-rst" onClick={resetDemo}>&#8634; Reiniciar Demo</button>
            </div>
          </div>
        </div>

        {/* ===== HEADER ===== */}
        <div className="hdr">
          <h3>Tasa por Servicio a la Propiedad</h3>
          <span className="badge">Deuda: {fmt(totals.all.total)}</span>
        </div>

        {/* ===== INFO ===== */}
        <div className="info">
          <table>
            <tbody>
              <tr>
                <td className="lc">Contribuyente</td>
                <td>{nombre}</td>
                <td className="lc">Cuenta</td>
                <td>{cuenta}</td>
              </tr>
              <tr>
                <td className="lc">Documento</td>
                <td>CUIT {cuit}</td>
                <td className="lc" colSpan={2}></td>
              </tr>
              <tr>
                <td className="lc">Titular/es</td>
                <td colSpan={3}>{nombre}</td>
              </tr>
              <tr>
                <td className="lc">Dirección Electrónica</td>
                <td colSpan={3}>Cuenta No Adherida</td>
              </tr>
              <tr>
                <td className="lc">Nro. Pago Electrónico Link</td>
                <td>10353602305080</td>
                <td className="lc">Nro. Pago Electrónico Banelco</td>
                <td>0002305080</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== PAD REWARDS BAR ===== */}
        <div className="pad-bar">
          <div className="pad-bar-hdr">
            <span style={{ fontSize: 22 }}>&#9734;</span>
            Participación Activa Digital
          </div>
          <div className="pad-bar-body">
            <div className="ps">
              <div className="ps-circle">{points}</div>
              <div className="ps-info">
                <div className="sub">Tus puntos acumulados</div>
                <div className="vl">{points} puntos</div>
                <div className="ps-prog">
                  <div className="ps-prog-fill" style={{ width: `${points % 100}%` }}></div>
                </div>
                <div className="sub">{100 - (points % 100)} pts para +1%</div>
              </div>
            </div>
            <div className="ps">
              <div className="ps-circle">{maxDiscount}%</div>
              <div className="ps-info">
                <div className="sub">Descuento disponible</div>
                <div className="vl">{maxDiscount}%</div>
                <div className="sub">100 pts = 1% de descuento</div>
              </div>
            </div>
            <button className="pad-cta" onClick={() => window.open("https://pad-dev.datainsights.com.ar/survey/5a986dda-437e-40ae-a43e-3ad72ec54fb9", "_blank")}>
              &#128203; Completar Consulta y Ganá <span style={{ fontSize: 20 }}>&#8250;</span>
            </button>
          </div>
        </div>

        {/* ===== PFP ===== */}
        <div className="pfp">
          <strong>Sr. Contribuyente</strong>, si usted desea regularizar su deuda mediante un plan de facilidades de pago (PFP), haga clic <a href="#">Aquí</a>
        </div>

        {/* ===== DEBT TABLE ===== */}
        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>Período</th>
                <th>Descripción</th>
                <th>Boleta</th>
                <th>Vencimiento</th>
                <th className="ar">Histórico</th>
                <th className="ar">Rec/Desc</th>
                <th className="ar">Total</th>
                <th className="ac" style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size === DEBT_DATA.length} onChange={selectAll} title="Seleccionar todo" />
                </th>
              </tr>
            </thead>
            <tbody>
              {DEBT_DATA.map((row) => {
                const isSel = selected.has(row.boleta);
                return (
                  <tr key={row.boleta} className={isSel ? "row-selected" : ""}>
                    <td>{row.periodo}</td>
                    <td>{row.desc}</td>
                    <td>{row.boleta}</td>
                    <td>{row.venc}</td>
                    <td className="ar">{fmt(row.historico)}</td>
                    <td className="ar">
                      {row.recargo > 0 ? <span className="red">{fmt(row.recargo)}</span> : fmt(row.recargo)}
                    </td>
                    <td className="ar">
                      {row.recargo > 0 ? <span className="red">{fmt(row.total)}</span> : fmt(row.total)}
                    </td>
                    <td className="ac">
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(row.boleta)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }}>Totales:</td>
                <td className="ar">{fmt(totals.all.historico)}</td>
                <td className="ar">{fmt(totals.all.recargo)}</td>
                <td className="ar">{fmt(totals.all.total)}</td>
                <td className="ac">{DEBT_DATA.length}</td>
              </tr>
              <tr className="sel-row">
                <td colSpan={4} style={{ textAlign: "right" }}>Seleccionados:</td>
                <td className="ar"></td>
                <td className="ar"></td>
                <td className="ar">
                  <span className={`sel-badge ${hasSelection ? "green" : ""}`}>
                    {hasSelection ? fmt(totals.sel.total) : "0,00"}
                  </span>
                </td>
                <td className="ac">
                  <span className={`sel-badge ${hasSelection ? "blue" : ""}`}>
                    {selectedCount}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Boletas vencidas + Actualizado */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
            <div className="venc-info">
              <span className="venc-dot"></span> Boletas vencidas
            </div>
            <div className="updated-info">
              Actualizado al: <strong>{today}</strong>
            </div>
          </div>
        </div>

        {/* ===== DISCOUNT SECTION (visible when selection > 0) ===== */}
        {hasSelection && maxDiscount > 0 && (
          <div className="disc-section">
            <div className="disc-hdr">
              <div className="disc-hdr-left">
                <span className="icon">&#10003;</span>
                Aplicar descuento por consultas
              </div>
              <div className="disc-hdr-right">
                {points} puntos disponibles (max {maxDiscount}%)
              </div>
            </div>
            <div className="disc-body">
              {/* Discount buttons */}
              <div className="disc-btns">
                <button
                  className={`disc-btn ${chosenDiscount === 0 ? "active" : ""}`}
                  onClick={() => setChosenDiscount(0)}
                >
                  Sin descuento
                </button>
                {Array.from({ length: maxDiscount }, (_, i) => i + 1).map((pct) => (
                  <button
                    key={pct}
                    className={`disc-btn ${chosenDiscount === pct ? "active" : ""}`}
                    onClick={() => setChosenDiscount(pct)}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div className="disc-slider-wrap">
                <input
                  type="range"
                  className="disc-slider"
                  min={0}
                  max={maxDiscount}
                  step={1}
                  value={chosenDiscount}
                  onChange={(e) => setChosenDiscount(+e.target.value)}
                  style={{
                    background: `linear-gradient(to right, #43a047 0%, #43a047 ${maxDiscount > 0 ? (chosenDiscount / maxDiscount) * 100 : 0}%, #e0e0e0 ${maxDiscount > 0 ? (chosenDiscount / maxDiscount) * 100 : 0}%, #e0e0e0 100%)`,
                  }}
                />
                <div className="disc-slider-labels">
                  <span>0%</span>
                  <span>{maxDiscount}%</span>
                </div>
              </div>

              {/* Summary */}
              <div className="disc-summary">
                <div className="disc-summary-item">
                  <div className="ds-label">Descuento</div>
                  <div className="ds-value">{chosenDiscount}%</div>
                </div>
                <div className="disc-summary-item">
                  <div className="ds-label">Ahorro</div>
                  <div className="ds-value green">{chosenDiscount > 0 ? `-${fmt(ahorro)}` : "0,00"}</div>
                </div>
                <div className="disc-summary-item">
                  <div className="ds-label">Total Final</div>
                  <div className="ds-value blue">{fmt(totalFinal)}</div>
                </div>
                <div className="disc-summary-item">
                  <div className="ds-label">Puntos a usar</div>
                  <div className="ds-value">{puntosAUsar} de {points}</div>
                  <div className="ds-sub">Restantes: {puntosRestantes} pts</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTION BUTTONS ===== */}
        <div className="actions">
          <button className="act-btn print">Imprimir</button>
          <button className="act-btn pay">Pagar</button>
          <button className="act-btn exit">Salir</button>
        </div>
      </div>
    </>
  );
}
