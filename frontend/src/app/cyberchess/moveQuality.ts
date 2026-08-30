/**
 * Качество хода: зевок, ошибка, неточность — или, наоборот, блестяще.
 *
 * Вынесено из page.tsx 28.08.2026. Этот ярлык человек видит после КАЖДОГО
 * своего хода, и при поломке ничего не падает: разбор просто начинает льстить
 * или, наоборот, ругать за нормальную игру. Заметит это только тот, кто хорошо
 * играет, — то есть самый ценный для нас человек.
 *
 * Проверка рядом: __tests__/moveQuality.test.ts, мутационно проверена.
 */

/* ═══ Move classification (lichess-grade, phase + eval-context aware) ═══
   Вместо грубого абсолютного порога centipawn-падения учитываем:
   - Фазу партии (по некоролевскому материалу из FEN): в эндшпиле малый cp-свинг
     значит больше, поэтому пороги ниже; в дебюте/мителе — выше.
   - Eval ДО хода: падение, переводящее выигранную позицию в проигранную
     (смена знака на «лишённый шанса») наказывается строже, чем то же падение
     в уже безнадёжной позиции (там оно почти ничего не меняет).
   Ярлыки и форма результата не меняются. */
export function nonPawnMaterialFromFEN(fen?:string):number{
  if(!fen)return 62; // дефолт = полный комплект → трактуем как мителшпиль
  const board=fen.split(" ")[0];let m=0;
  for(const ch of board){
    const l=ch.toLowerCase();
    if(l==="n"||l==="b")m+=3;else if(l==="r")m+=5;else if(l==="q")m+=9;
  }
  return m; // макс ≈ 2*(2*3+2*3+2*5+9)=62
}
export function classifyDrop(drop:number,prevFromMover:number,currFromMover:number,fen?:string):"brilliant"|"great"|"good"|"inacc"|"mistake"|"blunder"{
  const npm=nonPawnMaterialFromFEN(fen);
  // phase: 1.0 = полный материал (дебют/митель), стремится к ~0 в голом эндшпиле.
  // В эндшпиле множитель порогов <1 → те же потери классифицируются строже.
  const phase=Math.min(1,npm/62);
  const tMul=0.62+0.38*phase; // эндшпиль ≈0.62×, митель =1.0×
  // Контекст по eval ДО хода: если ход переворачивает оценку (был не проигран →
  // стал явно проигран), усиливаем (порог снижаем). Если позиция и так была
  // проиграна (prevFromMover сильно отрицателен), ослабляем — потеря почти не важна.
  let ctxMul=1;
  const flips=prevFromMover>-150&&currFromMover<-200; // выигрыш/равенство → проигрыш
  const alreadyLost=prevFromMover<=-400; // уже глубоко проиграно до хода
  if(flips)ctxMul=0.75;        // строже: реальная цена ошибки выше
  else if(alreadyLost)ctxMul=1.6; // мягче: «и так проиграно»
  const f=tMul*ctxMul;
  if(drop>=300*f)return "blunder";
  if(drop>=150*f)return "mistake";
  if(drop>=70*f)return "inacc";
  // brilliant/great — «положительные» категории, не зависят от фазовых порогов потерь.
  if(drop<=-100&&Math.abs(prevFromMover)<300)return "brilliant";
  if(drop<=-50)return "great";
  return "good";
}
