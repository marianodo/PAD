/**
 * PAD - Módulo 1: Banner de Recompensas
 *
 * Muestra los puntos acumulados del contribuyente y un botón para completar encuestas.
 * Recibe el JSON que el backend del municipio obtiene de la API PAD:
 *   GET /api/v1/integration/points/{cuil}
 *   Header: X-API-Key: <api_key>
 *
 * Respuesta esperada:
 *   { "cuil": "20334455660", "total_points": 400, "available_points": 350, "redeemed_points": 50 }
 *
 * USO:
 *   <div id="pad-rewards-banner"></div>
 *   <script src="pad-rewards-banner.js"></script>
 *   <script>
 *     PADRewardsBanner.init({
 *       container: '#pad-rewards-banner',
 *       surveyUrl: 'https://pad-usuarios.datainsights.com.ar/survey/5a986dda-437e-40ae-a43e-3ad72ec54fb9',
 *       data: {
 *         cuil: '20334455660',
 *         total_points: 400,
 *         available_points: 350,
 *         redeemed_points: 50
 *       }
 *     });
 *   </script>
 */
(function () {
  "use strict";

  var PADRewardsBanner = {
    _data: null,

    /**
     * Inicializa el banner.
     * @param {Object} config
     * @param {string} config.container - Selector CSS del contenedor
     * @param {string} config.surveyUrl - URL completa de la encuesta del cliente
     * @param {Object} config.data - JSON de respuesta de la API PAD /integration/points/{cuil}
     * @param {number} config.data.available_points - Puntos disponibles
     * @param {number} config.data.total_points - Puntos totales acumulados
     * @param {number} config.data.redeemed_points - Puntos ya canjeados
     */
    init: function (config) {
      var container = document.querySelector(config.container);
      if (!container) {
        console.error('[PAD] Contenedor no encontrado:', config.container);
        return;
      }

      if (!config.data) {
        console.error('[PAD] Se requiere config.data con los puntos del contribuyente');
        return;
      }

      this._data = config.data;
      container.innerHTML = this._render(config.data, config.surveyUrl);

      // Disparar evento para que el módulo de descuento lea los puntos disponibles
      var event;
      try {
        event = new CustomEvent('pad:points-loaded', { detail: config.data });
      } catch (e) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('pad:points-loaded', true, true, config.data);
      }
      document.dispatchEvent(event);
    },

    /** Devuelve los datos cargados (para uso desde el módulo 2) */
    getData: function () {
      return this._data;
    },

    _render: function (data, surveyUrl) {
      var available = data.available_points || 0;
      var maxDiscount = Math.floor(available / 100);
      var ptsInCurrent = available % 100;
      var ptsNeeded = ptsInCurrent === 0 && available === 0 ? 100 : (ptsInCurrent === 0 ? 100 : 100 - ptsInCurrent);
      var progressPct = ptsInCurrent;

      return '' +
        '<div class="pad-rw-wrap">' +
          '<div class="pad-rw-header">' +
            '<span style="font-size:20px;">&#9734;</span> ' +
            'Programa de Encuestas y Recompensas' +
          '</div>' +
          '<div class="pad-rw-body">' +
            // Puntos
            '<div class="pad-rw-stat">' +
              '<div class="pad-rw-circle">' + available + '</div>' +
              '<div>' +
                '<div class="pad-rw-sub">Tus puntos acumulados</div>' +
                '<div class="pad-rw-val">' + available + ' puntos</div>' +
                '<div class="pad-rw-progress"><div class="pad-rw-progress-fill" style="width:' + progressPct + '%;"></div></div>' +
                '<div class="pad-rw-sub">' + ptsNeeded + ' pts para +1%</div>' +
              '</div>' +
            '</div>' +
            // Descuento
            '<div class="pad-rw-stat">' +
              '<div class="pad-rw-circle">' + maxDiscount + '%</div>' +
              '<div>' +
                '<div class="pad-rw-sub">Descuento disponible</div>' +
                '<div class="pad-rw-val">' + maxDiscount + '%</div>' +
                '<div class="pad-rw-sub">100 pts = 1% de descuento</div>' +
              '</div>' +
            '</div>' +
            // CTA
            '<a href="' + surveyUrl + '" target="_blank" class="pad-rw-cta">' +
              '&#128203; Completar Encuesta &#8250;' +
            '</a>' +
          '</div>' +
        '</div>';
    }
  };

  // Inyectar estilos
  var css = '' +
    '.pad-rw-wrap{margin:20px 0;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    '.pad-rw-header{background:linear-gradient(135deg,#1565c0,#1976d2,#2196f3);color:#fff;padding:14px 24px;display:flex;align-items:center;gap:10px;font-size:18px;font-weight:600}' +
    '.pad-rw-body{background:#fff;padding:20px 30px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}' +
    '.pad-rw-stat{display:flex;align-items:center;gap:14px}' +
    '.pad-rw-circle{width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;background:linear-gradient(135deg,#43a047,#66bb6a);box-shadow:0 3px 8px rgba(67,160,71,.3)}' +
    '.pad-rw-sub{color:#888;font-size:13px}' +
    '.pad-rw-val{font-size:18px;font-weight:700;color:#333}' +
    '.pad-rw-progress{width:130px;height:6px;background:#e0e0e0;border-radius:3px;margin-top:4px;overflow:hidden}' +
    '.pad-rw-progress-fill{height:100%;background:linear-gradient(90deg,#1976d2,#42a5f5);border-radius:3px}' +
    '.pad-rw-cta{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s}' +
    '.pad-rw-cta:hover{background:linear-gradient(135deg,#0d47a1,#1565c0);transform:translateY(-1px);box-shadow:0 4px 12px rgba(21,101,192,.3)}' +
    '@media(max-width:768px){.pad-rw-body{flex-direction:column;align-items:flex-start}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.PADRewardsBanner = PADRewardsBanner;
})();
