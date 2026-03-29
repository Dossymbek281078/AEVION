/** Тот же визуальный слот, что у WebGL-глобуса — пока грузится клиентский бандл. */
export default function Globus3DPlaceholder() {
  return (
    <div
      style={{
        width: "100%",
        height: 520,
        minHeight: 520,
        borderRadius: 9999,
        border: "1px solid rgba(40,55,90,0.45)",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 120% 100% at 50% 35%, #0c1528 0%, #02040a 55%, #000005 100%)",
        boxShadow:
          "inset 0 0 80px rgba(60,100,180,0.12), 0 24px 48px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8ea0c8",
        fontSize: 14,
        fontWeight: 600,
        textAlign: "center",
        padding: 24,
      }}
    >
      Loading 3D Globus...
    </div>
  );
}
