// /en/cyberchess — тот же экран шахмат, что и /cyberchess, но с английской
// метой (layout.tsx) и английским игровым языком (loadLocale ловит префикс
// /en/). Компонент один — не копия, чтобы не разошлись.
import CyberChessPage from "../../cyberchess/page";

export default function EnCyberChessPage() {
  return <CyberChessPage />;
}
