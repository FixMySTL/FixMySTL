/**
 * main.js — Bootstrap UI and wire events.
 * State: originalVertices (immutable), currentScaleFactor, currentVertices.
 * Scale always computed from originalVertices.
 */

import { Preview } from './preview.js';

(function () {
  'use strict';

  const GEOMETRY = window.GEOMETRY;
  const STLParser = window.STLParser;
  const STLExporter = window.STLExporter;
  const UI = window.UI;

  let state = {
    originalVertices: null,
    currentScaleFactor: 1,
    currentVertices: null,
    triangleCount: 0,
    format: null,
    fileSizeBytes: 0,
    filename: '',
    sizeWarning: false
  };

  function loadFile(file) {
    UI.hideMessage();
    UI.hideCards();
    Preview.clear();

    if (!file || !file.name.toLowerCase().endsWith('.stl')) {
      UI.showMessage('Please select a valid .stl file.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      const fileSizeBytes = arrayBuffer.byteLength;

      try {
        const parsed = STLParser.parse(arrayBuffer, fileSizeBytes);
        state.originalVertices = parsed.vertices;
        state.currentScaleFactor = 1;
        state.currentVertices = new Float32Array(parsed.vertices.length);
        state.currentVertices.set(parsed.vertices);
        state.triangleCount = parsed.triangleCount;
        state.format = parsed.format;
        state.fileSizeBytes = parsed.fileSizeBytes;
        state.filename = file.name;
        state.sizeWarning = parsed.sizeWarning;

        onModelLoaded();
      } catch (err) {
        UI.showMessage('Failed to parse STL: ' + (err.message || 'Unknown error'), true);
      }
    };

    reader.onerror = function () {
      UI.showMessage('Failed to read file.', true);
    };

    reader.readAsArrayBuffer(file);
  }

  function onModelLoaded() {
    const bbox = GEOMETRY.computeBbox(state.currentVertices, state.triangleCount);

    UI.renderModelStats({
      format: state.format,
      fileSizeBytes: state.fileSizeBytes,
      triangleCount: state.triangleCount,
      bbox,
      sizeWarning: state.sizeWarning
    });

    Preview.setMesh(state.currentVertices, state.triangleCount, bbox);
    UI.showCards();
    UI.enableDownload(true);
    UI.setCustomFactor(state.currentScaleFactor);
    UI.hideMessage();
  }

  function applyScale(factor) {
    if (!state.originalVertices || factor <= 0 || !isFinite(factor)) return;

    state.currentScaleFactor = factor;
    state.currentVertices = GEOMETRY.scaleVertices(state.originalVertices, factor);
    const bbox = GEOMETRY.computeBbox(state.currentVertices, state.triangleCount);

    UI.renderModelStats({
      format: state.format,
      fileSizeBytes: state.fileSizeBytes,
      triangleCount: state.triangleCount,
      bbox,
      sizeWarning: state.sizeWarning
    });

    Preview.updateMeshPositions(state.currentVertices);
    Preview.fitCameraToBbox(bbox);
    UI.setCustomFactor(factor);
  }

  function reset() {
    if (!state.originalVertices) return;
    applyScale(1);
  }

  function download() {
    if (!state.currentVertices) return;
    STLExporter.exportAndDownload(
      state.currentVertices,
      state.triangleCount,
      state.filename
    );
  }

  function setupDragDrop() {
    const dropzone = UI.elements().dropzone;
    const fileInput = UI.elements().fileInput;

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files && files[0]) loadFile(files[0]);
    });

    UI.elements().btnChoose.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      const files = fileInput.files;
      if (files && files[0]) loadFile(files[0]);
      fileInput.value = '';
    });
  }

  function setupScaleButtons() {
    UI.elements().btnInchToMm.addEventListener('click', function () {
      applyScale(UI.SCALE_INCH_TO_MM);
    });

    UI.elements().btnMmToInch.addEventListener('click', function () {
      applyScale(UI.SCALE_MM_TO_INCH);
    });

    UI.elements().btnApplyScale.addEventListener('click', function () {
      const factor = UI.getCustomFactor();
      if (factor > 0 && isFinite(factor)) {
        applyScale(factor);
      } else {
        UI.showMessage('Enter a valid positive scale factor.', true);
      }
    });

    UI.elements().btnReset.addEventListener('click', reset);
    UI.elements().btnDownload.addEventListener('click', download);
  }

  function init() {
    UI.init(document.getElementById('app-root'));
    Preview.init(UI.elements().previewContainer);

    setupDragDrop();
    setupScaleButtons();

    window.addEventListener('resize', function () {
      Preview.resize();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
