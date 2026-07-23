"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reporter";
import { useI18n } from "@/lib/i18n";

const ERR_TEXT: Record<string, Record<string, string>> = {
  title:   { en: "Something went wrong", ru: "Что-то пошло не так", kk: "Бірдеңе дұрыс болмады", de: "Etwas ist schiefgelaufen", fr: "Une erreur s'est produite", es: "Algo salió mal", zh: "出了点问题", ja: "問題が発生しました", ar: "حدث خطأ ما", pt: "Algo deu errado", tr: "Bir şeyler ters gitti" },
  body:    { en: "An unexpected error occurred. You can try again — your data is saved in localStorage. If the error persists, reload the page.", ru: "Произошла непредвиденная ошибка. Можно попробовать снова — данные сохранены в localStorage. Если ошибка повторяется, перезагрузи страницу.", kk: "Күтпеген қате орын алды. Қайта көруге болады — деректер localStorage-де сақталған. Қате қайталанса, бетті қайта жүктеңіз.", de: "Ein unerwarteter Fehler ist aufgetreten. Du kannst es erneut versuchen — deine Daten sind in localStorage gespeichert. Wenn der Fehler weiterhin auftritt, lade die Seite neu.", fr: "Une erreur inattendue s'est produite. Vous pouvez réessayer — vos données sont enregistrées dans localStorage. Si l'erreur persiste, rechargez la page.", es: "Se produjo un error inesperado. Puedes intentarlo de nuevo — tus datos están guardados en localStorage. Si el error persiste, recarga la página.", zh: "发生了意外错误。您可以重试——数据已保存在 localStorage 中。如果错误持续，请重新加载页面。", ja: "予期しないエラーが発生しました。もう一度試すことができます — データは localStorage に保存されています。エラーが続く場合は、ページを再読み込みしてください。", ar: "حدث خطأ غير متوقع. يمكنك المحاولة مرة أخرى — تم حفظ بياناتك في localStorage. إذا استمر الخطأ، أعد تحميل الصفحة.", pt: "Ocorreu um erro inesperado. Você pode tentar novamente — seus dados estão salvos no localStorage. Se o erro persistir, recarregue a página.", tr: "Beklenmeyen bir hata oluştu. Tekrar deneyebilirsiniz — verileriniz localStorage'da kaydedildi. Hata devam ederse sayfayı yeniden yükleyin." },
  retry:   { en: "↻ Try again", ru: "↻ Попробовать снова", kk: "↻ Қайта көру", de: "↻ Erneut versuchen", fr: "↻ Réessayer", es: "↻ Intentar de nuevo", zh: "↻ 重试", ja: "↻ もう一度試す", ar: "↻ حاول مرة أخرى", pt: "↻ Tentar novamente", tr: "↻ Tekrar dene" },
  home:    { en: "← Home", ru: "← На главную", kk: "← Басты бетке", de: "← Startseite", fr: "← Accueil", es: "← Inicio", zh: "← 首页", ja: "← ホーム", ar: "← الرئيسية", pt: "← Início", tr: "← Ana sayfa" },
};

function tx(key: string, lang: string): string {
  return ERR_TEXT[key]?.[lang] ?? ERR_TEXT[key]?.en ?? key;
}

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useI18n();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[App error]", error);
    reportError(error, "root", { digest: error.digest });
  }, [error]);

  return (
    <main style={{
      minHeight: "60vh",
      display: "flex", alignItems: "center", justifyContent: "center" as const,
      padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <section style={{
        maxWidth: 540, width: "100%",
        padding: 24, borderRadius: 14,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#fff",
        border: "1px solid #334155",
        boxShadow: "0 12px 40px rgba(15,23,42,0.35)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8 }}>
          {tx("title", lang)}
        </h1>
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 14 }}>
          {tx("body", lang)}
        </p>
        {error.digest && (
          <div style={{
            padding: "6px 10px", borderRadius: 5, marginBottom: 14,
            background: "rgba(0,0,0,0.30)", border: "1px solid #475569",
            fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#94a3b8",
          }}>
            digest: {error.digest}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button onClick={() => reset()}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: "linear-gradient(135deg, #22d3ee, #06b6d4)", color: "#fff",
              fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              boxShadow: "0 2px 8px rgba(6,182,212,0.30)",
            }}>
            {tx("retry", lang)}
          </button>
          <a href="/"
            style={{
              padding: "8px 16px", borderRadius: 6,
              border: "1px solid #475569", background: "rgba(255,255,255,0.05)",
              color: "#cbd5e1", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
              textDecoration: "none",
            }}>
            {tx("home", lang)}
          </a>
        </div>
      </section>
    </main>
  );
}
