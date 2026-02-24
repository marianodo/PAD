/**
 * PAD - Módulo 2: Aplicador de Descuento
 *
 * Lee el total seleccionado de la página del municipio, permite al contribuyente
 * elegir qué porcentaje de descuento aplicar (según sus puntos), y sobreescribe
 * el total en la página.
 *
 * Depende del Módulo 1 (pad-rewards-banner.js) para conocer los puntos disponibles,
 * o se puede inicializar directamente pasando los puntos.
 *
 * USO:
 *   <div id="pad-discount-applicator"></div>
 *   <script src="pad-rewards-banner.js"></script>
 *   <script src="pad-discount-applicator.js"></script>
 *   <script>
 *     PADDiscountApplicator.init({
 *       container: '#pad-discount-applicator',
 *       // Selector del elemento que contiene el total seleccionado (el módulo lee su texto)
 *       totalSelector: '#total-seleccionados',
 *       // Selector donde sobreescribir el total con descuento (puede ser el mismo)
 *       targetSelector: '#total-seleccionados',
 *       // Opcional: si no usa el módulo 1, pasar los puntos directamente
 *       // availablePoints: 350
 *     });
 *   </script>
 *
 * EVENTOS:
 *   - Escucha 'pad:points-loaded' del Módulo 1 para obtener puntos automáticamente.
 *   - Dispara 'pad:discount-applied' con detail: { discount, ahorro, totalFinal, puntosUsados }
 *     cuando el contribuyente elige un descuento.
 */
