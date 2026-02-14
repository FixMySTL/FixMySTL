/**
 * stlExporter.js — Write Binary STL and trigger download.
 * Always exports as Binary STL. 80-byte header, valid normals per triangle.
 */

const STLExporter = (function () {
  'use strict';

  /**
   * Compute face normal from triangle vertices (cross product of edges).
   * @param {Float32Array} v - vertices for one triangle at base index
   * @param {number} base - index (multiple of 9)
   */
  function faceNormal(v, base) {
    const ax = v[base + 3] - v[base];
    const ay = v[base + 4] - v[base + 1];
    const az = v[base + 5] - v[base + 2];
    const bx = v[base + 6] - v[base];
    const by = v[base + 7] - v[base + 1];
    const bz = v[base + 8] - v[base + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-10) {
      return [0, 0, 1];
    }
    return [nx / len, ny / len, nz / len];
  }

  /**
   * Build Binary STL from current vertices.
   * Layout: 80-byte header, uint32 count, per-tri: normal(3 float32), v1(3), v2(3), v3(3), uint16 attr.
   * @param {Float32Array} vertices - 9 * triCount floats
   * @param {number} triangleCount
   * @returns {ArrayBuffer}
   */
  function buildBinarySTL(vertices, triangleCount) {
    const header = 'FixMySTL'.padEnd(80, '\0').slice(0, 80);
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);

    const triSize = 50; // 12 + 12 + 12 + 12 + 2
    const totalSize = 80 + 4 + triangleCount * triSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    let offset = 0;
    for (let i = 0; i < 80; i++) {
      view.setUint8(offset++, headerBytes[i]);
    }
    view.setUint32(offset, triangleCount, true);
    offset += 4;

    for (let t = 0; t < triangleCount; t++) {
      const base = t * 9;
      const n = faceNormal(vertices, base);

      view.setFloat32(offset, n[0], true);
      offset += 4;
      view.setFloat32(offset, n[1], true);
      offset += 4;
      view.setFloat32(offset, n[2], true);
      offset += 4;

      view.setFloat32(offset, vertices[base], true);
      offset += 4;
      view.setFloat32(offset, vertices[base + 1], true);
      offset += 4;
      view.setFloat32(offset, vertices[base + 2], true);
      offset += 4;

      view.setFloat32(offset, vertices[base + 3], true);
      offset += 4;
      view.setFloat32(offset, vertices[base + 4], true);
      offset += 4;
      view.setFloat32(offset, vertices[base + 5], true);
      offset += 4;

      view.setFloat32(offset, vertices[base + 6], true);
      offset += 4;
      view.setFloat32(offset, vertices[base + 7], true);
      offset += 4;
      view.setFloat32(offset, vertices[base + 8], true);
      offset += 4;

      view.setUint16(offset, 0, true);
      offset += 2;
    }

    return buffer;
  }

  /**
   * Trigger download of Binary STL.
   * @param {ArrayBuffer} buffer
   * @param {string} filename - e.g. "model.stl" or "model_fixed.stl"
   */
  function download(buffer, filename) {
    const blob = new Blob([buffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'fixed.stl';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export vertices as Binary STL and download.
   * @param {Float32Array} vertices
   * @param {number} triangleCount
   * @param {string} baseFilename - original filename for download
   */
  function exportAndDownload(vertices, triangleCount, baseFilename) {
    const buffer = buildBinarySTL(vertices, triangleCount);
    const name = baseFilename ? baseFilename.replace(/\.stl$/i, '_fixed.stl') : 'fixed.stl';
    download(buffer, name);
  }

  const api = { buildBinarySTL, exportAndDownload, download };
  window.STLExporter = api;
  return api;
})();
