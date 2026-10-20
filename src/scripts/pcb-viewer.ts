import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Darker soldermask / FR4 so green plastic parts (e.g. screw terminal) read clearly. */
const PCB_MASK_GREEN = new Color(0x064a28);
const PCB_FR4_GREEN = new Color(0x053820);
const PCB_COPPER = new Color(0xb87333);
const PCB_HASL = new Color(0xc9a227);

export type PcbPart = {
  ref: string;
  value: string;
  footprint?: string;
};

type NetInfo = {
  label: string;
  role: string;
  connects: string[];
};

type NetSegment = { x1: number; y1: number; x2: number; y2: number; w: number; net: string };
type NetVia = { x: number; y: number; size: number; net: string };
type NetPad = { x: number; y: number; net: string; ref: string; pin: string };

type NetsFile = {
  glbScale?: number;
  nets: Record<string, NetInfo>;
  segments: NetSegment[];
  vias: NetVia[];
  pads: NetPad[];
};

const GENERIC_VALUES = new Set(['', 'TestPoint', 'FIDUCIAL', 'Logo', 'MountingHole']);

function formatValue(part: PcbPart): string {
  const value = part.value?.trim() ?? '';
  if (!value || GENERIC_VALUES.has(value) || value === part.ref) {
    return part.footprint ? `Footprint: ${part.footprint}` : '';
  }
  return value;
}

function formatNet(info: NetInfo): string {
  const links = info.connects.slice(0, 8).join(', ');
  const more = info.connects.length > 8 ? ` (+${info.connects.length - 8})` : '';
  return links ? `${info.role} · ${links}${more}` : info.role;
}

function findNamedAncestor(obj: Object3D | null, refs: Set<string>): Object3D | null {
  let cur: Object3D | null = obj;
  while (cur) {
    if (cur.name && refs.has(cur.name)) return cur;
    cur = cur.parent;
  }
  return null;
}

function ancestorNameMatch(obj: Object3D | null, re: RegExp): boolean {
  let cur: Object3D | null = obj;
  while (cur) {
    if (re.test(cur.name)) return true;
    cur = cur.parent;
  }
  return false;
}

function distPointSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function nearestNet(px: number, py: number, data: NetsFile, maxDist = 1.8): string | null {
  let best: string | null = null;
  let bestD = maxDist;
  for (const s of data.segments) {
    // Treat the copper width as clickable area (plus a little pick slop).
    const d = distPointSeg(px, py, s.x1, s.y1, s.x2, s.y2) - Math.max(s.w, 0.25) * 0.5;
    if (d < bestD) {
      bestD = d;
      best = s.net;
    }
  }
  for (const v of data.vias) {
    const d = Math.hypot(px - v.x, py - v.y) - v.size * 0.5;
    if (d < bestD) {
      bestD = d;
      best = v.net;
    }
  }
  for (const p of data.pads) {
    const d = Math.hypot(px - p.x, py - p.y) - 0.35;
    if (d < bestD) {
      bestD = d;
      best = p.net;
    }
  }
  return best;
}

function pcbXYFromBoardLocal(local: Vector3, glbScale: number) {
  return { x: local.x / glbScale, y: local.z / glbScale };
}

function eachMesh(root: Object3D, fn: (mesh: Mesh) => void) {
  root.traverse((obj) => {
    if ((obj as Mesh).isMesh) fn(obj as Mesh);
  });
}

type TintMode = 'off' | 'hover' | 'selected';

function tint(mesh: Mesh, mode: TintMode) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    const m = mat as MeshStandardMaterial & {
      userData: { em?: number; emI?: number; col?: number };
    };
    if (!m?.emissive || !m.color) continue;
    if (mode === 'off') {
      if (m.userData.em != null) {
        m.emissive.setHex(m.userData.em);
        m.emissiveIntensity = m.userData.emI ?? 1;
        delete m.userData.em;
        delete m.userData.emI;
      }
      if (m.userData.col != null) {
        m.color.setHex(m.userData.col);
        delete m.userData.col;
      }
      continue;
    }
    if (m.userData.em == null) {
      m.userData.em = m.emissive.getHex();
      m.userData.emI = m.emissiveIntensity;
      m.userData.col = m.color.getHex();
    }
    m.emissive.setHex(mode === 'selected' ? 0x1ec8ff : 0x5ec8f0);
    m.emissiveIntensity = mode === 'selected' ? 1.15 : 0.75;
    m.color.setHex(mode === 'selected' ? 0x8fdfff : 0x6ec4e8);
  }
}

