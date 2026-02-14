/**
 * ui.js — DOM rendering for stats, controls, messages.
 * IlovePDF vibe: cards for Model Info, Preview, Scale.
 */

const UI = (function () {
  'use strict';

  const SCALE_INCH_TO_MM = 25.4;
  const SCALE_MM_TO_INCH = 1 / 25.4;

  let elements = {};
  let bannerDismissed = false;

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
      elements.suggestionBanner.classList.add('hidden');
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

    if (bannerDismissed) {
      banner.classList.add('hidden');
      return;
    }

    if (maxDim < 5) {
      text.textContent = 'Model looks very small. If it\'s invisible/tiny in your slicer, try Inch → mm (×25.4).';
      applyBtn.textContent = 'Apply ×25.4';
      applyBtn.dataset.action = 'inch-to-mm';
      banner.classList.remove('hidden');
    } else if (maxDim > 500) {
      text.textContent = 'Model looks very large. If it\'s huge in your slicer, try mm → Inch (÷25.4).';
      applyBtn.textContent = 'Apply ÷25.4';
      applyBtn.dataset.action = 'mm-to-inch';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  function resetBannerOnLoad() {
    bannerDismissed = false;
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
    getCenterModel,
    setCenterModel,
    getDisplayUnit,
    setDisplayUnit,
    showBookmarkToast,
    SCALE_INCH_TO_MM,
    SCALE_MM_TO_INCH,
    formatBytes,
    formatDim
  };
  window.UI = api;
  return api;
})();
