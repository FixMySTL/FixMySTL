/**
 * preview.js — Three.js scene, camera, renderer, mesh update.
 * OrbitControls via CDN. Auto-fit camera to bounding box.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const Preview = (function () {
  'use strict';

  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let mesh = null;
  let gridHelper = null;
  let bboxHelper = null;
  let dimLabelsEl = null;
  let containerEl = null;

  function updateGrid(bbox) {
    if (!bbox || !scene) return;
    const maxDim = Math.max(bbox.size.x, bbox.size.y, bbox.size.z, 1);
    const gridSize = Math.max(10, Math.min(maxDim * 5, 2000));
    const divisions = Math.max(10, Math.min(Math.round((gridSize / maxDim) * 10), 200));

    if (gridHelper) {
      scene.remove(gridHelper);
      gridHelper.geometry.dispose();
      if (Array.isArray(gridHelper.material)) {
        gridHelper.material.forEach(function (m) { m.dispose(); });
      } else if (gridHelper.material) {
        gridHelper.material.dispose();
      }
    }

    gridHelper = new THREE.GridHelper(gridSize, divisions, 0xcccccc, 0xdddddd);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
  }

  function init(containerElement) {
    containerEl = containerElement;
    const width = Math.max(containerEl.clientWidth || 800, 100);
    const height = Math.max(containerEl.clientHeight || 400, 300);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(renderer.domElement);

    dimLabelsEl = document.createElement('div');
    dimLabelsEl.className = 'dim-labels hidden';
    containerEl.appendChild(dimLabelsEl);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xdddddd);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    animate();
  }

  function animate() {
    if (!renderer || !scene || !camera) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function setMesh(vertices, triangleCount, bbox) {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    const positions = new Float32Array(triangleCount * 9);
    for (let i = 0; i < vertices.length; i++) {
      positions[i] = vertices[i];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      flatShading: false,
      side: THREE.DoubleSide
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    fitCameraToBbox(bbox);
  }

  function updateMeshPositions(vertices) {
    if (!mesh || !mesh.geometry) return;
    const pos = mesh.geometry.attributes.position;
    if (pos.array.length !== vertices.length) return;
    for (let i = 0; i < vertices.length; i++) {
      pos.array[i] = vertices[i];
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  function setBoundingBoxVisible(visible, bbox) {
    if (bboxHelper) {
      scene.remove(bboxHelper);
      bboxHelper.geometry.dispose();
      bboxHelper.material.dispose();
      bboxHelper = null;
    }

    if (visible && bbox) {
      const cx = (bbox.min.x + bbox.max.x) / 2;
      const cy = (bbox.min.y + bbox.max.y) / 2;
      const cz = (bbox.min.z + bbox.max.z) / 2;
      const sx = bbox.size.x;
      const sy = bbox.size.y;
      const sz = bbox.size.z;
      const boxGeom = new THREE.BoxGeometry(sx, sy, sz);
      const edges = new THREE.EdgesGeometry(boxGeom);
      boxGeom.dispose();
      const lineMat = new THREE.LineBasicMaterial({ color: 0x888888 });
      bboxHelper = new THREE.LineSegments(edges, lineMat);
      bboxHelper.position.set(cx, cy, cz);
      scene.add(bboxHelper);
    }
  }

  function setDimensionsOverlayVisible(visible) {
    if (!dimLabelsEl) return;
    if (visible) {
      dimLabelsEl.classList.remove('hidden');
    } else {
      dimLabelsEl.classList.add('hidden');
    }
  }

  function updateDimensionsOverlay(bbox, displayUnit) {
    if (!dimLabelsEl || !bbox) return;

    const unit = displayUnit || 'mm';
    const suffix = unit === 'inch' ? ' in' : ' mm';
    const fmt = unit === 'inch'
      ? (v) => (v != null ? (Number(v) / 25.4).toFixed(3) : '—')
      : (v) => (v != null ? Number(v).toFixed(2) : '—');

    dimLabelsEl.innerHTML = `
      <span>BBox X: ${fmt(bbox.size.x)}${suffix}</span>
      <span>BBox Y: ${fmt(bbox.size.y)}${suffix}</span>
      <span>BBox Z: ${fmt(bbox.size.z)}${suffix}</span>
    `;
  }

  function updateBoundingBoxAndLabels(bbox, displayUnit, showBbox) {
    setBoundingBoxVisible(showBbox, bbox);
    setDimensionsOverlayVisible(showBbox && !!bbox);
    if (showBbox && bbox) {
      updateDimensionsOverlay(bbox, displayUnit);
    }
  }

  function fitCameraToBbox(bbox) {
    if (!bbox || !camera || !controls) return;
    updateGrid(bbox);

    const size = bbox.size;
    const center = {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: (bbox.min.z + bbox.max.z) / 2
    };

    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const distance = maxDim * 1.5;

    camera.position.set(
      center.x + distance * 0.6,
      center.y + distance * 0.6,
      center.z + distance * 0.6
    );
    controls.target.set(center.x, center.y, center.z);
    controls.update();
  }

  function clear() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh = null;
    }
    if (gridHelper) {
      scene.remove(gridHelper);
      gridHelper.geometry.dispose();
      if (Array.isArray(gridHelper.material)) {
        gridHelper.material.forEach(function (m) { m.dispose(); });
      } else if (gridHelper.material) {
        gridHelper.material.dispose();
      }
      gridHelper = null;
    }
    if (bboxHelper) {
      scene.remove(bboxHelper);
      bboxHelper.geometry.dispose();
      bboxHelper.material.dispose();
      bboxHelper = null;
    }
    if (dimLabelsEl) {
      dimLabelsEl.classList.add('hidden');
    }
  }

  function resize() {
    if (!containerEl || !renderer || !camera) return;
    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight || 400;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    init,
    setMesh,
    updateMeshPositions,
    fitCameraToBbox,
    setBoundingBoxVisible,
    setDimensionsOverlayVisible,
    updateDimensionsOverlay,
    updateBoundingBoxAndLabels,
    clear,
    resize
  };
})();

export { Preview };
