/**
 * geometry.js — Bounding box, scale helpers, triangle count, typed arrays.
 * All operations work with Float32Array layout: 9 floats per triangle
 * (v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z).
 */

/**
 * geometry.js — Bounding box, scale helpers, triangle count, typed arrays.
 */

const GEOMETRY = (function () {
  'use strict';

  /**
   * Compute bounding box from vertex array.
   * @param {Float32Array} vertices - 9 * n floats (3 per vertex, 3 vertices per tri)
   * @param {number} triCount - number of triangles
   * @returns {{ min: {x,y,z}, max: {x,y,z}, size: {x,y,z} }}
   */
  function computeBbox(vertices, triCount) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    const n = triCount * 9;
    for (let i = 0; i < n; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size: {
        x: maxX - minX,
        y: maxY - minY,
        z: maxZ - minZ
      }
    };
  }

  /**
   * Create scaled copy of original vertices.
   * Always scale from originals; never accumulate.
   * @param {Float32Array} originalVertices - immutable source
   * @param {number} factor - scale factor
   * @returns {Float32Array} new Float32Array with scaled coordinates
   */
  function scaleVertices(originalVertices, factor) {
    const len = originalVertices.length;
    const scaled = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      scaled[i] = originalVertices[i] * factor;
    }
    return scaled;
  }

  /**
   * Compute center of bounding box.
   * @param {{ min, max }} bbox
   * @returns {{ x, y, z }}
   */
  function computeCenter(bbox) {
    return {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: (bbox.min.z + bbox.max.z) / 2
    };
  }

  /**
   * Translate vertices in place (returns new array).
   * @param {Float32Array} vertices
   * @param {number} tx
   * @param {number} ty
   * @param {number} tz
   * @returns {Float32Array}
   */
  function translateVertices(vertices, tx, ty, tz) {
    const len = vertices.length;
    const out = new Float32Array(len);
    for (let i = 0; i < len; i += 3) {
      out[i] = vertices[i] + tx;
      out[i + 1] = vertices[i + 1] + ty;
      out[i + 2] = vertices[i + 2] + tz;
    }
    return out;
  }

  /**
   * Apply scale then optional translation. originalVertices unchanged.
   * @param {Float32Array} originalVertices
   * @param {number} scaleFactor
   * @param {number} tx
   * @param {number} ty
   * @param {number} tz
   * @returns {Float32Array}
   */
  function applyTransform(originalVertices, scaleFactor, tx, ty, tz) {
    const scaled = scaleVertices(originalVertices, scaleFactor);
    if (tx === 0 && ty === 0 && tz === 0) return scaled;
    return translateVertices(scaled, tx, ty, tz);
  }

  /**
   * Get triangle count from vertices length.
   * @param {Float32Array} vertices
   * @returns {number}
   */
  function getTriangleCount(vertices) {
    return Math.floor(vertices.length / 9);
  }

  /** 3x3 rotation matrix (row-major): [m00,m01,m02, m10,m11,m12, m20,m21,m22] */
  const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /** 90° rotation matrices (row-major). axis: 'x'|'y'|'z', sign: +1 or -1 */
  const ROT_90 = {
    x: {
      1: [1, 0, 0, 0, 0, -1, 0, 1, 0],
      '-1': [1, 0, 0, 0, 0, 1, 0, -1, 0]
    },
    y: {
      1: [0, 0, 1, 0, 1, 0, -1, 0, 0],
      '-1': [0, 0, -1, 0, 1, 0, 1, 0, 0]
    },
    z: {
      1: [0, -1, 0, 1, 0, 0, 0, 0, 1],
      '-1': [0, 1, 0, -1, 0, 0, 0, 0, 1]
    }
  };

  function multiplyRotationMatrices(a, b) {
    return [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
      a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
      a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
      a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
      a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
      a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
      a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
    ];
  }

  /**
   * Rotate vertices about center using 3x3 matrix (row-major).
   * v' = center + R * (v - center)
   */
  function rotateVerticesAboutCenter(vertices, center, matrix) {
    const len = vertices.length;
    const out = new Float32Array(len);
    const cx = center.x;
    const cy = center.y;
    const cz = center.z;
    const m = matrix;

    for (let i = 0; i < len; i += 3) {
      const x = vertices[i] - cx;
      const y = vertices[i + 1] - cy;
      const z = vertices[i + 2] - cz;
      out[i] = m[0] * x + m[1] * y + m[2] * z + cx;
      out[i + 1] = m[3] * x + m[4] * y + m[5] * z + cy;
      out[i + 2] = m[6] * x + m[7] * y + m[8] * z + cz;
    }
    return out;
  }

  /**
   * Apply 90° rotation about center. axis: 'x'|'y'|'z', sign: 1 or -1.
   */
  function rotateVertices90(vertices, axis, sign, center) {
    const m = ROT_90[axis][String(sign)];
    return rotateVerticesAboutCenter(vertices, center, m);
  }

  const api = {
    computeBbox,
    scaleVertices,
    computeCenter,
    translateVertices,
    applyTransform,
    getTriangleCount,
    IDENTITY,
    ROT_90,
    multiplyRotationMatrices,
    rotateVerticesAboutCenter,
    rotateVertices90
  };
  window.GEOMETRY = api;
  return api;
})();
