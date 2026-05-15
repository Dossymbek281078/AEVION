"use client";

/**
 * AvatarDisplay — client-side deterministic SVG avatar.
 * Color palette + initials derived from avatarPrompt or displayName hash.
 * No external image API. Pure SVG.
 */

const PALETTES = [
  ["#7c3aed", "#a78bfa"],
  ["#6d28d9", "#c4b5fd"],
  ["#4f46e5", "#818cf8"],
  ["#7e22ce", "#d8b4fe"],
  ["#5b21b6", "#ddd6fe"],
  ["#3730a3", "#a5b4fc"],
  ["#6b21a8", "#e879f9"],
  ["#581c87", "#f0abfc"],
];

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

interface AvatarDisplayProps {
  displayName: string;
  avatarPrompt?: string | null;
  size?: number;
}

export default function AvatarDisplay({ displayName, avatarPrompt, size = 80 }: AvatarDisplayProps) {
  const seed = avatarPrompt || displayName;
  const hash = strHash(seed);
  const [bg, fg] = PALETTES[hash % PALETTES.length];
  const initials = getInitials(displayName);

  // Generate decorative circles deterministically
  const circles = Array.from({ length: 4 }, (_, i) => {
    const h2 = strHash(seed + i);
    return {
      cx: (h2 % 80) + 10,
      cy: (strHash(seed + i + 99) % 80) + 10,
      r: (h2 % 15) + 5,
      opacity: 0.12 + (i * 0.04),
    };
  });

  const fontSize = size * 0.32;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: "50%", flexShrink: 0 }}
      aria-label={`Avatar for ${displayName}`}
    >
      <defs>
        <radialGradient id={`grad-${hash}`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={fg} />
          <stop offset="100%" stopColor={bg} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#grad-${hash})`} />
      {circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="#fff" opacity={c.opacity} />
      ))}
      <text
        x="50"
        y="50"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#fff"
        style={{ userSelect: "none" }}
      >
        {initials}
      </text>
    </svg>
  );
}
