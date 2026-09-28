import { fetchOrPaywall } from "@/lib/paywall";
import { PageTracking } from "@/components/PageTracking";
import { PaywallScreen } from "@/components/PaywallScreen";
import MultichatEnginePage from "./MultichatEngineClient";

export default async function Page() {
  const r = await fetchOrPaywall("/api/multichat/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return (
    <>
      {/*
       * Замер посещения И запоминание канала — без него метка `?c=` здесь
       * умирала молча.
       *
       * Цепочка: channelNow() читает `?c=` из адреса и кладёт КОРОТКУЮ метку в
       * память вкладки; дальше её забирают касса и форма подписки. Зовёт
       * channelNow только тот, кто шлёт событие, то есть PageTracking.
       * Глобального вызова нет (проверено в ClientProviders), поэтому
       * страница без него не запоминает ничего.
       *
       * Замер 28.09.2026 по всем 18 коротким входам: 11 ведут на /go, 4 на
       * /devhub, 4 на /en/devhub — все читают метку. Ровно ОДИН адрес
       * назначения не читал её вовсе — этот. На него ведут `/x-multichat` и
       * `/ads-multichat`, то есть в том числе ПЛАТНАЯ кампания: переход
       * оплачен, а в отчёте он «unattributed». Ровно так уже потеряли 37
       * постов с `?c=post`.
       */}
      <PageTracking page="multichat-engine" />
      <MultichatEnginePage />
    </>
  );
}
