"use client";

import AvatarDisplay from "./AvatarDisplay";

interface Persona {
  alias: string;
  display_name: string;
  bio?: string | null;
  avatar_prompt?: string | null;
  skills?: string[];
  links?: string[];
  created_at?: string;
}

interface PersonaCardProps {
  persona: Persona;
  onClick?: () => void;
  compact?: boolean;
}

export default function PersonaCard({ persona, onClick, compact = false }: PersonaCardProps) {
  const avatarSize = compact ? 48 : 72;

  return (
    <div
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, #1a0533 0%, #0f0720 100%)",
        border: "1px solid #4c1d95",
        borderRadius: "16px",
        padding: compact ? "16px" : "24px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.2s, transform 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = "#7c3aed";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#4c1d95";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <AvatarDisplay
          displayName={persona.display_name}
          avatarPrompt={persona.avatar_prompt}
          size={avatarSize}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: compact ? "15px" : "18px", color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {persona.display_name}
          </div>
          <div style={{ fontSize: "12px", color: "#7c3aed", fontFamily: "monospace", marginTop: "2px" }}>
            @{persona.alias}
          </div>
        </div>
      </div>

      {/* Bio */}
      {persona.bio && (
        <p style={{
          fontSize: "13px",
          color: "#94a3b8",
          lineHeight: 1.6,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: compact ? 2 : 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        } as React.CSSProperties}>
          {persona.bio}
        </p>
      )}

      {/* Skills */}
      {persona.skills && persona.skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {(compact ? persona.skills.slice(0, 5) : persona.skills).map((skill, i) => (
            <span key={i} style={{
              padding: "2px 10px",
              borderRadius: "9999px",
              background: "#2d1054",
              border: "1px solid #5b21b6",
              color: "#c4b5fd",
              fontSize: "12px",
              fontWeight: 500,
            }}>
              {skill}
            </span>
          ))}
          {compact && persona.skills.length > 5 && (
            <span style={{ color: "#64748b", fontSize: "12px", alignSelf: "center" }}>
              +{persona.skills.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Links */}
      {!compact && persona.links && persona.links.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {persona.links.map((link, i) => (
            <a
              key={i}
              href={link.startsWith("http") ? link : `https://${link}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: "12px", color: "#818cf8", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {link}
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", color: "#475569", fontFamily: "monospace" }}>
          /qpersona/view/{persona.alias}
        </span>
        {persona.created_at && (
          <span style={{ fontSize: "11px", color: "#475569" }}>
            {new Date(persona.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
