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
    constructor(hex?: number);
  }

  export class Vector2 {
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
    project(camera: PerspectiveCamera): Vector3;
  }

  export class Texture {
    anisotropy: number;
    colorSpace?: string;
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
    userData: Record<string, unknown>;
    remove(obj: unknown): void;
  }

  export class Mesh extends Object3D {
    material: unknown;
    geometry: BufferGeometry;
    constructor(geometry?: unknown, material?: unknown);
  }

  export class Scene {
    add(obj: unknown): void;
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
    add(obj: unknown): void;
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
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void;
    intersectObjects(
      objects: unknown[],
      recursive?: boolean
    ): Array<{ object: unknown }>;
  }

  export class TextureLoader {
    load(
      url: string,
      onLoad?: (tex: Texture) => void,
      onProgress?: unknown,
      onError?: () => void
    ): Texture;
  }
}
