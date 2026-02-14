/**
 * main.js — Bootstrap UI and wire events.
 * State: originalVertices (immutable), currentScaleFactor, currentVertices,
 * centerModel, currentBbox. Transform: scale + optional center.
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
    currentBbox: null,
    triangleCount: 0,
    format: null,
    fileSizeBytes: 0,
    filename: '',
    sizeWarning: false,
    centerModel: false,
    displayUnit: 'mm',
    showBoundingBox: false
  };

  function applyTransform() {
    if (!state.originalVertices) return;

    const scaled = GEOMETRY.scaleVertices(state.originalVertices, state.currentScaleFactor);
    const bbox = GEOMETRY.computeBbox(scaled, state.triangleCount);

    let tx = 0, ty = 0, tz = 0;
    if (state.centerModel) {
      const center = GEOMETRY.computeCenter(bbox);
      tx = -center.x;
      ty = -center.y;
      tz = -center.z;
    }

    state.currentVertices = GEOMETRY.applyTransform(
      state.originalVertices,
      state.currentScaleFactor,
      tx, ty, tz
    );
    state.currentBbox = GEOMETRY.computeBbox(state.currentVertices, state.triangleCount);
  }

  function refreshFromState() {
    if (!state.originalVertices) return;

    applyTransform();
    const bbox = state.currentBbox;
    const maxDim = Math.max(bbox.size.x, bbox.size.y, bbox.size.z, 0);

    UI.renderModelStats({
      format: state.format,
      fileSizeBytes: state.fileSizeBytes,
      triangleCount: state.triangleCount,
      bbox,
      sizeWarning: state.sizeWarning,
      displayUnit: state.displayUnit
    });

    Preview.updateMeshPositions(state.currentVertices);
    Preview.fitCameraToBbox(bbox);
    Preview.updateBoundingBoxAndLabels(bbox, state.displayUnit, state.showBoundingBox);
    UI.setCustomFactor(state.currentScaleFactor);
    UI.updateSuggestionBanner(maxDim);
    UI.updateSizeSanity(bbox, state.displayUnit);
  }

  function loadFile(file) {
    UI.hideMessage();
    UI.hideCards();
    Preview.clear();
    UI.resetBannerOnLoad();

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
        state.triangleCount = parsed.triangleCount;
        state.format = parsed.format;
        state.fileSizeBytes = parsed.fileSizeBytes;
        state.filename = file.name;
        state.sizeWarning = parsed.sizeWarning;
        state.centerModel = false;
        UI.setCenterModel(false);

        applyTransform();
        const bbox = state.currentBbox;
        const maxDim = Math.max(bbox.size.x, bbox.size.y, bbox.size.z, 0);

        UI.renderModelStats({
          format: state.format,
          fileSizeBytes: state.fileSizeBytes,
          triangleCount: state.triangleCount,
          bbox,
          sizeWarning: state.sizeWarning,
          displayUnit: state.displayUnit
        });

        Preview.setMesh(state.currentVertices, state.triangleCount, bbox);
        Preview.updateBoundingBoxAndLabels(bbox, state.displayUnit, state.showBoundingBox);
        UI.updateSizeSanity(bbox, state.displayUnit);
        UI.showCards();
        UI.enableDownload(true);
        UI.setCustomFactor(state.currentScaleFactor);
        UI.updateSuggestionBanner(maxDim);
        UI.hideMessage();
      } catch (err) {
        UI.showMessage('Failed to parse STL: ' + (err.message || 'Unknown error'), true);
      }
    };

    reader.onerror = function () {
      UI.showMessage('Failed to read file.', true);
    };

    reader.readAsArrayBuffer(file);
  }

  function applyScale(factor) {
    if (!state.originalVertices || factor <= 0 || !isFinite(factor)) return;

    state.currentScaleFactor = factor;
    refreshFromState();
  }

  function reset() {
    if (!state.originalVertices) return;
    state.currentScaleFactor = 1;
    UI.setCenterModel(false);
    state.centerModel = false;
    refreshFromState();
  }

  function fitView() {
    if (!state.currentBbox) return;
    Preview.fitCameraToBbox(state.currentBbox);
  }

  function onCenterToggle() {
    state.centerModel = UI.getCenterModel();
    refreshFromState();
  }

  function onUnitChange() {
    state.displayUnit = UI.getDisplayUnit();
    if (!state.originalVertices) return;
    UI.renderModelStats({
      format: state.format,
      fileSizeBytes: state.fileSizeBytes,
      triangleCount: state.triangleCount,
      bbox: state.currentBbox,
      sizeWarning: state.sizeWarning,
      displayUnit: state.displayUnit
    });
    Preview.updateBoundingBoxAndLabels(state.currentBbox, state.displayUnit, state.showBoundingBox);
    UI.updateSizeSanity(state.currentBbox, state.displayUnit);
  }

  function onBboxToggle() {
    const cb = UI.elements().bboxToggle;
    state.showBoundingBox = cb ? cb.checked : false;
    if (!state.originalVertices) return;
    Preview.updateBoundingBoxAndLabels(state.currentBbox, state.displayUnit, state.showBoundingBox);
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

    UI.elements().btnSuggestionApply.addEventListener('click', function () {
      const action = UI.elements().btnSuggestionApply.dataset.action;
      if (action === 'inch-to-mm') applyScale(UI.SCALE_INCH_TO_MM);
      else if (action === 'mm-to-inch') applyScale(UI.SCALE_MM_TO_INCH);
    });

    UI.elements().btnReset.addEventListener('click', reset);
    UI.elements().btnFitView.addEventListener('click', fitView);
    UI.elements().btnDownload.addEventListener('click', download);
    UI.elements().centerModel.addEventListener('change', onCenterToggle);

    document.querySelectorAll('input[name="display-unit"]').forEach(function (radio) {
      radio.addEventListener('change', onUnitChange);
    });

    UI.elements().bboxToggle.addEventListener('change', onBboxToggle);
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
