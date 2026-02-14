/**
 * ui.js — DOM rendering for stats, controls, messages.
 * IlovePDF vibe: cards for Model Info, Preview, Scale.
 */

const UI = (function () {
  'use strict';

  const SCALE_INCH_TO_MM = 25.4;
  const SCALE_MM_TO_INCH = 1 / 25.4;

  let elements = {};

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
    header.innerHTML = '<h1>FixMySTL</h1><p class="tagline">Fix scale. Preview. Download.</p>';
    app.appendChild(header);

    const dropzone = createElement('div', 'dropzone');
    dropzone.innerHTML = '<p class="dropzone-text">Drag & drop an STL file here</p><p class="dropzone-sub">or</p><button type="button" class="btn btn-primary" id="btn-choose">Choose file</button><input type="file" id="file-input" accept=".stl" style="display:none">';
    app.appendChild(dropzone);

    const message = createElement('div', 'message hidden', '');
    message.id = 'message';
    app.appendChild(message);

    const cards = createElement('div', 'cards hidden');
    cards.id = 'cards';

    const modelCard = createElement('div', 'card');
    modelCard.innerHTML = '<h2>Model Info</h2><div class="stats" id="model-stats"></div>';
    cards.appendChild(modelCard);

    const previewCard = createElement('div', 'card');
    previewCard.innerHTML = '<h2>Preview</h2><div class="preview-container" id="preview-container"></div>';
    cards.appendChild(previewCard);

    const scaleCard = createElement('div', 'card');
    scaleCard.innerHTML = `
      <h2>Scale</h2>
      <div class="scale-controls">
        <div class="scale-buttons">
          <button type="button" class="btn btn-scale" id="btn-inch-to-mm">Inch → mm ×25.4</button>
          <button type="button" class="btn btn-scale" id="btn-mm-to-inch">mm → Inch ÷25.4</button>
        </div>
        <div class="custom-scale">
          <label>Custom factor:</label>
          <input type="number" id="custom-factor" step="0.01" value="1" placeholder="1.0">
          <button type="button" class="btn btn-apply" id="btn-apply-scale">Apply</button>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" id="btn-reset">Reset to original</button>
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
      previewContainer: document.getElementById('preview-container'),
      btnChoose: document.getElementById('btn-choose'),
      fileInput: document.getElementById('file-input'),
      btnInchToMm: document.getElementById('btn-inch-to-mm'),
      btnMmToInch: document.getElementById('btn-mm-to-inch'),
      customFactor: document.getElementById('custom-factor'),
      btnApplyScale: document.getElementById('btn-apply-scale'),
      btnReset: document.getElementById('btn-reset'),
      btnDownload: document.getElementById('btn-download')
    };

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
    const fmt = (v) => (v != null ? Number(v).toFixed(2) : '—');
    const sizeWarn = data.sizeWarning ? '<p class="size-warning">Large file; processing may be slow.</p>' : '';

    el.innerHTML = `
      <dl class="stat-list">
        <dt>Format</dt><dd>${data.format === 'ascii' ? 'ASCII' : 'Binary'}</dd>
        <dt>File size</dt><dd>${formatBytes(data.fileSizeBytes)}</dd>
        <dt>Triangles</dt><dd>${data.triangleCount.toLocaleString()}</dd>
        <dt>Bounding box (X × Y × Z)</dt><dd>${fmt(bbox.size.x)} × ${fmt(bbox.size.y)} × ${fmt(bbox.size.z)}</dd>
      </dl>
      ${sizeWarn}
    `;
  }

  function enableDownload(enable) {
    if (elements.btnDownload) elements.btnDownload.disabled = !enable;
  }

  function getCustomFactor() {
    const input = elements.customFactor;
    if (!input) return 1;
    const v = parseFloat(input.value);
    return isNaN(v) ? 1 : v;
  }

  function setCustomFactor(value) {
    const input = elements.customFactor;
    if (input) input.value = String(value);
  }

  const api = {
    init,
    elements: () => elements,
    showMessage,
    hideMessage,
    showCards,
    hideCards,
    renderModelStats,
    enableDownload,
    getCustomFactor,
    setCustomFactor,
    SCALE_INCH_TO_MM,
    SCALE_MM_TO_INCH,
    formatBytes,
    formatDim
  };
  window.UI = api;
  return api;
})();
