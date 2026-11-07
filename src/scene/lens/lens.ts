import * as THREE from 'three';
import { COPY } from '@/copy';
import type { Vec3 } from '@/models/types';
import { LENS_SIZE, PHONE_MAX_WIDTH, placeLens, pushOut } from '@/scene/lens/placement';
import { smoothToward } from '@/scene/lens/smoothing';
import type { Lens, LensHost, LensOptions, LensScene, Placement, PlacementInput, Point, Rect } from '@/scene/lens/types';
import type { Stage } from '@/scene/types';
import { el } from '@/ui/dom';

const FADE_MS = 250;
const SMOOTH_RATE = 12;
const MOVE_EPSILON = 0.25;
const SVG_NS = 'http://www.w3.org/2000/svg';

export function createLens(stage: Stage, root: HTMLElement, host: LensHost): Lens {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const magnified = el('span', { class: 'lens-tag' }, [COPY.LENS.MAGNIFIED]);
  const sped = el('span', { class: 'lens-tag', hidden: true }, [COPY.LENS.SPED_UP]);
  const label = (sped: boolean): string => [COPY.LENS.LABEL, COPY.LENS.MAGNIFIED, ...(sped ? [COPY.LENS.SPED_UP] : [])].join('. ');
  const circle = el('div', { class: 'lens', role: 'img', 'aria-hidden': 'true', 'aria-label': label(false) }, [el('div', { class: 'lens-tags' }, [magnified, sped])]);
  const leader = document.createElementNS(SVG_NS, 'svg');
  leader.setAttribute('class', 'lens-leader');
  leader.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS(SVG_NS, 'line');
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', '4');
  leader.append(line, dot);
  root.replaceChildren(leader, circle);

  const projected = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const emptyRects = (nodes: HTMLElement[]): Rect[] => nodes.map(() => ({ left: 0, top: 0, right: 0, bottom: 0 }));
  const obstacles = emptyRects(host.obstacles);
  const keepOut = emptyRects(host.keepOut);
  const shifted: Point = { x: 0, y: 0 };
  const placed: Placement = { center: { x: 0, y: 0 }, size: 0 };
  const input: PlacementInput = { anchorScreen: { x: 0, y: 0 }, viewport: { width: 0, height: 0 }, obstacles, keepOut, phone: false, size: LENS_SIZE.desktop };

  let renderer: THREE.WebGLRenderer | null = null;
  let content: LensScene | null = null;
  let shown = false;
  let active = false;
  let fadeEnd = 0;
  let dirty = true;
  let bufferSize = 0;
  let displayX = 0;
  let displayY = 0;
  let displaySize = 0;
  let snapNext = true;
  let settled = false;
  let lastAnchorX = Infinity;
  let lastAnchorY = Infinity;
  let failed = false;
  let disposed = false;

  const setActive = (next: boolean): void => {
    if (active === next) return;
    active = next;
    host.onActiveChange(next);
  };

  const measureRects = (nodes: HTMLElement[], into: Rect[]): void => {
    nodes.forEach((node, i) => {
      const rect = node.getBoundingClientRect();
      into[i].left = rect.left;
      into[i].top = rect.top;
      into[i].right = rect.right;
      into[i].bottom = rect.bottom;
    });
  };

  const measure = (): void => {
    input.viewport.width = root.clientWidth;
    input.viewport.height = root.clientHeight;
    input.phone = window.innerWidth <= PHONE_MAX_WIDTH;
    input.size = input.phone ? LENS_SIZE.phone : LENS_SIZE.desktop;
    measureRects(host.obstacles, obstacles);
    measureRects(host.keepOut, keepOut);
    dirty = true;
  };
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  host.obstacles.forEach((node) => observer.observe(node));
  host.keepOut.forEach((node) => observer.observe(node));
  measure();

  const releaseRenderer = (): void => {
    if (!renderer) return;
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    renderer = null;
    bufferSize = 0;
  };

  const releaseContent = (): void => {
    content?.dispose();
    content = null;
  };

  const finishFade = (): void => {
    fadeEnd = 0;
    releaseContent();
    setActive(false);
  };

  const layout = (dt: number): void => {
    projected.copy(anchor).project(stage.camera);
    const ax = (projected.x * 0.5 + 0.5) * input.viewport.width;
    const ay = (0.5 - projected.y * 0.5) * input.viewport.height;
    if (dirty || Math.abs(ax - lastAnchorX) >= MOVE_EPSILON || Math.abs(ay - lastAnchorY) >= MOVE_EPSILON) {
      dirty = false;
      settled = false;
      lastAnchorX = ax;
      lastAnchorY = ay;
      input.anchorScreen.x = ax;
      input.anchorScreen.y = ay;
      placeLens(input, placed);
      if (placed.size !== bufferSize) {
        bufferSize = placed.size;
        renderer?.setSize(placed.size, placed.size);
        circle.style.width = `${placed.size}px`;
        circle.style.height = `${placed.size}px`;
      }
    }
    if (settled) return;
    const step = snapNext || reducedMotion.matches ? 0 : dt;
    snapNext = false;
    displayX = smoothToward(displayX, placed.center.x, step, SMOOTH_RATE);
    displayY = smoothToward(displayY, placed.center.y, step, SMOOTH_RATE);
    displaySize = smoothToward(displaySize, placed.size, step, SMOOTH_RATE);
    settled = displayX === placed.center.x && displayY === placed.center.y && displaySize === placed.size;
    if (!settled) {
      shifted.x = displayX;
      shifted.y = displayY;
      for (let i = 0; i < keepOut.length; i++) pushOut(shifted, displaySize / 2, keepOut[i]);
      displayX = shifted.x;
      displayY = shifted.y;
    }
    const scale = displaySize / placed.size;
    circle.style.transform = `translate(${displayX - displaySize / 2}px, ${displayY - displaySize / 2}px) scale(${scale})`;
    const dx = ax - displayX;
    const dy = ay - displayY;
    const length = Math.hypot(dx, dy) || 1;
    line.x1.baseVal.value = displayX + (dx / length) * (displaySize / 2);
    line.y1.baseVal.value = displayY + (dy / length) * (displaySize / 2);
    line.x2.baseVal.value = ax;
    line.y2.baseVal.value = ay;
    dot.cx.baseVal.value = ax;
    dot.cy.baseVal.value = ay;
  };

  const instantHide = (): void => {
    root.dataset.instant = '';
    delete root.dataset.shown;
    circle.setAttribute('aria-hidden', 'true');
    void root.offsetWidth;
    delete root.dataset.instant;
  };

  const teardown = (): void => {
    shown = false;
    instantHide();
    finishFade();
    releaseRenderer();
  };

  const lens: Lens = {
    show(factory: () => LensScene, anchorWorld: Vec3, opts?: LensOptions): void {
      if (disposed || failed) return;
      let next: LensScene | null = null;
      try {
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          circle.prepend(renderer.domElement);
          bufferSize = 0;
        }
        next = factory();
        next.camera.aspect = 1;
        next.camera.updateProjectionMatrix();
      } catch {
        next?.dispose();
        teardown();
        failed = true;
        return;
      }
      releaseContent();
      content = next;
      snapNext = !shown && fadeEnd === 0;
      settled = false;
      sped.hidden = !opts?.sped;
      circle.setAttribute('aria-label', label(opts?.sped === true));
      input.clearance = opts?.clearance;
      anchor.set(...anchorWorld);
      shown = true;
      fadeEnd = 0;
      dirty = true;
      root.dataset.shown = '';
      circle.removeAttribute('aria-hidden');
      setActive(true);
    },
    hide(): void {
      if (!shown) return;
      shown = false;
      delete root.dataset.shown;
      circle.setAttribute('aria-hidden', 'true');
      if (reducedMotion.matches) finishFade();
      else fadeEnd = performance.now() + FADE_MS;
    },
    setAnchor(anchorWorld: Vec3): void {
      anchor.set(...anchorWorld);
      dirty = true;
    },
    update(dt: number): void {
      if (fadeEnd !== 0 && performance.now() >= fadeEnd) finishFade();
      if (!renderer || !content) return;
      try {
        layout(dt);
        content.update(reducedMotion.matches ? 0 : dt);
        renderer.render(content.scene, content.camera);
      } catch {
        teardown();
        failed = true;
      }
    },
    endStation(): void {
      failed = false;
      teardown();
    },
    dispose(): void {
      if (disposed) return;
      lens.endStation();
      disposed = true;
      observer.disconnect();
      root.replaceChildren();
    },
  };
  return lens;
}
