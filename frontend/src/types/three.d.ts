/**
 * Minimal typings for three.js (package build has no bundled .d.ts here).
 * Keeps `import * as THREE` + `Texture` import working for Next/TS.
 */
declare module "three" {
  export const SRGBColorSpace: string;
  export const NoColorSpace: string;
  export const ACESFilmicToneMapping: number;
  export const AdditiveBlending: number;
  export const BackSide: number;

  export class ShaderMaterial {
    constructor(params?: Record<string, unknown>);
  }

  export class Color {
    constructor(hex?: number | string);
    set(value: number | string): this;
  }

  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    clone(): Vector3;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    normalize(): this;
    distanceTo(v: Vector3): number;
    project(camera: PerspectiveCamera): Vector3;
  }

  export class Texture {
    anisotropy: number;
    colorSpace?: string;
    wrapS: number;
    wrapT: number;
    repeat: Vector2 & { set(x: number, y: number): void };
  }

  export class MeshPhongMaterial {
    map: Texture | null;
    bumpMap?: Texture | null;
    bumpScale?: number;
    normalMap?: Texture | null;
    normalScale?: Vector2;
    specularMap?: Texture | null;
    specular: Color;
    shininess: number;
    constructor(params?: Record<string, unknown>);
  }

  export class MeshBasicMaterial {
    constructor(params?: Record<string, unknown>);
  }

  export class LineBasicMaterial {
    constructor(params?: Record<string, unknown>);
  }

  export class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number);
  }

  export class BufferGeometry {
    setFromPoints(points: Vector3[]): this;
    setAttribute(name: string, attr: BufferAttribute): this;
    dispose(): void;
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class Object3D {
    position: Vector3;
    rotation: { x: number; y: number; z: number };
    quaternion: Quaternion;
    userData: Record<string, unknown>;
    children: Object3D[];
    parent: Object3D | null;
    visible: boolean;
    add(...objs: unknown[]): void;
    remove(obj: unknown): void;
    traverse(cb: (obj: Object3D) => void): void;
  }

  export class Mesh extends Object3D {
    material: unknown;
    geometry: BufferGeometry;
    constructor(geometry?: unknown, material?: unknown);
  }

  export class Scene {
    background: Color | null;
    add(...objs: unknown[]): void;
  }

  export class PerspectiveCamera {
    aspect: number;
    position: Vector3;
    updateProjectionMatrix(): void;
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    capabilities: { getMaxAnisotropy(): number };
    outputColorSpace?: string;
    toneMapping?: number;
    toneMappingExposure?: number;
    constructor(params?: Record<string, unknown>);
    setSize(w: number, h: number): void;
    setPixelRatio(r: number): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }

  export class AmbientLight {
    constructor(color?: number, intensity?: number);
  }

  export class HemisphereLight {
    constructor(skyColor?: number, groundColor?: number, intensity?: number);
  }

  export class DirectionalLight {
    position: Vector3;
    constructor(color?: number, intensity?: number);
  }

  export class Group extends Object3D {
    add(...objs: unknown[]): void;
    remove(obj: unknown): void;
  }

  export class Line {
    constructor(geometry?: unknown, material?: unknown);
  }

  export class LineSegments {
    constructor(geometry?: unknown, material?: unknown);
  }

  export class PointsMaterial {
    constructor(params?: Record<string, unknown>);
  }

  export class Points extends Object3D {
    constructor(geometry?: unknown, material?: unknown);
  }

  export class Raycaster {
    ray: Ray;
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void;
    intersectObjects(
      objects: unknown[],
      recursive?: boolean
    ): Array<{ object: Object3D }>;
  }

  export class TextureLoader {
    load(
      url: string,
      onLoad?: (tex: Texture) => void,
      onProgress?: unknown,
      onError?: () => void
    ): Texture;
  }

  // --- Дополнено 07.09.2026 для QSpace (3D-модельер помещений). ---
  // Существующие объявления выше не менялись (их читает Globus3D);
  // здесь только то, чего не хватало: геометрии, ламберт-материал,
  // канвас-текстура, плоскость, кватернион, луч.

  export const DoubleSide: number;
  export const RepeatWrapping: number;

  export class Quaternion {
    setFromUnitVectors(from: Vector3, to: Vector3): this;
  }

  export class Plane {
    constructor(normal?: Vector3, constant?: number);
  }

  export class Ray {
    intersectPlane(plane: Plane, target: Vector3): Vector3 | null;
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export class CylinderGeometry extends BufferGeometry {
    constructor(
      radiusTop?: number,
      radiusBottom?: number,
      height?: number,
      radialSegments?: number,
      heightSegments?: number,
      openEnded?: boolean
    );
  }

  export class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number);
  }

  export class MeshLambertMaterial {
    color: Color;
    emissive: Color;
    map: Texture | null;
    needsUpdate: boolean;
    side?: number;
    constructor(params?: Record<string, unknown>);
  }

  export class CanvasTexture extends Texture {
    constructor(canvas: HTMLCanvasElement);
  }
}

// Экспорт сцены в GLB (двоичный glTF) — из примеров three, своих типов нет.
declare module "three/examples/jsm/exporters/GLTFExporter.js" {
  import type { Object3D } from "three";
  export class GLTFExporter {
    parse(
      input: Object3D | Object3D[],
      onDone: (result: ArrayBuffer | object) => void,
      onError: (err: unknown) => void,
      options?: Record<string, unknown>
    ): void;
  }
}

// Управление камерой из примеров three (у пакета нет собственных типов
// в этой сборке — см. комментарий в шапке файла).
declare module "three/examples/jsm/controls/OrbitControls.js" {
  import type { PerspectiveCamera, Vector3 } from "three";
  export class OrbitControls {
    constructor(camera: PerspectiveCamera, domElement: HTMLElement);
    enabled: boolean;
    enableDamping: boolean;
    maxPolarAngle: number;
    target: Vector3;
    update(): void;
  }
}
