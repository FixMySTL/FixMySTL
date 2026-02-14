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
  let containerEl = null;

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

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(200, 20, 0xcccccc, 0xdddddd);
    grid.position.y = 0;
    scene.add(grid);

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

  function fitCameraToBbox(bbox) {
    if (!bbox || !camera || !controls) return;

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
    clear,
    resize
  };
})();

export { Preview };
