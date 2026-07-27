import { describe, it, expect } from "vitest";
import { assetSnippet, appendSnippet } from "../devhubAssetSnippet";

describe("assetSnippet", () => {
  it("uses JSX markup in .jsx/.tsx files", () => {
    expect(assetSnippet("src/App.jsx", "https://cdn/x.mp4", "video")).toBe(
      '<video src="https://cdn/x.mp4" controls />',
    );
    expect(assetSnippet("src/App.tsx", "https://cdn/x.png", "image")).toBe(
      '<img src="https://cdn/x.png" alt="" />',
    );
    expect(assetSnippet("src/App.jsx", "https://cdn/x.glb", "model")).toBe(
      "{/* 3D model (GLB): https://cdn/x.glb */}",
    );
  });

  it("uses HTML markup in .html files", () => {
    expect(assetSnippet("index.html", "https://cdn/x.mp4", "video")).toBe(
      '<video src="https://cdn/x.mp4" controls></video>',
    );
    expect(assetSnippet("INDEX.HTM", "https://cdn/x.png", "image")).toBe(
      '<img src="https://cdn/x.png" alt="">',
    );
    expect(assetSnippet("index.html", "https://cdn/x.glb", "model")).toBe(
      "<!-- 3D model (GLB): https://cdn/x.glb -->",
    );
  });

  it("falls back to the bare URL for other file types", () => {
    // Wrong-language markup in a .css/.md/.py file would break the file;
    // a bare line never does.
    expect(assetSnippet("styles.css", "https://cdn/x.mp4", "video")).toBe("https://cdn/x.mp4");
    expect(assetSnippet("README.md", "https://cdn/x.glb", "model")).toBe("https://cdn/x.glb");
  });

  it("escapes a URL that would break out of the attribute", () => {
    const evil = 'https://cdn/x.mp4?a="onload=alert(1)';
    const out = assetSnippet("src/App.jsx", evil, "video");
    expect(out).toBe('<video src="https://cdn/x.mp4?a=&quot;onload=alert(1)" controls />');
    expect(out).not.toContain('="onload');
  });

  it("keeps a URL from closing the comment it sits in", () => {
    expect(assetSnippet("src/App.jsx", "https://cdn/a*/b.glb", "model")).toBe(
      "{/* 3D model (GLB): https://cdn/a*%2Fb.glb */}",
    );
    expect(assetSnippet("index.html", "https://cdn/a-->b.glb", "model")).toBe(
      "<!-- 3D model (GLB): https://cdn/a--%3Eb.glb -->",
    );
  });
});

describe("appendSnippet", () => {
  it("keeps the existing file and adds the snippet after it", () => {
    // The regression: the buttons used to replace the whole file with the URL.
    const file = "export default function App() {\n  return <div />;\n}\n";
    const out = appendSnippet(file, '<video src="https://cdn/x.mp4" controls />');
    expect(out.startsWith("export default function App() {")).toBe(true);
    expect(out).toContain("https://cdn/x.mp4");
    expect(out.length).toBeGreaterThan(file.length);
  });

  it("separates with exactly one blank line and ends with a newline", () => {
    expect(appendSnippet("a\n\n\n", "b")).toBe("a\n\nb\n");
  });

  it("does not open an empty file with blank lines", () => {
    expect(appendSnippet("", "b")).toBe("b\n");
    expect(appendSnippet("   \n", "b")).toBe("b\n");
  });
});
