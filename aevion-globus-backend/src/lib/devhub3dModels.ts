/**
 * 3D asset generation for DevHub — a capability the platform did not have at
 * all. Both models run on the REPLICATE_API_TOKEN already configured, so this
 * adds a media type rather than a vendor.
 *
 * Output is a GLB mesh: usable in three.js, Unity, Blender, or dropped
 * straight into a generated web project.
 */

export type ThreeDModel = {
  id: string;
  /** Replicate needs an explicit version hash for these community models. */
  version: string;
  label: string;
  provider: string;
  note: string;
  toInput: (args: { imageUrl: string; textureSize?: number; removeBackground?: boolean }) => Record<string, unknown>;
};

export const THREED_MODELS: ThreeDModel[] = [
  {
    id: "firtoz/trellis",
    version: "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c",
    label: "TRELLIS — textured mesh from one or more views",
    provider: "Microsoft",
    note: "Default. Colour texture baked in; accepts several views of the same object for better geometry.",
    toInput: ({ imageUrl, textureSize }) => ({
      images: [imageUrl],
      texture_size: textureSize && textureSize >= 512 && textureSize <= 2048 ? textureSize : 1024,
      generate_color: true,
      generate_model: true,
      mesh_simplify: 0.95,
      randomize_seed: true,
    }),
  },
  {
    id: "tencent/hunyuan3d-2",
    version: "b1b9449a1277e10402781c5d41eb30c0a0683504fb23fab591ca9dfc2aabe1cb",
    label: "Hunyuan3D 2 — high-resolution geometry",
    provider: "Tencent",
    note: "Denser geometry, single image, background removed automatically.",
    toInput: ({ imageUrl, removeBackground }) => ({
      image: imageUrl,
      steps: 50,
      guidance_scale: 5.5,
      octree_resolution: 256,
      remove_background: removeBackground !== false,
    }),
  },
];

export const DEFAULT_3D_MODEL = "firtoz/trellis";

export function find3dModel(id: string | undefined): ThreeDModel | null {
  if (!id) return THREED_MODELS.find((m) => m.id === DEFAULT_3D_MODEL) ?? null;
  return THREED_MODELS.find((m) => m.id === id) ?? null;
}

export function threeDModelCatalogue() {
  return THREED_MODELS.map(({ id, label, provider, note }) => ({
    id,
    label,
    provider,
    note,
    default: id === DEFAULT_3D_MODEL,
  }));
}
