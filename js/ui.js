/**
 * ui.js — DOM rendering for stats, controls, messages.
 * IlovePDF vibe: cards for Model Info, Preview, Scale.
 */

const UI = (function () {
  'use strict';

  const SCALE_INCH_TO_MM = 25.4;
  const SCALE_MM_TO_INCH = 1 / 25.4;

  const PRINTERS = [
    { key: 'ender3', label: 'Ender 3', x: 220, y: 220, z: 250 },
    { key: 'prusa_mk3', label: 'Prusa MK3', x: 250, y: 210, z: 210 },
    { key: 'bambu_p1p', label: 'Bambu P1P/X1', x: 256, y: 256, z: 256 },
    { key: 'bambu_a1mini', label: 'Bambu A1 mini', x: 180, y: 180, z: 180 },
    { key: 'custom', label: 'Custom…', x: 220, y: 220, z: 250, custom: true }
  ];

  let elements = {};
  let bannerDismissed = false;
  let unitSuggestionDismissed = false;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatDim(value) {
    return typeof value === 'number' ? value.toFixed(2) : '—';
  }

  function createElement(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }

  function init(container) {
    const app = createElement('div', 'app');

    const header = createElement('header', 'header');
    header.innerHTML = `
      <div class="header-content">
        <h1>Fix STL Scale Online</h1>
        <p class="tagline">Fix scale. Preview. Download.</p>
      </div>
      <button type="button" class="btn btn-bookmark" id="btn-bookmark">Bookmark this tool</button>
    `;
    app.appendChild(header);

    const bookmarkToast = createElement('div', 'bookmark-toast hidden', '');
    bookmarkToast.id = 'bookmark-toast';
    app.appendChild(bookmarkToast);

    const dropzone = createElement('div', 'dropzone');
    dropzone.innerHTML = '<p class="dropzone-text">Drag & drop an STL file here</p><p class="dropzone-sub">or</p><button type="button" class="btn btn-primary" id="btn-choose">Choose file</button><input type="file" id="file-input" accept=".stl" style="display:none">';
    app.appendChild(dropzone);

    const message = createElement('div', 'message hidden', '');
    message.id = 'message';
    app.appendChild(message);

    const cards = createElement('div', 'cards hidden');
    cards.id = 'cards';

    const modelCard = createElement('div', 'card');
    modelCard.innerHTML = `
      <h2>Model Info</h2>
      <div class="unit-toggle">
        <span>Display units:</span>
        <label><input type="radio" name="display-unit" value="mm" checked> mm</label>
        <label><input type="radio" name="display-unit" value="inch"> inch</label>
      </div>
      <label class="bbox-toggle">
        <input type="checkbox" id="bboxToggle">
        <span>Show bounding box</span>
      </label>
      <div class="stats" id="model-stats"></div>
      <div class="size-sanity hidden" id="size-sanity"></div>
    `;
    cards.appendChild(modelCard);

    const printerFitCard = createElement('div', 'card');
    printerFitCard.innerHTML = `
      <h2>Printer Fit</h2>
      <div class="printer-fit-controls">
        <label class="printer-select-label">Select printer:</label>
        <select id="printer-select" class="printer-select">
          ${PRINTERS.filter(p => !p.custom).map(p =>
            `<option value="${p.key}">${p.label} (${p.x}×${p.y}×${p.z} mm)</option>`
          ).join('')}
          <option value="custom">Custom…</option>
        </select>
        <div class="printer-custom hidden" id="printer-custom">
          <div class="printer-custom-inputs">
            <label>X <input type="number" id="build-x" value="220" min="1" step="1"></label>
            <label>Y <input type="number" id="build-y" value="220" min="1" step="1"></label>
            <label>Z <input type="number" id="build-z" value="250" min="1" step="1"></label>
            <span class="printer-custom-unit">mm</span>
          </div>
        </div>
        <div class="fit-result" id="fit-result"></div>
      </div>
    `;
    cards.appendChild(printerFitCard);

    const modelCheckCard = createElement('div', 'card');
    modelCheckCard.innerHTML = `
      <h2>Model Check</h2>
      <div class="model-check-panel" id="model-check-panel">
        <div class="model-check-stats" id="model-check-stats"></div>
        <ul class="model-check-warnings hidden" id="model-check-warnings"></ul>
      </div>
    `;
    cards.appendChild(modelCheckCard);

    const previewCard = createElement('div', 'card');
    previewCard.innerHTML = '<h2>Preview</h2><div class="preview-container" id="preview-container"></div>';
    cards.appendChild(previewCard);

    const orientationCard = createElement('div', 'card');
    orientationCard.innerHTML = `
      <h2>Orientation</h2>
      <div class="orientation-controls">
        <div class="orientation-buttons">
          <button type="button" class="btn btn-orient" id="rot-x-plus">Rotate X +90°</button>
          <button type="button" class="btn btn-orient" id="rot-x-minus">Rotate X -90°</button>
          <button type="button" class="btn btn-orient" id="rot-y-plus">Rotate Y +90°</button>
          <button type="button" class="btn btn-orient" id="rot-y-minus">Rotate Y -90°</button>
          <button type="button" class="btn btn-orient" id="rot-z-plus">Rotate Z +90°</button>
          <button type="button" class="btn btn-orient" id="rot-z-minus">Rotate Z -90°</button>
          <button type="button" class="btn btn-secondary" id="btn-reset-orient">Reset orientation</button>
        </div>
      </div>
    `;
    cards.appendChild(orientationCard);

    const scaleCard = createElement('div', 'card');
    scaleCard.innerHTML = `
      <h2>Scale</h2>
      <div class="suggestion-banner hidden" id="suggestion-banner">
        <span class="suggestion-text" id="suggestion-text"></span>
        <button type="button" class="btn btn-scale suggestion-apply" id="btn-suggestion-apply"></button>
        <button type="button" class="suggestion-dismiss" id="suggestion-dismiss" aria-label="Dismiss">×</button>
      </div>
      <div class="scale-controls">
        <div class="scale-buttons">
          <button type="button" class="btn btn-scale" id="btn-inch-to-mm">Inch → mm ×25.4</button>
          <button type="button" class="btn btn-scale" id="btn-mm-to-inch">mm → Inch ÷25.4</button>
        </div>
        <p class="scale-hint">Too small in slicer? Try ×25.4. Too big? Try ÷25.4.</p>
        <div class="custom-scale">
          <label>Custom factor:</label>
          <input type="number" id="custom-factor" step="0.01" value="1" placeholder="1.0">
          <button type="button" class="btn btn-apply" id="btn-apply-scale">Apply</button>
        </div>
        <label class="center-toggle">
          <input type="checkbox" id="center-model" value="1">
          <span>Center model (move to origin)</span>
        </label>
        <div class="actions">
          <button type="button" class="btn btn-secondary" id="btn-reset">Reset to original</button>
          <button type="button" class="btn btn-secondary" id="btn-fit-view">Fit view</button>
          <button type="button" class="btn btn-download" id="btn-download" disabled>Download corrected STL</button>
        </div>
      </div>
    `;
    cards.appendChild(scaleCard);

    app.appendChild(cards);
    container.appendChild(app);

    elements = {
      dropzone,
      message,
      cards,
      modelStats: document.getElementById('model-stats'),
      sizeSanity: document.getElementById('size-sanity'),
      printerSelect: document.getElementById('printer-select'),
      printerCustom: document.getElementById('printer-custom'),
      buildX: document.getElementById('build-x'),
      buildY: document.getElementById('build-y'),
      buildZ: document.getElementById('build-z'),
      fitResult: document.getElementById('fit-result'),
      modelCheckStats: document.getElementById('model-check-stats'),
      modelCheckWarnings: document.getElementById('model-check-warnings'),
      previewContainer: document.getElementById('preview-container'),
      btnChoose: document.getElementById('btn-choose'),
      fileInput: document.getElementById('file-input'),
      btnInchToMm: document.getElementById('btn-inch-to-mm'),
      btnMmToInch: document.getElementById('btn-mm-to-inch'),
      customFactor: document.getElementById('custom-factor'),
      btnApplyScale: document.getElementById('btn-apply-scale'),
      btnReset: document.getElementById('btn-reset'),
      btnFitView: document.getElementById('btn-fit-view'),
      btnDownload: document.getElementById('btn-download'),
      suggestionBanner: document.getElementById('suggestion-banner'),
      suggestionText: document.getElementById('suggestion-text'),
      btnSuggestionApply: document.getElementById('btn-suggestion-apply'),
      suggestionDismiss: document.getElementById('suggestion-dismiss'),
      centerModel: document.getElementById('center-model'),
      unitMm: document.querySelector('input[name="display-unit"][value="mm"]'),
      unitInch: document.querySelector('input[name="display-unit"][value="inch"]'),
      bboxToggle: document.getElementById('bboxToggle'),
      btnBookmark: document.getElementById('btn-bookmark'),
      bookmarkToast: document.getElementById('bookmark-toast'),
      rotXPlus: document.getElementById('rot-x-plus'),
      rotXMinus: document.getElementById('rot-x-minus'),
      rotYPlus: document.getElementById('rot-y-plus'),
      rotYMinus: document.getElementById('rot-y-minus'),
      rotZPlus: document.getElementById('rot-z-plus'),
      rotZMinus: document.getElementById('rot-z-minus'),
      btnResetOrient: document.getElementById('btn-reset-orient')
    };

    elements.suggestionDismiss.addEventListener('click', function () {
      bannerDismissed = true;
      unitSuggestionDismissed = true;
      elements.suggestionBanner.classList.add('hidden');
    });

    elements.printerSelect.addEventListener('change', function () {
      const isCustom = elements.printerSelect.value === 'custom';
      elements.printerCustom.classList.toggle('hidden', !isCustom);
    });

    return elements;
  }

  function showMessage(text, isError) {
    const msg = elements.message;
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'message ' + (isError ? 'error' : 'info');
    msg.classList.remove('hidden');
  }

  function hideMessage() {
    if (elements.message) {
      elements.message.classList.add('hidden');
    }
  }

  function showCards() {
    if (elements.cards) elements.cards.classList.remove('hidden');
  }

  function hideCards() {
    if (elements.cards) elements.cards.classList.add('hidden');
  }

  function renderModelStats(data) {
    const el = elements.modelStats;
    if (!el) return;

    const bbox = data.bbox;
    const displayUnit = data.displayUnit || 'mm';
    const toInch = (v) => (v != null ? (Number(v) / 25.4).toFixed(3) : '—');
    const toMm = (v) => (v != null ? Number(v).toFixed(2) : '—');
    const fmt = displayUnit === 'inch' ? toInch : toMm;
    const suffix = displayUnit === 'inch' ? ' in' : ' mm';
    const sizeWarn = data.sizeWarning ? '<p class="size-warning">Large file; processing may be slow.</p>' : '';

    el.innerHTML = `
      <dl class="stat-list">
        <dt>Format</dt><dd>${data.format === 'ascii' ? 'ASCII' : 'Binary'}</dd>
        <dt>File size</dt><dd>${formatBytes(data.fileSizeBytes)}</dd>
        <dt>Triangles</dt><dd>${data.triangleCount.toLocaleString()}</dd>
        <dt>Bounding box (X × Y × Z)</dt><dd>${fmt(bbox.size.x)} × ${fmt(bbox.size.y)} × ${fmt(bbox.size.z)}${suffix}</dd>
      </dl>
      ${sizeWarn}
    `;
  }

  function updateSizeSanity(bbox, displayUnit) {
    const el = elements.sizeSanity;
    if (!el) return;

    if (!bbox) {
      el.classList.add('hidden');
      return;
    }

    const largest_mm = Math.max(bbox.size.x, bbox.size.y, bbox.size.z);
    const unit = displayUnit || 'mm';
    const displayValue = unit === 'inch'
      ? (largest_mm / 25.4).toFixed(3)
      : largest_mm.toFixed(2);
    const suffix = unit === 'inch' ? ' in' : ' mm';

    let statusText = '';
    let statusClass = 'size-sanity-ok';
    if (largest_mm < 1) {
      statusText = '⚠ Extremely small — likely a units mismatch. Try ×25.4.';
      statusClass = 'size-sanity-warn';
    } else if (largest_mm > 1000) {
      statusText = '⚠ Extremely large — likely a units mismatch. Try ÷25.4.';
      statusClass = 'size-sanity-warn';
    } else {
      statusText = '✓ Size looks reasonable for 3D printing.';
    }

    el.innerHTML = `
      <div class="size-sanity-value">Largest dimension: ${displayValue}${suffix}</div>
      <div class="size-sanity-status ${statusClass}">${statusText}</div>
    `;
    el.classList.remove('hidden');
  }

  function enableDownload(enable) {
    if (elements.btnDownload) elements.btnDownload.disabled = !enable;
  }

  function getCustomFactor() {
    const input = elements.customFactor;
    if (!input) return 1;
    const raw = input.value.trim().replace(',', '.');
    const v = parseFloat(raw);
    return isNaN(v) ? 1 : v;
  }

  function setCustomFactor(value) {
    const input = elements.customFactor;
    if (input) input.value = String(value);
  }

  function updateSuggestionBanner(maxDim) {
    const banner = elements.suggestionBanner;
    const text = elements.suggestionText;
    const applyBtn = elements.btnSuggestionApply;
    if (!banner || !text || !applyBtn) return;

    if (bannerDismissed || unitSuggestionDismissed) {
      banner.classList.add('hidden');
      return;
    }

    const suspicious = maxDim < 2 || maxDim > 2000;
    const maxIfInches = maxDim * 25.4;
    const maxIfMm = maxDim / 25.4;
    const inRange = (v) => v >= 10 && v <= 400;

    let show = false;
    let preset = null;
    if (suspicious && inRange(maxIfInches)) {
      text.textContent = 'This model\'s size looks unusual. It may be an inch/mm mismatch. Try Inch → mm (×25.4).';
      applyBtn.textContent = 'Apply ×25.4';
      applyBtn.dataset.action = 'inch-to-mm';
      show = true;
      preset = 'inch_to_mm';
    } else if (suspicious && inRange(maxIfMm)) {
      text.textContent = 'This model\'s size looks unusual. It may be an inch/mm mismatch. Try mm → Inch (÷25.4).';
      applyBtn.textContent = 'Apply ÷25.4';
      applyBtn.dataset.action = 'mm-to-inch';
      show = true;
      preset = 'mm_to_inch';
    }
    banner.classList.toggle('hidden', !show);
    return show ? preset : null;
  }

  function resetBannerOnLoad() {
    bannerDismissed = false;
    unitSuggestionDismissed = false;
  }

  function getBuildVolume() {
    const sel = elements.printerSelect;
    if (!sel) return { key: 'ender3', x: 220, y: 220, z: 250 };
    const key = sel.value;
    if (key === 'custom') {
      const x = Math.max(1, parseInt(elements.buildX?.value || 220, 10) || 220);
      const y = Math.max(1, parseInt(elements.buildY?.value || 220, 10) || 220);
      const z = Math.max(1, parseInt(elements.buildZ?.value || 250, 10) || 250);
      return { key: 'custom', x, y, z };
    }
    const p = PRINTERS.find(pr => pr.key === key) || PRINTERS[0];
    return { key: p.key, x: p.x, y: p.y, z: p.z };
  }

  function updatePrinterFit(fit) {
    const el = elements.fitResult;
    if (!el) return;
    if (!fit) {
      el.textContent = '';
      el.className = 'fit-result';
      return;
    }
    const status = fit.status;
    const details = fit.details || [];
    el.className = 'fit-result fit-' + status;
    if (status === 'fit') {
      el.innerHTML = 'Fit: <span class="fit-ok">✓ Fits</span>';
    } else if (status === 'near') {
      el.innerHTML = 'Fit: <span class="fit-near">⚠ Near limit</span>' +
        (details.length ? '<br><span class="fit-details">' + details.join(' ') + '</span>' : '');
    } else {
      el.innerHTML = 'Fit: <span class="fit-exceed">✗ Exceeds</span>' +
        (details.length ? '<br><span class="fit-details">' + details.join(' ') + '</span>' : '');
    }
  }

  function updateModelCheck(modelInfo) {
    const statsEl = elements.modelCheckStats;
    const warningsEl = elements.modelCheckWarnings;
    if (!statsEl || !warningsEl) return;

    if (!modelInfo) {
      statsEl.textContent = 'Load an STL to see model check.';
      warningsEl.classList.add('hidden');
      warningsEl.innerHTML = '';
      return;
    }

    const u = modelInfo.unitsDisplay || 'mm';
    const suffix = u === 'inch' ? ' in' : ' mm';
    const fmt = (v) => (v != null ? (u === 'inch' ? (v / 25.4).toFixed(3) : Number(v).toFixed(2)) : '—');
    const b = modelInfo.bboxInDisplayUnits || (modelInfo.bbox ? { x: modelInfo.bbox.x, y: modelInfo.bbox.y, z: modelInfo.bbox.z } : null);
    const volStr = modelInfo.volume != null ? (modelInfo.volume / 1000).toFixed(2) + ' cm³' : '—';

    statsEl.innerHTML = `
      <dl class="stat-list model-check-list">
        <dt>Dimensions (X × Y × Z)</dt><dd>${fmt(b?.x)} × ${fmt(b?.y)} × ${fmt(b?.z)}${suffix}</dd>
        <dt>Triangles</dt><dd>${(modelInfo.triangles || 0).toLocaleString()}</dd>
        <dt>Volume</dt><dd>${volStr}</dd>
      </dl>
    `;

    const warnings = modelInfo.warnings || [];
    if (warnings.length === 0) {
      warningsEl.classList.add('hidden');
      warningsEl.innerHTML = '';
    } else {
      warningsEl.classList.remove('hidden');
      warningsEl.innerHTML = warnings.map(w => '<li>' + w + '</li>').join('');
    }
  }

  function getCenterModel() {
    const cb = elements.centerModel;
    return cb ? cb.checked : false;
  }

  function setCenterModel(checked) {
    const cb = elements.centerModel;
    if (cb) cb.checked = !!checked;
  }

  function getDisplayUnit() {
    if (elements.unitInch && elements.unitInch.checked) return 'inch';
    return 'mm';
  }

  function showBookmarkToast() {
    const toast = elements.bookmarkToast;
    if (!toast) return;

    const isMac = /Mac|iPad|iPhone|iPod/i.test(navigator.platform || navigator.userAgent || '');
    const shortcut = isMac ? '⌘ + D' : 'Ctrl + D';
    toast.innerHTML = `
      <p>Press <kbd>${shortcut}</kbd> to bookmark this page.</p>
      <p class="bookmark-tip">Tip: you can drag the lock icon (left of the URL) to your bookmarks bar.</p>
      <button type="button" class="bookmark-toast-close" aria-label="Close">×</button>
    `;
    toast.classList.remove('hidden');

    const close = function () {
      toast.classList.add('hidden');
      if (toast._timeout) clearTimeout(toast._timeout);
    };

    toast._timeout = setTimeout(close, 6000);
    toast.querySelector('.bookmark-toast-close').addEventListener('click', close);
  }

  function setDisplayUnit(unit) {
    if (elements.unitMm && elements.unitInch) {
      elements.unitMm.checked = (unit === 'mm');
      elements.unitInch.checked = (unit === 'inch');
    }
  }

  const api = {
    init,
    elements: () => elements,
    showMessage,
    hideMessage,
    showCards,
    hideCards,
    renderModelStats,
    updateSizeSanity,
    enableDownload,
    getCustomFactor,
    setCustomFactor,
    updateSuggestionBanner,
    resetBannerOnLoad,
    getBuildVolume,
    updatePrinterFit,
    updateModelCheck,
    getCenterModel,
    setCenterModel,
    getDisplayUnit,
    setDisplayUnit,
    showBookmarkToast,
    SCALE_INCH_TO_MM,
    SCALE_MM_TO_INCH,
    PRINTERS,
    formatBytes,
    formatDim
  };
  window.UI = api;
  return api;
})();
