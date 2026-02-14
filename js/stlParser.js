/**
 * stlParser.js — Robust ASCII + Binary STL parser.
 * Detects format automatically. Returns { format, vertices, triangleCount }.
 * Vertices layout: Float32Array of 9 * triangleCount floats (v1,v2,v3 per tri).
 */

const STLParser = (function () {
  'use strict';

  const FILE_SIZE_WARN_THRESHOLD = 200 * 1024 * 1024; // 200MB

  /**
   * Detect format: Binary has strict layout (84 + n*50 bytes). Check that first.
   * If binary size matches, trust it. Otherwise, if starts with "solid" and has facet/vertex, ASCII.
   */
  function detectFormat(arrayBuffer) {
    if (arrayBuffer.byteLength >= 84) {
      const view = new DataView(arrayBuffer);
      const triCount = view.getUint32(80, true);
      const expectedBinarySize = 84 + triCount * 50;
      if (expectedBinarySize === arrayBuffer.byteLength && triCount > 0 && triCount < 1e9) {
        return 'binary';
      }
    }

    const arr = new Uint8Array(arrayBuffer, 0, Math.min(1024, arrayBuffer.byteLength));
    const text = new TextDecoder('utf-8', { fatal: false }).decode(arr);
    if (text.trimStart().startsWith('solid ') && (/facet\s+normal/.test(text) || /vertex\s+/.test(text))) {
      return 'ascii';
    }
    return 'binary';
  }

  /**
   * Parse ASCII STL. Handles extra spaces and newlines.
   */
  function parseASCII(text) {
    const vertices = [];
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('vertex ')) {
        const parts = line.slice(6).trim().split(/\s+/);
        if (parts.length >= 3) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          const z = parseFloat(parts[2]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            vertices.push(x, y, z);
          }
        }
      }
    }

    if (vertices.length % 9 !== 0) {
      throw new Error('Invalid ASCII STL: vertex count not divisible by 9 (incomplete triangles)');
    }

    const triCount = vertices.length / 9;
    const result = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
      result[i] = vertices[i];
    }
    return { format: 'ascii', vertices: result, triangleCount: triCount };
  }

  /**
   * Parse Binary STL.
   * Layout: 80-byte header, uint32 count, per-tri: normal(3 float32), v1(3), v2(3), v3(3), uint16 attr.
   */
  function parseBinary(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (arrayBuffer.byteLength < 84) {
      throw new Error('Binary STL too small: missing header or triangle count');
    }

    const triCount = view.getUint32(80, true);
    const expectedSize = 84 + triCount * 50;
    if (arrayBuffer.byteLength < expectedSize) {
      throw new Error('Binary STL truncated: expected ' + expectedSize + ' bytes, got ' + arrayBuffer.byteLength);
    }

    const vertices = new Float32Array(triCount * 9);
    let vo = 0;

    for (let t = 0; t < triCount; t++) {
      const offset = 84 + t * 50;
      // Skip normal (12 bytes), read v1, v2, v3
      vertices[vo++] = view.getFloat32(offset + 12, true);
      vertices[vo++] = view.getFloat32(offset + 16, true);
      vertices[vo++] = view.getFloat32(offset + 20, true);
      vertices[vo++] = view.getFloat32(offset + 24, true);
      vertices[vo++] = view.getFloat32(offset + 28, true);
      vertices[vo++] = view.getFloat32(offset + 32, true);
      vertices[vo++] = view.getFloat32(offset + 36, true);
      vertices[vo++] = view.getFloat32(offset + 40, true);
      vertices[vo++] = view.getFloat32(offset + 44, true);
    }

    return { format: 'binary', vertices, triangleCount: triCount };
  }

  /**
   * Parse STL from ArrayBuffer. Auto-detects format.
   * @param {ArrayBuffer} arrayBuffer
   * @param {number} fileSizeBytes - for display/warning
   * @returns {{ format, vertices, triangleCount, fileSizeBytes, sizeWarning?: boolean }}
   */
  function parse(arrayBuffer, fileSizeBytes) {
    const sizeWarning = fileSizeBytes > FILE_SIZE_WARN_THRESHOLD;

    const format = detectFormat(arrayBuffer);
    let result;

    if (format === 'ascii') {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
      result = parseASCII(text);
    } else {
      result = parseBinary(arrayBuffer);
    }

    return {
      format: result.format,
      vertices: result.vertices,
      triangleCount: result.triangleCount,
      fileSizeBytes: fileSizeBytes,
      sizeWarning
    };
  }

  const api = { parse, FILE_SIZE_WARN_THRESHOLD };
  window.STLParser = api;
  return api;
})();
