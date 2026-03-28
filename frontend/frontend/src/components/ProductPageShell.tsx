type Props = {
  children: React.ReactNode;
  /** По умолчанию как у Bureau / Planet */
  maxWidth?: number;
};

/**
 * Единая колонка контента под «продуктовые» страницы (вместо разрозненных padding/maxWidth).
 */
export function ProductPageShell({ children, maxWidth = 1100 }: Props) {
  return (
    <div
      style={{
        maxWidth,
        margin: "0 auto",
        padding: "24px 20px 56px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
