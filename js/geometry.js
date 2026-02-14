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
   * Get triangle count from vertices length.
   * @param {Float32Array} vertices
   * @returns {number}
   */
  function getTriangleCount(vertices) {
    return Math.floor(vertices.length / 9);
  }

  const api = { computeBbox, scaleVertices, getTriangleCount };
  window.GEOMETRY = api;
  return api;
})();
