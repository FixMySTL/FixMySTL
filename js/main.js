/**
 * main.js — Bootstrap UI and wire events.
 * State: originalVertices (immutable), currentScaleFactor, currentVertices,
 * centerModel, currentBbox. Transform: scale + optional center.
 */

import { Preview } from './preview.js';
import { track, trackOnce } from './analytics.js';

console.log('FixMySTL assets loaded');

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
    showBoundingBox: false,
    rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    lastAppliedScaleFactor: null
  };

  function bboxParams(bbox, units) {
    if (!bbox) return {};
    const toDisplay = (v) => (units === 'inch' ? (v / 25.4) : v);
    return {
      bbox_x: Math.round(toDisplay(bbox.size.x) * 1000) / 1000,
      bbox_y: Math.round(toDisplay(bbox.size.y) * 1000) / 1000,
      bbox_z: Math.round(toDisplay(bbox.size.z) * 1000) / 1000,
      units_display: units || state.displayUnit
    };
  }

  function applyTransform() {
    if (!state.originalVertices) return;

    const scaled = GEOMETRY.scaleVertices(state.originalVertices, state.currentScaleFactor);
    const bboxScaled = GEOMETRY.computeBbox(scaled, state.triangleCount);
    const center = GEOMETRY.computeCenter(bboxScaled);

    let rotated = GEOMETRY.rotateVerticesAboutCenter(scaled, center, state.rotationMatrix);

    if (state.centerModel) {
      const bboxRotated = GEOMETRY.computeBbox(rotated, state.triangleCount);
      const centerRotated = GEOMETRY.computeCenter(bboxRotated);
      rotated = GEOMETRY.translateVertices(rotated, -centerRotated.x, -centerRotated.y, -centerRotated.z);
    }

    state.currentVertices = rotated;
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
        state.lastAppliedScaleFactor = null;
        state.rotationMatrix = GEOMETRY.IDENTITY.slice();
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
        const uploadKey = 'stl_' + file.name + '_' + state.fileSizeBytes + '_' + state.triangleCount;
        const fmt = state.format === 'ascii' || state.format === 'binary' ? state.format : 'unknown';
        trackOnce(uploadKey, 'stl_upload', {
          file_size_mb: Math.round((state.fileSizeBytes / (1024 * 1024)) * 1000) / 1000,
          file_format: fmt,
          triangles: state.triangleCount,
          ...bboxParams(bbox, state.displayUnit)
        });
      } catch (err) {
        UI.showMessage('Failed to parse STL: ' + (err.message || 'Unknown error'), true);
        track('stl_parse_error', { reason: (err && err.message) || 'unknown' });
      }
    };

    reader.onerror = function () {
      UI.showMessage('Failed to read file.', true);
    };

    reader.readAsArrayBuffer(file);
  }

  function applyScale(factor, mode) {
    if (!state.originalVertices || factor <= 0 || !isFinite(factor)) return;

    const factorChanged = state.currentScaleFactor !== factor;
    state.currentScaleFactor = factor;
    state.lastAppliedScaleFactor = factor;
    refreshFromState();
    if (factorChanged && mode) {
      track('scale_apply', {
        factor: Math.round(factor * 10000) / 10000,
        mode,
        units_display: state.displayUnit
      });
    }
  }

  function reset() {
    if (!state.originalVertices) return;
    track('reset_click');
    state.currentScaleFactor = 1;
    state.rotationMatrix = GEOMETRY.IDENTITY.slice();
    UI.setCenterModel(false);
    state.centerModel = false;
    refreshFromState();
  }

  function rotate(axis, sign) {
    if (!state.originalVertices) return;
    const r = GEOMETRY.ROT_90[axis][String(sign)];
    state.rotationMatrix = GEOMETRY.multiplyRotationMatrices(r, state.rotationMatrix);
    refreshFromState();
  }

  function resetOrientation() {
    if (!state.originalVertices) return;
    state.rotationMatrix = GEOMETRY.IDENTITY.slice();
    refreshFromState();
  }

  function fitView() {
    if (!state.currentBbox) return;
    track('fit_view_click');
    Preview.fitCameraToBbox(state.currentBbox);
  }

  function onCenterToggle() {
    state.centerModel = UI.getCenterModel();
    track('center_toggle', { enabled: state.centerModel });
    refreshFromState();
  }

  function onUnitChange() {
    state.displayUnit = UI.getDisplayUnit();
    track('units_toggle', { units_display: state.displayUnit });
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
    track('bbox_toggle', { enabled: state.showBoundingBox, units_display: state.displayUnit });
    if (!state.originalVertices) return;
    Preview.updateBoundingBoxAndLabels(state.currentBbox, state.displayUnit, state.showBoundingBox);
  }

  function download() {
    if (!state.currentVertices) return;
    const bbox = state.currentBbox;
    track('download_corrected_stl', {
      triangles: state.triangleCount,
      scale_factor_total: Math.round(state.currentScaleFactor * 10000) / 10000,
      ...bboxParams(bbox, state.displayUnit)
    });
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
      track('scale_preset_click', {
        preset: 'inch_to_mm',
        factor: UI.SCALE_INCH_TO_MM,
        units_display: state.displayUnit
      });
      applyScale(UI.SCALE_INCH_TO_MM, 'preset');
    });

    UI.elements().btnMmToInch.addEventListener('click', function () {
      track('scale_preset_click', {
        preset: 'mm_to_inch',
        factor: UI.SCALE_MM_TO_INCH,
        units_display: state.displayUnit
      });
      applyScale(UI.SCALE_MM_TO_INCH, 'preset');
    });

    UI.elements().btnApplyScale.addEventListener('click', function () {
      const factor = UI.getCustomFactor();
      if (factor > 0 && isFinite(factor)) {
        applyScale(factor, 'custom');
      } else {
        UI.showMessage('Enter a valid positive scale factor.', true);
      }
    });

    UI.elements().btnSuggestionApply.addEventListener('click', function () {
      const action = UI.elements().btnSuggestionApply.dataset.action;
      if (action === 'inch-to-mm') {
        track('scale_preset_click', {
          preset: 'inch_to_mm',
          factor: UI.SCALE_INCH_TO_MM,
          units_display: state.displayUnit
        });
        applyScale(UI.SCALE_INCH_TO_MM, 'preset');
      } else if (action === 'mm-to-inch') {
        track('scale_preset_click', {
          preset: 'mm_to_inch',
          factor: UI.SCALE_MM_TO_INCH,
          units_display: state.displayUnit
        });
        applyScale(UI.SCALE_MM_TO_INCH, 'preset');
      }
    });

    UI.elements().btnReset.addEventListener('click', reset);
    UI.elements().btnFitView.addEventListener('click', fitView);

    UI.elements().rotXPlus.addEventListener('click', function () { rotate('x', 1); });
    UI.elements().rotXMinus.addEventListener('click', function () { rotate('x', -1); });
    UI.elements().rotYPlus.addEventListener('click', function () { rotate('y', 1); });
    UI.elements().rotYMinus.addEventListener('click', function () { rotate('y', -1); });
    UI.elements().rotZPlus.addEventListener('click', function () { rotate('z', 1); });
    UI.elements().rotZMinus.addEventListener('click', function () { rotate('z', -1); });
    UI.elements().btnResetOrient.addEventListener('click', resetOrientation);
    UI.elements().btnDownload.addEventListener('click', download);
    UI.elements().centerModel.addEventListener('change', onCenterToggle);

    document.querySelectorAll('input[name="display-unit"]').forEach(function (radio) {
      radio.addEventListener('change', onUnitChange);
    });

    UI.elements().bboxToggle.addEventListener('change', onBboxToggle);

    UI.elements().btnBookmark.addEventListener('click', function () {
      try {
        if (typeof window.sidebar !== 'undefined' && typeof window.sidebar.addPanel === 'function') {
          window.sidebar.addPanel('FixMySTL', window.location.href, '');
          return;
        }
      } catch (e) {}
      UI.showBookmarkToast();
    });
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
