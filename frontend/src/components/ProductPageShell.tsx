type Props = {
  children: React.ReactNode;
  /** По умолчанию как у Bureau / Planet */
  maxWidth?: number;
  /** Игровые/full-bleed страницы (CyberChess и т.п.) — снимает maxWidth и режет горизонтальный padding. */
  fullWidth?: boolean;
};

/**
 * Единая колонка контента под «продуктовые» страницы (вместо разрозненных padding/maxWidth).
 */
export function ProductPageShell({ children, maxWidth = 1100, fullWidth = false }: Props) {
  return (
    <div
      style={{
        maxWidth: fullWidth ? "none" : maxWidth,
        margin: "0 auto",
        padding: fullWidth ? "16px 10px 0" : "24px 20px 56px",
        width: "100%",
        boxSizing: "border-box",
        ...(fullWidth ? { display: "flex", flexDirection: "column", flex: 1 } : {}),
      }}
    >
      {children}
    </div>
  );
}