export async function mountPcbViewer(root: HTMLElement) {
  if (root.dataset.mounted === '1') return;
  root.dataset.mounted = '1';

  const src = root.dataset.src;
  const partsUrl = root.dataset.parts;
  const netsUrl = root.dataset.nets;
  const canvas = root.querySelector('canvas');
  const tip = root.querySelector<HTMLElement>('[data-tip]');
  const tipRef = root.querySelector<HTMLElement>('[data-ref]');
  const tipVal = root.querySelector<HTMLElement>('[data-val]');
  if (!src || !canvas || !tip || !tipRef || !tipVal) return;

  const partsList: PcbPart[] = partsUrl ? await fetch(partsUrl).then((r) => r.json()) : [];
  const parts = new Map(partsList.map((p) => [p.ref, p]));
  const refs = new Set(parts.keys());
  const netsData: NetsFile | null = netsUrl
    ? await fetch(netsUrl)
        .then((r) => (r.ok ? (r.json() as Promise<NetsFile>) : null))
        .catch(() => null)
    : null;
  const glbScale = netsData?.glbScale ?? 0.001;
  const netMeshes = new Map<string, Mesh[]>();

  const scene = new Scene();
  scene.background = new Color(0xe8ecf0);

  const camera = new PerspectiveCamera(32, 1, 0.01, 100);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xe8ecf0, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Soft studio environment for metal / plastic response.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new AmbientLight(0xffffff, 0.28));
  scene.add(new HemisphereLight(0xeef2f6, 0xb0bac8, 0.42));
  const key = new DirectionalLight(0xfff8f0, 1.2);
  key.position.set(3.5, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 2;
  scene.add(key);
  const fill = new DirectionalLight(0xe8eef8, 0.28);
  fill.position.set(-4, 3, -2);
  scene.add(fill);
  const rim = new DirectionalLight(0xffffff, 0.22);
  rim.position.set(0, 3, -5);
  scene.add(rim);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  const board = new Group();
  scene.add(board);

  const gltf = await new GLTFLoader().loadAsync(src);
  board.add(gltf.scene);

  eachMesh(board, (mesh) => {
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    let isSilk = ancestorNameMatch(mesh, /silk/i);
    const namedCopper = ancestorNameMatch(mesh, /copper|_pad|_via|\bpad\b|\bvia\b/i);
    // Keep J3 terminal housing on its KiCad green (not remapped to soldermask).
    const isScrewTerminal = !!findNamedAncestor(mesh, new Set(['J3']));
    let isMask = false;
    let isCopper = namedCopper;
    let isFr4 = false;

    const cloned = mats.map((mat) => {
      const srcMat = mat as MeshStandardMaterial;
      const c = srcMat.color;
      const opacity = srcMat.opacity ?? 1;

      const silk =
        isSilk ||
        (!!c && c.r > 0.85 && c.g > 0.85 && c.b > 0.85 && opacity > 0.4);
      const mask =
        !silk && !isScrewTerminal && opacity < 0.95 && !!c && c.g > c.r + 0.02 && c.g > c.b;
      // Opaque board body / epoxy green from KiCad (mint → real FR4).
      const fr4 =
        !silk &&
        !mask &&
        !isScrewTerminal &&
        opacity >= 0.95 &&
        !!c &&
        c.g > 0.2 &&
        c.g > c.r + 0.05 &&
        c.g > c.b + 0.02 &&
        c.r < 0.35;
      const copperColor =
        !silk &&
        !mask &&
        !fr4 &&
        !!c &&
        c.r > 0.45 &&
        c.g > 0.25 &&
        c.g < 0.75 &&
        c.b < 0.35 &&
        c.r > c.b + 0.15;
      const copper = namedCopper || copperColor;
      const hasl = copper && !!c && ((c.g > 0.45 && c.b < 0.15) || (c.r > 0.4 && Math.abs(c.r - c.g) < 0.08));

      if (silk) {
        isSilk = true;
        const clone = srcMat.clone();
        clone.color.setRGB(1, 1, 1);
        clone.opacity = 1;
        clone.transparent = false;
        clone.depthWrite = true;
        clone.depthTest = true;
        clone.metalness = 0;
        clone.roughness = 0.78;
        clone.envMapIntensity = 0;
        clone.emissive?.setHex(0x000000);
        clone.polygonOffset = true;
        clone.polygonOffsetFactor = -12;
        clone.polygonOffsetUnits = -12;
        return clone;
      }

      if (mask || fr4) {
        if (mask) isMask = true;
        else isFr4 = true;
        // Glossy solder-mask / substrate like a real finished board.
        const phys = new MeshPhysicalMaterial({
          color: mask ? PCB_MASK_GREEN : PCB_FR4_GREEN,
          metalness: 0.05,
          roughness: mask ? 0.32 : 0.55,
          clearcoat: mask ? 0.55 : 0.15,
          clearcoatRoughness: mask ? 0.28 : 0.55,
          envMapIntensity: 0.85,
          transparent: mask,
          opacity: mask ? 0.92 : 1,
          depthWrite: !mask,
          polygonOffset: true,
          polygonOffsetFactor: mask ? 4 : 0,
          polygonOffsetUnits: mask ? 4 : 0,
        });
        return phys;
      }

      if (copper) {
        isCopper = true;
        const clone = srcMat.clone();
        clone.color.copy(hasl ? PCB_HASL : PCB_COPPER);
        clone.metalness = 0.95;
        clone.roughness = hasl ? 0.18 : 0.32;
        clone.envMapIntensity = 1.35;
        clone.emissive?.setHex(0x000000);
        return clone;
      }

      // Plastics / IC packages — a bit of sheen so parts read as 3D.
      const clone = srcMat.clone();
      clone.emissive?.setHex(0x000000);
      if (typeof clone.metalness === 'number') clone.metalness = Math.min(clone.metalness ?? 0, 0.15);
      if (typeof clone.roughness === 'number') {
        const dark = !!c && c.r < 0.12 && c.g < 0.12 && c.b < 0.12;
        clone.roughness = dark ? 0.42 : Math.min(Math.max(clone.roughness ?? 0.6, 0.4), 0.88);
      }
      clone.envMapIntensity = 0.75;
      return clone;
    });
    mesh.material = cloned.length === 1 ? cloned[0] : cloned;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.pickKind = isSilk
      ? 'silk'
      : isMask
        ? 'mask'
        : isFr4
          ? 'fr4'
          : isCopper
            ? 'copper'
            : 'part';

    if (isSilk) {
      mesh.visible = true;
      mesh.renderOrder = 10;
      mesh.frustumCulled = false;
      // Sit silk clearly above the copper/soldermask plane (KiCad +Y up).
      mesh.position.y += 0.00045;
      // Don't steal clicks from copper underneath labels.
      mesh.raycast = () => {};
    } else if (isMask) {
      mesh.renderOrder = 1;
    } else if (isCopper) {
      mesh.renderOrder = 2;
    } else if (isFr4) {
      mesh.renderOrder = 0;
    }
  });

  // Starting pose: three-quarter view, heatsinks back-left, terminal back-right,
  // DIP toward the near edge (same framing as the reference screenshot).
  const box0 = new Box3().setFromObject(board);
  board.position.sub(box0.getCenter(new Vector3()));
  board.rotation.x = MathUtils.degToRad(-10);
  board.rotation.y = MathUtils.degToRad(165);
  board.rotation.z = MathUtils.degToRad(8);
  board.updateMatrixWorld(true);
  const box = new Box3().setFromObject(board);
  board.position.sub(box.getCenter(new Vector3()));
  board.updateMatrixWorld(true);

  const size = new Box3().setFromObject(board).getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fit = maxDim * 1.55;
  camera.position.set(fit * 0.55, fit * 0.72, fit * 0.85);
  controls.target.set(0, 0, 0);
  controls.minDistance = maxDim * 0.55;
  controls.maxDistance = maxDim * 3.2;
  camera.near = maxDim * 0.01;
  camera.far = maxDim * 20;
  camera.updateProjectionMatrix();
  // Soft contact shadows scaled to the board.
  const sc = key.shadow.camera;
  const extent = maxDim * 0.85;
  sc.left = -extent;
  sc.right = extent;
  sc.top = extent;
  sc.bottom = -extent;
  sc.near = maxDim * 0.05;
  sc.far = maxDim * 6;
  sc.updateProjectionMatrix();
  key.shadow.bias = -0.0002;
  controls.update();

  // Map copper / pad / via mesh islands to KiCad nets via PCB XY (GLB XZ in meters).
  if (netsData) {
    const samples: Vector3[] = [];
    eachMesh(board, (mesh) => {
      if (mesh.userData.pickKind !== 'copper') return;
      const bb = new Box3().setFromObject(mesh);
      samples.length = 0;
      samples.push(bb.getCenter(new Vector3()));
      samples.push(new Vector3(bb.min.x, (bb.min.y + bb.max.y) * 0.5, bb.min.z));
      samples.push(new Vector3(bb.max.x, (bb.min.y + bb.max.y) * 0.5, bb.max.z));
      samples.push(new Vector3(bb.min.x, (bb.min.y + bb.max.y) * 0.5, bb.max.z));
      samples.push(new Vector3(bb.max.x, (bb.min.y + bb.max.y) * 0.5, bb.min.z));

      const votes = new Map<string, number>();
      for (const sample of samples) {
        board.worldToLocal(sample);
        const { x, y } = pcbXYFromBoardLocal(sample, glbScale);
        const net = nearestNet(x, y, netsData, 4);
        if (!net) continue;
        votes.set(net, (votes.get(net) ?? 0) + 1);
      }
      let best: string | null = null;
      let bestN = 0;
      for (const [net, n] of votes) {
        if (n > bestN) {
          best = net;
          bestN = n;
        }
      }
      if (!best) return;
      mesh.userData.net = best;
      const list = netMeshes.get(best) ?? [];
      list.push(mesh);
      netMeshes.set(best, list);
    });
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  type HitTarget =
    | { kind: 'part'; obj: Object3D }
    | { kind: 'net'; name: string };
  let selected: HitTarget | null = null;
  let hovered: HitTarget | null = null;
  let painted: HitTarget[] = [];
  let pointerDown: { x: number; y: number } | null = null;
  let dragging = false;

  const placeTip = (clientX?: number, clientY?: number) => {
    if (clientX == null || clientY == null) return;
    const rect = root.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pad = 12;
    const tw = tip.offsetWidth || 180;
    const th = tip.offsetHeight || 56;
    const left = Math.min(Math.max(pad, x + 14), rect.width - tw - pad);
    const top = Math.min(Math.max(pad, y + 14), rect.height - th - pad);
    tip.style.transform = `translate(${left}px, ${top}px)`;
  };

  const setTip = (
    title: string | null,
    detail: string,
    clientX?: number,
    clientY?: number,
  ) => {
    if (!title) {
      tip.hidden = true;
      return;
    }
    tipRef.textContent = title;
    tipVal.textContent = detail;
    tipVal.hidden = !detail;
    tip.hidden = false;
    placeTip(clientX, clientY);
  };

  const targetKey = (t: HitTarget | null) => {
    if (!t) return '';
    return t.kind === 'part' ? `p:${t.obj.uuid}` : `n:${t.name}`;
  };

  // Bright polyline overlay so thin tracks read clearly under soldermask.
  const netOverlay = new Group();
  netOverlay.name = 'net-overlay';
  board.add(netOverlay);

  const clearNetOverlay = () => {
    for (const child of [...netOverlay.children]) {
      netOverlay.remove(child);
      const line = child as LineSegments;
      line.geometry?.dispose();
      const mat = line.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  };

  const showNetOverlay = (netName: string | null, strong: boolean) => {
    clearNetOverlay();
    if (!netName || !netsData) return;

    const y = 0.00178;
    const pos: number[] = [];
    for (const s of netsData.segments) {
      if (s.net !== netName) continue;
      pos.push(s.x1 * glbScale, y, s.y1 * glbScale);
      pos.push(s.x2 * glbScale, y, s.y2 * glbScale);
    }
    for (const v of netsData.vias) {
      if (v.net !== netName) continue;
      const r = Math.max(v.size, 0.45) * glbScale * 0.6;
      const cx = v.x * glbScale;
      const cz = v.y * glbScale;
      pos.push(cx - r, y, cz, cx + r, y, cz);
      pos.push(cx, y, cz - r, cx, y, cz + r);
    }
    if (pos.length < 6) return;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    const mat = new LineBasicMaterial({
      color: strong ? 0x2ec8ff : 0x7ed4f5,
      transparent: true,
      opacity: strong ? 0.98 : 0.82,
      depthTest: false,
      depthWrite: false,
    });
    const lines = new LineSegments(geo, mat);
    lines.renderOrder = 40;
    lines.frustumCulled = false;
    lines.raycast = () => {};
    netOverlay.add(lines);
  };

  const applyTint = (t: HitTarget | null, mode: TintMode) => {
    if (!t) return;
    if (t.kind === 'part') eachMesh(t.obj, (mesh) => tint(mesh, mode));
    else for (const mesh of netMeshes.get(t.name) ?? []) tint(mesh, mode);
  };

  const refreshTints = () => {
    for (const t of painted) applyTint(t, 'off');
    painted = [];
    // Highlight only while the cursor is over a clickable target.
    if (!hovered) {
      showNetOverlay(null, false);
      return;
    }
    const mode =
      selected && targetKey(selected) === targetKey(hovered) ? 'selected' : 'hover';
    applyTint(hovered, mode);
    painted.push(hovered);
    if (hovered.kind === 'net') showNetOverlay(hovered.name, mode === 'selected');
    else showNetOverlay(null, false);
  };

  const netAtBoardPoint = (worldPoint: Vector3, maxDist = 3.5) => {
    if (!netsData) return null;
    const local = board.worldToLocal(worldPoint.clone());
    const { x, y } = pcbXYFromBoardLocal(local, glbScale);
    return nearestNet(x, y, netsData, maxDist);
  };

  const hitTest = (clientX: number, clientY: number): HitTarget | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(board, true);

    for (const hit of hits) {
      const kind = (hit.object as Mesh).userData?.pickKind as string | undefined;

      if (kind === 'part') {
        const named = findNamedAncestor(hit.object, refs);
        if (named) return { kind: 'part', obj: named };
      }

      if (kind === 'copper') {
        const name =
          (hit.object.userData.net as string | undefined) ?? netAtBoardPoint(hit.point, 4);
        if (name && netsData?.nets[name]) return { kind: 'net', name };
      }

      if (kind === 'mask' || kind === 'fr4') {
        const name = netAtBoardPoint(hit.point, 3.5);
        if (name && netsData?.nets[name]) return { kind: 'net', name };
      }
    }
    return null;
  };

  const showInfo = (target: HitTarget, clientX: number, clientY: number) => {
    if (target.kind === 'part') {
      const part = parts.get(target.obj.name) ?? { ref: target.obj.name, value: '' };
      setTip(part.ref, formatValue(part), clientX, clientY);
      return;
    }
    const info = netsData?.nets[target.name];
    if (!info) return;
    setTip(info.label, formatNet(info), clientX, clientY);
  };

  const setHovered = (next: HitTarget | null) => {
    if (targetKey(next) === targetKey(hovered)) return;
    hovered = next;
    refreshTints();
    root.style.cursor = next ? 'pointer' : dragging || pointerDown ? 'grabbing' : 'grab';
  };

  const select = (next: HitTarget | null, clientX: number, clientY: number) => {
    selected = next;
    if (next) {
      hovered = next;
      controls.autoRotate = false;
      showInfo(next, clientX, clientY);
    } else {
      setTip(null, '');
    }
    refreshTints();
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = root;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  resize();
  new ResizeObserver(resize).observe(root);

  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = { x: e.clientX, y: e.clientY };
    dragging = false;
    root.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown) {
      if (Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5) {
        dragging = true;
        setHovered(null);
      }
      return;
    }
    setHovered(hitTest(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = dragging;
    pointerDown = null;
    dragging = false;
    if (wasDrag) {
      root.style.cursor = 'grab';
      return;
    }
    const target = hitTest(e.clientX, e.clientY);
    select(target, e.clientX, e.clientY);
    root.style.cursor = target ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => {
    pointerDown = null;
    dragging = false;
    setHovered(null);
    root.style.cursor = 'grab';
  });

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    controls.update();
    renderer.render(scene, camera);
  };
  frame();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else frame();
  });
}
