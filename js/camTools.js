/**
 * camTools.js — Pre-slicer estimation helpers (material, cost, time, overhang, footprint).
 * All computations run locally. Estimates are approximate; slicer preview is final.
 */

if (typeof console !== 'undefined') console.log('camTools.js loaded');

export const MATERIALS = [
  { key: 'pla', label: 'PLA', density: 1.24 },
  { key: 'petg', label: 'PETG', density: 1.27 },
  { key: 'abs', label: 'ABS', density: 1.04 },
  { key: 'tpu', label: 'TPU', density: 1.20 }
];

export const SHELL_PRESETS = [
  { key: 'draft', label: 'Draft', mult: 1.05 },
  { key: 'normal', label: 'Normal', mult: 1.12 },
  { key: 'strong', label: 'Strong', mult: 1.20 }
];

export const FLOW_PROFILES = [
  { key: 'slow', label: 'Slow', flow: 2.5 },
  { key: 'normal', label: 'Normal', flow: 5.0 },
  { key: 'fast', label: 'Fast', flow: 8.0 }
];

export const FILAMENT_DIAMETERS = [
  { key: '1.75', value: 1.75 },
  { key: '2.85', value: 2.85 }
];

export const OVERHANG_THRESHOLDS = [
  { key: '45', value: 45, label: '45°' },
  { key: '60', value: 60, label: '60°' },
  { key: '70', value: 70, label: '70°' }
];

/**
 * Compute triangle normal (unit) and area from vertices. v1,v2,v3 at offset i.
 */
function triangleNormalAndArea(vertices, i) {
  const v1x = vertices[i]; const v1y = vertices[i + 1]; const v1z = vertices[i + 2];
  const v2x = vertices[i + 3]; const v2y = vertices[i + 4]; const v2z = vertices[i + 5];
  const v3x = vertices[i + 6]; const v3y = vertices[i + 7]; const v3z = vertices[i + 8];
  const ax = v2x - v1x; const ay = v2y - v1y; const az = v2z - v1z;
  const bx = v3x - v1x; const by = v3y - v1y; const bz = v3z - v1z;
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1e-10;
  const area = 0.5 * len;
  return {
    nx: cx / len, ny: cy / len, nz: cz / len,
    area: area
  };
}

/**
 * Overhang risk: % of surface area with normal angle > threshold (facing downward, nz < 0).
 * vertices in mm; returns { riskPct, totalArea, riskArea, band: 'low'|'medium'|'high' }
 */
export function computeOverhangRisk(vertices, triCount, thresholdDeg = 60) {
  if (!vertices || triCount === 0) return { riskPct: 0, totalArea: 0, riskArea: 0, band: 'low' };
  let totalArea = 0;
  let riskArea = 0;
  const cosThreshold = Math.cos(thresholdDeg * Math.PI / 180);
  for (let t = 0; t < triCount; t++) {
    const { nx, ny, nz, area } = triangleNormalAndArea(vertices, t * 9);
    totalArea += area;
    const verticalComponent = Math.abs(nz);
    if (verticalComponent < cosThreshold && nz < 0) {
      riskArea += area;
    }
  }
  const riskPct = totalArea > 0 ? 100 * riskArea / totalArea : 0;
  let band = 'low';
  if (riskPct >= 25) band = 'high';
  else if (riskPct >= 10) band = 'medium';
  return { riskPct, totalArea, riskArea, band };
}

/**
 * Material usage estimate.
 * volumeMm3: mesh volume in mm³
 * Returns { mass_g, effectiveVolCm3, effectiveVolMm3 }
 */
export function estimateMaterial(volumeMm3, densityGcm3, infillPct, shellMult) {
  const meshVolCm3 = volumeMm3 / 1000;
  const effectiveVolCm3 = meshVolCm3 * (infillPct / 100) * shellMult;
  const mass_g = effectiveVolCm3 * densityGcm3;
  return {
    mass_g,
    effectiveVolCm3,
    effectiveVolMm3: effectiveVolCm3 * 1000
  };
}

/**
 * Filament length (m) from effective volume and diameter.
 */
export function estimateFilamentLength(effectiveVolMm3, filamentDiaMm) {
  const areaMm2 = Math.PI * Math.pow(filamentDiaMm / 2, 2);
  const lengthMm = areaMm2 > 0 ? effectiveVolMm3 / areaMm2 : 0;
  return lengthMm / 1000;
}

/**
 * Material cost ($) from mass (g) and price per kg.
 */
export function estimateCost(mass_g, pricePerKg) {
  return mass_g * (pricePerKg / 1000);
}

/**
 * Rough print time (hours) from effective volume and flow rate.
 */
export function estimatePrintTime(effectiveVolMm3, flowMm3s) {
  const time_s = flowMm3s > 0 ? effectiveVolMm3 / flowMm3s : 0;
  return time_s / 3600;
}
