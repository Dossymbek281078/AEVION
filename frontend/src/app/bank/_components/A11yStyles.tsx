"use client";

// Accessibility polish injected into /bank so we don't have to
// sprinkle inline focus styles across every button in the tree.
// - Global :focus-visible outline (keyboard focus ring)
// - Skip-link that appears on Tab, jumps the viewport to the main wallet
//   section for screen-reader / keyboard users

export function A11yStyles() {
  return (
    <>
      <style>{`
        .aevion-skip-link {
          position: fixed;
          top: -48px;
          left: 12px;
          z-index: 100;
          padding: 10px 16px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0d9488, #0ea5e9);
          color: #fff;
          font-weight: 800;
          font-size: 13px;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(14,165,233,0.3);
          transition: top 200ms ease;
        }
        .aevion-skip-link:focus {
          top: 12px;
          outline: 3px solid #fff;
          outline-offset: 2px;
        }

        /* Keyboard-only focus ring. Mouse-click focus stays quiet. */
        .aevion-bank-root :focus-visible {
          outline: 2px solid #0ea5e9;
          outline-offset: 2px;
          border-radius: 6px;
        }
      `}</style>
      <a href="#bank-anchor-wallet" className="aevion-skip-link">
        Skip to wallet
      </a>
    </>
  );
}