(function () {
  "use strict";

  var PADDiscountApplicator = {
    _config: null,
    _availablePoints: 0,
    _chosenDiscount: 0,
    _originalTotal: 0,
    _containerEl: null,
    _observer: null,

    /**
     * Inicializa el aplicador de descuento.
     * @param {Object} config
     * @param {string} config.container - Selector del contenedor donde se renderiza el widget
     * @param {string} config.totalSelector - Selector del elemento con el total seleccionado
     * @param {string} [config.targetSelector] - Selector donde escribir el total con descuento (default = totalSelector)
     * @param {number} [config.availablePoints] - Puntos disponibles (si no viene del Módulo 1)
     */
    init: function (config) {
      this._config = config;
      this._containerEl = document.querySelector(config.container);

      if (!this._containerEl) {
        console.error('[PAD Discount] Contenedor no encontrado:', config.container);
        return;
      }

      // Si se pasan puntos directamente, usarlos
      if (typeof config.availablePoints === 'number') {
        this._availablePoints = config.availablePoints;
      }

      // Escuchar puntos del Módulo 1
      var self = this;
      document.addEventListener('pad:points-loaded', function (e) {
        var data = e.detail || e;
        self._availablePoints = data.available_points || 0;
        self._update();
      });

      // Si ya hay datos del Módulo 1
      if (window.PADRewardsBanner && window.PADRewardsBanner.getData()) {
        this._availablePoints = window.PADRewardsBanner.getData().available_points || 0;
      }

      // Observar cambios en el total seleccionado (cuando el usuario tilda/destilda boletas)
      this._watchTotal();

      // Render inicial
      this._update();
    },

    _watchTotal: function () {
      var self = this;
      var totalEl = document.querySelector(this._config.totalSelector);

      if (!totalEl) {
        console.warn('[PAD Discount] Elemento de total no encontrado:', this._config.totalSelector);
        return;
      }

      // MutationObserver para detectar cambios en el total
      if (window.MutationObserver) {
        this._observer = new MutationObserver(function () {
          self._update();
        });
        this._observer.observe(totalEl, { childList: true, characterData: true, subtree: true });
      }

      // Fallback: polling cada 500ms
      setInterval(function () {
        var newTotal = self._readTotal();
        if (newTotal !== self._originalTotal) {
          self._update();
        }
      }, 500);
    },

    _readTotal: function () {
      var el = document.querySelector(this._config.totalSelector);
      if (!el) return 0;

      var text = el.textContent || el.innerText || '';
      // Parsear formato argentino: "58.266,04" -> 58266.04
      text = text.replace(/[^\d.,]/g, '');       // Dejar solo dígitos, puntos, comas
      text = text.replace(/\./g, '');             // Quitar separadores de miles
      text = text.replace(',', '.');              // Coma decimal -> punto
      return parseFloat(text) || 0;
    },

    _update: function () {
      this._originalTotal = this._readTotal();
      var maxDiscount = Math.floor(this._availablePoints / 100);

      // Solo mostrar si hay puntos Y hay un total seleccionado
      if (maxDiscount === 0 || this._originalTotal === 0) {
        this._containerEl.innerHTML = '';
        return;
      }

      // Asegurar que el descuento elegido no supere el máximo
      if (this._chosenDiscount > maxDiscount) {
        this._chosenDiscount = maxDiscount;
      }

      this._render(maxDiscount);
    },

    _applyDiscount: function (pct) {
      this._chosenDiscount = pct;
      var maxDiscount = Math.floor(this._availablePoints / 100);
      this._render(maxDiscount);
      this._overwriteTotal();
      this._dispatchEvent();
    },

    _overwriteTotal: function () {
      var targetSelector = this._config.targetSelector || this._config.totalSelector;
      var targetEl = document.querySelector(targetSelector);
      if (!targetEl) return;

      if (this._chosenDiscount === 0) {
        // Restaurar original
        targetEl.textContent = this._formatMoney(this._originalTotal);
        targetEl.style.color = '';
        targetEl.style.fontWeight = '';
      } else {
        var totalFinal = this._originalTotal - (this._originalTotal * this._chosenDiscount / 100);
        targetEl.textContent = this._formatMoney(totalFinal);
        targetEl.style.color = '#2e7d32';
        targetEl.style.fontWeight = 'bold';
      }
    },

    _dispatchEvent: function () {
      var ahorro = this._originalTotal * this._chosenDiscount / 100;
      var totalFinal = this._originalTotal - ahorro;
      var puntosUsados = this._chosenDiscount * 100;

      var detail = {
        discount: this._chosenDiscount,
        ahorro: ahorro,
        totalFinal: totalFinal,
        totalOriginal: this._originalTotal,
        puntosUsados: puntosUsados,
        puntosRestantes: this._availablePoints - puntosUsados
      };

      var event;
      try {
        event = new CustomEvent('pad:discount-applied', { detail: detail });
      } catch (e) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('pad:discount-applied', true, true, detail);
      }
      document.dispatchEvent(event);
    },

    _formatMoney: function (n) {
      // Formato argentino: 58.266,04
      var parts = n.toFixed(2).split('.');
      var intPart = parts[0];
      var decPart = parts[1];
      var formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return formatted + ',' + decPart;
    },

    _render: function (maxDiscount) {
      var ahorro = this._originalTotal * this._chosenDiscount / 100;
      var totalFinal = this._originalTotal - ahorro;
      var puntosUsados = this._chosenDiscount * 100;
      var puntosRestantes = this._availablePoints - puntosUsados;
      var sliderPct = maxDiscount > 0 ? (this._chosenDiscount / maxDiscount) * 100 : 0;

      // Botones de porcentaje
      var btnsHtml = '<button class="pad-da-btn' + (this._chosenDiscount === 0 ? ' active' : '') +
        '" data-pct="0">Sin descuento</button>';
      for (var i = 1; i <= maxDiscount; i++) {
        btnsHtml += '<button class="pad-da-btn' + (this._chosenDiscount === i ? ' active' : '') +
          '" data-pct="' + i + '">' + i + '%</button>';
      }

      var html = '' +
        '<div class="pad-da-wrap">' +
          // Header
          '<div class="pad-da-hdr">' +
            '<div class="pad-da-hdr-left">' +
              '<span class="pad-da-icon">&#10003;</span> ' +
              'Aplicar descuento por encuestas' +
            '</div>' +
            '<div class="pad-da-hdr-right">' +
              this._availablePoints + ' puntos disponibles (max ' + maxDiscount + '%)' +
            '</div>' +
          '</div>' +
          // Body
          '<div class="pad-da-body">' +
            // Botones
            '<div class="pad-da-btns">' + btnsHtml + '</div>' +
            // Slider
            '<div class="pad-da-slider-wrap">' +
              '<input type="range" class="pad-da-slider" min="0" max="' + maxDiscount + '" step="1" value="' + this._chosenDiscount + '"' +
              ' style="background:linear-gradient(to right,#43a047 0%,#43a047 ' + sliderPct + '%,#e0e0e0 ' + sliderPct + '%,#e0e0e0 100%)">' +
              '<div class="pad-da-slider-labels"><span>0%</span><span>' + maxDiscount + '%</span></div>' +
            '</div>' +
            // Resumen
            '<div class="pad-da-summary">' +
              '<div class="pad-da-summary-item">' +
                '<div class="pad-da-label">DESCUENTO</div>' +
                '<div class="pad-da-value">' + this._chosenDiscount + '%</div>' +
              '</div>' +
              '<div class="pad-da-summary-item">' +
                '<div class="pad-da-label">AHORRO</div>' +
                '<div class="pad-da-value green">' + (this._chosenDiscount > 0 ? '-' + this._formatMoney(ahorro) : '0,00') + '</div>' +
              '</div>' +
              '<div class="pad-da-summary-item">' +
                '<div class="pad-da-label">TOTAL FINAL</div>' +
                '<div class="pad-da-value blue">' + this._formatMoney(totalFinal) + '</div>' +
              '</div>' +
              '<div class="pad-da-summary-item">' +
                '<div class="pad-da-label">PUNTOS A USAR</div>' +
                '<div class="pad-da-value">' + puntosUsados + ' de ' + this._availablePoints + '</div>' +
                '<div class="pad-da-sub">Restantes: ' + puntosRestantes + ' pts</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      this._containerEl.innerHTML = html;

      // Bind eventos
      var self = this;

      // Botones
      var buttons = this._containerEl.querySelectorAll('.pad-da-btn');
      for (var j = 0; j < buttons.length; j++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            self._applyDiscount(parseInt(btn.getAttribute('data-pct'), 10));
          });
        })(buttons[j]);
      }

      // Slider
      var slider = this._containerEl.querySelector('.pad-da-slider');
      if (slider) {
        slider.addEventListener('input', function () {
          self._applyDiscount(parseInt(slider.value, 10));
        });
      }
    }
  };

  // Inyectar estilos
  var css = '' +
    '.pad-da-wrap{margin:20px 0;border:2px solid #c8e6c9;border-radius:10px;overflow:hidden;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
    '.pad-da-hdr{background:#fff;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8e8e8;flex-wrap:wrap;gap:8px}' +
    '.pad-da-hdr-left{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:600;color:#333}' +
    '.pad-da-icon{width:28px;height:28px;background:#e8f5e9;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#43a047;font-size:16px}' +
    '.pad-da-hdr-right{font-size:14px;color:#888}' +
    '.pad-da-body{padding:20px 24px}' +
    '.pad-da-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}' +
    '.pad-da-btn{padding:8px 20px;border-radius:20px;border:2px solid #ddd;background:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;color:#555}' +
    '.pad-da-btn:hover{border-color:#43a047;color:#43a047}' +
    '.pad-da-btn.active{background:#43a047;color:#fff;border-color:#43a047}' +
    '.pad-da-slider-wrap{margin:12px 0 8px}' +
    '.pad-da-slider{width:100%;-webkit-appearance:none;appearance:none;height:8px;border-radius:4px;outline:none}' +
    '.pad-da-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid #43a047;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.15)}' +
    '.pad-da-slider::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid #43a047;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.15)}' +
    '.pad-da-slider-labels{display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-top:2px}' +
    '.pad-da-summary{display:flex;gap:0;margin-top:16px;background:#fafafa;border:1px solid #eee;border-radius:8px;overflow:hidden}' +
    '.pad-da-summary-item{flex:1;padding:14px 16px;border-right:1px solid #eee}' +
    '.pad-da-summary-item:last-child{border-right:none}' +
    '.pad-da-label{font-size:11px;text-transform:uppercase;color:#999;font-weight:600;letter-spacing:.5px;margin-bottom:4px}' +
    '.pad-da-value{font-size:18px;font-weight:700;color:#333}' +
    '.pad-da-value.green{color:#2e7d32}' +
    '.pad-da-value.blue{color:#1565c0}' +
    '.pad-da-sub{font-size:12px;color:#aaa;margin-top:2px}' +
    '@media(max-width:768px){.pad-da-summary{flex-direction:column}.pad-da-summary-item{border-right:none;border-bottom:1px solid #eee}.pad-da-summary-item:last-child{border-bottom:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.PADDiscountApplicator = PADDiscountApplicator;
})();
