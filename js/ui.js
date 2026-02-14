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

    const preSlicerCard = createElement('div', 'card');
    preSlicerCard.innerHTML = `
      <h2>Pre-Slicer Checks</h2>
      <p class="pre-slicer-disclaimer">Estimates are approximate; slicer preview is the source of truth.</p>
      <div class="pre-slicer-inputs">
        <div class="pre-slicer-row">
          <label>Material <select id="cam-material" class="cam-select">
            <option value="pla">PLA</option>
            <option value="petg">PETG</option>
            <option value="abs">ABS</option>
            <option value="tpu">TPU</option>
            <option value="custom">Custom</option>
          </select></label>
          <span class="cam-custom-density hidden" id="cam-custom-density">g/cm³ <input type="number" id="cam-density" value="1.24" min="0.5" max="2" step="0.01"></span>
        </div>
        <div class="pre-slicer-row">
          <label>Infill <input type="number" id="cam-infill" value="15" min="0" max="100" step="5">%</label>
          <label>Quality <select id="cam-quality" class="cam-select">
            <option value="draft">Draft</option>
            <option value="normal" selected>Normal</option>
            <option value="strong">Strong</option>
          </select></label>
        </div>
        <div class="pre-slicer-row">
          <label>Filament <select id="cam-filament-dia" class="cam-select">
            <option value="1.75" selected>1.75 mm</option>
            <option value="2.85">2.85 mm</option>
          </select></label>
          <label>Speed <select id="cam-speed" class="cam-select">
            <option value="slow">Slow</option>
            <option value="normal" selected>Normal</option>
            <option value="fast">Fast</option>
          </select></label>
          <label>Price/kg $<input type="number" id="cam-price" value="20" min="0" step="1"></label>
        </div>
        <div class="pre-slicer-row">
          <label>Overhang threshold <select id="cam-overhang-thresh" class="cam-select">
            <option value="45">45°</option>
            <option value="60" selected>60°</option>
            <option value="70">70°</option>
          </select></label>
        </div>
        <div class="pre-slicer-row">
          <label class="seller-toggle"><input type="checkbox" id="cam-seller-mode"> Seller mode (optional)</label>
        </div>
        <div class="pre-slicer-seller hidden" id="cam-seller-panel">
          <label>Markup <input type="number" id="cam-markup" value="300" min="0" step="10">%</label>
          <span class="cam-suggested-price" id="cam-suggested-price"></span>
        </div>
      </div>
      <div class="pre-slicer-outputs" id="cam-outputs"></div>
      <div class="pre-slicer-footprint" id="cam-footprint"></div>
      <div class="pre-slicer-overhang" id="cam-overhang"></div>
    `;
    cards.appendChild(preSlicerCard);

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
      btnResetOrient: document.getElementById('btn-reset-orient'),
      camMaterial: document.getElementById('cam-material'),
      camCustomDensity: document.getElementById('cam-custom-density'),
      camDensity: document.getElementById('cam-density'),
      camInfill: document.getElementById('cam-infill'),
      camQuality: document.getElementById('cam-quality'),
      camFilamentDia: document.getElementById('cam-filament-dia'),
      camSpeed: document.getElementById('cam-speed'),
      camPrice: document.getElementById('cam-price'),
      camOverhangThresh: document.getElementById('cam-overhang-thresh'),
      camSellerMode: document.getElementById('cam-seller-mode'),
      camSellerPanel: document.getElementById('cam-seller-panel'),
      camMarkup: document.getElementById('cam-markup'),
      camSuggestedPrice: document.getElementById('cam-suggested-price'),
      camOutputs: document.getElementById('cam-outputs'),
      camFootprint: document.getElementById('cam-footprint'),
      camOverhang: document.getElementById('cam-overhang')
    };

    if (elements.camMaterial) {
      elements.camMaterial.addEventListener('change', function () {
        const isCustom = elements.camMaterial.value === 'custom';
        if (elements.camCustomDensity) elements.camCustomDensity.classList.toggle('hidden', !isCustom);
      });
    }
    if (elements.camSellerMode && elements.camSellerPanel) {
      elements.camSellerMode.addEventListener('change', function () {
        const on = elements.camSellerMode && elements.camSellerMode.checked;
        elements.camSellerPanel.classList.toggle('hidden', !on);
      });
    }

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

  function getPreSlicerInputs() {
    const mats = [
      { key: 'pla', density: 1.24 },
      { key: 'petg', density: 1.27 },
      { key: 'abs', density: 1.04 },
      { key: 'tpu', density: 1.20 }
    ];
    const shells = { draft: 1.05, normal: 1.12, strong: 1.20 };
    const flows = { slow: 2.5, normal: 5.0, fast: 8.0 };
    const matKey = elements.camMaterial?.value || 'pla';
    const density = matKey === 'custom'
      ? parseFloat(elements.camDensity?.value || 1.24) || 1.24
      : (mats.find(m => m.key === matKey)?.density || 1.24);
    const infill = Math.max(0, Math.min(100, parseFloat(elements.camInfill?.value || 15) || 15));
    const qualityKey = elements.camQuality?.value || 'normal';
    const shellMult = shells[qualityKey] || 1.12;
    const filamentDia = parseFloat(elements.camFilamentDia?.value || 1.75) || 1.75;
    const pricePerKg = parseFloat(elements.camPrice?.value || 20) || 20;
    const flowBySpeed = { slow: 2.5, normal: 5.0, fast: 8.0 };
    const flowKey = elements.camSpeed?.value || 'normal';
    const flow = flowBySpeed[flowKey] || 5.0;
    const overhangThresh = parseInt(elements.camOverhangThresh?.value || 60, 10) || 60;
    const markup = parseFloat(elements.camMarkup?.value || 300) || 300;
    const sellerMode = elements.camSellerMode?.checked || false;
    return {
      material: matKey,
      density,
      infill,
      shellMult,
      filamentDia,
      pricePerKg,
      flow,
      markup,
      sellerMode,
      overhangThreshold: overhangThresh
    };
  }

  function updatePreSlicerOutputs(data) {
    const outputsEl = elements.camOutputs;
    const footprintEl = elements.camFootprint;
    const overhangEl = elements.camOverhang;
    const suggestedEl = elements.camSuggestedPrice;
    if (!outputsEl) return;

    if (!data || data.volumeMm3 == null || data.volumeMm3 <= 0) {
      outputsEl.innerHTML = '<span class="cam-placeholder">Load an STL to see estimates.</span>';
      if (footprintEl) footprintEl.textContent = '';
      if (overhangEl) overhangEl.textContent = '';
      if (suggestedEl) suggestedEl.textContent = '';
      return;
    }

    const { mass_g, length_m, cost, time_h, overhang, footprint, suggestedPrice } = data;
    outputsEl.innerHTML = `
      <div class="cam-debug">CAM: active</div>
      <div class="cam-output-line">Estimated filament: ~${mass_g.toFixed(1)} g</div>
      <div class="cam-output-line">Estimated filament length: ~${length_m.toFixed(2)} m</div>
      <div class="cam-output-line">Estimated material cost: ~$${cost.toFixed(2)}</div>
      <div class="cam-output-line">Rough print time: ~${time_h.toFixed(2)} h <span class="cam-rough">(coarse estimate)</span></div>
      <div class="cam-output-note">Rough estimates; final depends on slicer settings.</div>
    `;

    if (footprintEl && footprint) {
      const u = footprint.unitsDisplay || 'mm';
      const suf = u === 'inch' ? ' in' : ' mm';
      const areaCm2 = (footprint.x_mm * footprint.y_mm) / 100;
      footprintEl.innerHTML = `Bed footprint: ${footprint.x_display.toFixed(2)} × ${footprint.y_display.toFixed(2)}${suf} · ${areaCm2.toFixed(1)} cm²${footprint.hint ? '<br><span class="cam-orient-hint">' + footprint.hint + '</span>' : ''}`;
    }

    if (overhangEl && overhang) {
      const bandClass = overhang.band === 'high' ? 'overhang-high' : overhang.band === 'medium' ? 'overhang-medium' : 'overhang-low';
      overhangEl.innerHTML = `Overhang risk: <span class="${bandClass}">${overhang.band.charAt(0).toUpperCase() + overhang.band.slice(1)}</span> (${overhang.riskPct.toFixed(1)}% of surface &gt; ${overhang.threshold}°)`;
    }

    if (suggestedEl) {
      if (data.sellerMode && suggestedPrice != null) {
        suggestedEl.textContent = 'Suggested price: ~$' + suggestedPrice.toFixed(2) + ' (excl. electricity/time/failures/shipping)';
      } else {
        suggestedEl.textContent = '';
      }
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
    getPreSlicerInputs,
    updatePreSlicerOutputs,
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
