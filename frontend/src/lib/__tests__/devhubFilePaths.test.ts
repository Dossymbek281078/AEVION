import { describe, it, expect } from "vitest";
import { normalizeFilePath, newFilePathError, renamePathError } from "../devhubFilePaths";

describe("normalizeFilePath", () => {
  it("normalises separators and leading ./", () => {
    expect(normalizeFilePath("  ./src\\App.jsx ")).toBe("src/App.jsx");
    expect(normalizeFilePath("/src//components//A.jsx")).toBe("src/components/A.jsx");
  });
});

describe("newFilePathError", () => {
  const existing = ["src/App.jsx", "index.html"];

  it("refuses a path that already exists — the endpoint is an upsert", () => {
    // The regression: "New file" sent content:"" to this path and emptied it.
    expect(newFilePathError("src/App.jsx", existing)).toMatch(/уже существует/);
    expect(newFilePathError("./src/App.jsx", existing)).toMatch(/уже существует/);
    expect(newFilePathError("src\\App.jsx", existing)).toMatch(/уже существует/);
  });

  it("allows a genuinely new path", () => {
    expect(newFilePathError("src/App2.jsx", existing)).toBeNull();
    expect(newFilePathError("  src/new/Thing.tsx  ", existing)).toBeNull();
  });

  it("refuses empty, directory-shaped and traversing paths", () => {
    expect(newFilePathError("   ", existing)).not.toBeNull();
    expect(newFilePathError("src/", existing)).not.toBeNull();
    expect(newFilePathError("../secrets.env", existing)).not.toBeNull();
    expect(newFilePathError("src/../../x.js", existing)).not.toBeNull();
  });

  it("does not mistake a name that merely contains an existing one", () => {
    expect(newFilePathError("src/App.jsx.bak", existing)).toBeNull();
    expect(newFilePathError("other/index.html.txt", existing)).toBeNull();
  });
});

describe("renamePathError", () => {
  const existing = ["src/App.jsx", "src/Timer.jsx", "index.html"];

  it("refuses a rename that would overwrite another file", () => {
    expect(renamePathError("src/App.jsx", "src/Timer.jsx", existing)).toMatch(/уже существует/);
  });

  it("allows renaming to a free path", () => {
    expect(renamePathError("src/App.jsx", "src/Root.jsx", existing)).toBeNull();
  });

  it("treats renaming a file to its own path as allowed (a no-op)", () => {
    expect(renamePathError("src/App.jsx", "src/App.jsx", existing)).toBeNull();
    expect(renamePathError("src/App.jsx", "./src/App.jsx", existing)).toBeNull();
  });
});
