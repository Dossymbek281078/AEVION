/**
 * Payment provider abstraction.
 *
 * Concrete providers (Stripe, Kaspi-Pay, Paddle) implement this interface;
 * the route layer is provider-agnostic. Default in dev/CI is the
 * deterministic stub provider — it auto-completes payments so the upgrade
 * flow runs end-to-end.
 *
 * In production, env BUREAU_PAYMENT_PROVIDER selects a real implementation,
 * which uses signed webhooks to confirm payments asynchronously (the
 * client polls /payment/status until the webhook arrives — never trust
 * the client-reported "paid" claim).
 */

export type PaymentStatus =
  | "unpaid" // intent created, not yet paid
  | "processing" // user clicked pay, awaiting confirmation
  | "paid" // confirmed by provider webhook
  | "refunded"
  | "failed"
  | "expired";

export interface PaymentIntentInput {
  /** What the user is paying for — opaque to the provider, used in webhooks. */
  reference: string;
  amountCents: number;
  currency: string; // ISO-4217, e.g. "USD"
  /** Description shown on hosted checkout page. */
  description: string;
  email?: string | null;
  /** Extra key/values echoed back in the webhook's custom_data (e.g. the chosen
   *  module for a Lite subscription). Provider-specific: LemonSqueezy forwards
   *  it on subscription events. */
  customData?: Record<string, string>;
  /**
   * Просить провайдера списать именно `amountCents`, а не фиксированную цену
   * своего продукта. Нужно там, где сумма получается со скидкой (промокод,
   * веерная скидка): LemonSqueezy и Gumroad по умолчанию берут цену
   * варианта/продукта и наши скидки игнорируют.
   *
   * Поддержка — на стороне провайдера: LS умеет через `custom_price`
   * (включается `LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE=1`), Gumroad — не умеет
   * (нужен offer-code в URL, отдельная задача). Провайдер, который не умеет,
   * этот флаг игнорирует; вызывающая сторона обязана сама сказать
   * пользователю правду о реальной сумме — см.
   * routes/checkout.ts#channelHonoursAmount.
   */
  chargeExactAmount?: boolean;

  /**
   * Ссылка товара у провайдера, заданная ЯВНО вызывающей стороной.
   *
   * Зачем отдельное поле, если есть `reference`. Провайдер выводит ссылку из
   * `reference` по переменным окружения, и общая запасная (`*_DEFAULT_*`)
   * стоит в этом порядке ВЫШЕ переданного значения. Пока модуль называет
   * заказ смыслом («qstore»), это правильно — общая ссылка и есть его
   * запасной путь. Но там, где у каждого тарифа СВОЙ товар, тот же порядок
   * уводил покупателя на общий продукт: чужой товар по чужой цене.
   *
   * Поэтому: кто ЗНАЕТ ссылку — передаёт её здесь, и она перебивает всё
   * остальное. Кто не знает, поле не заполняет, и прежний порядок работает
   * как работал. Найдено 29.08.2026 вычиткой дифа перед выкаткой.
   */
  permalink?: string;
  /**
   * Идентификатор купленного модуля — ТОЛЬКО для адреса возврата, чтобы
   * страница после оплаты назвала то, за что заплатили. Намеренно отдельно
   * от customData: та уезжает провайдеру и возвращается в вебхуке, и её
   * расширение меняло бы выдачу прав, а не подпись на экране.
   */
  successAppId?: string;

  /*
   * Сведено 31.08 при сборке к 10.09: три поля выше пришли из ДВУХ веток,
   * дописавших их в один тип соседними строками. Конфликт был чисто
   * текстовым — пересечения по смыслу нет: chargeExactAmount и permalink про
   * сумму и товар, successAppId про адрес возврата. Сохранены все три.
   *
   * Цена неверного разрешения названа автором заранее и конкретна: взять одну
   * сторону — либо отвалится сборка провайдеров, либо покупатель снова увидит
   * чужой продукт после оплаты, и второе выглядело бы регрессией ниоткуда.
   */
}

export interface PaymentIntent {
  intentId: string;
  /** URL to send the user to (hosted checkout). */
  checkoutUrl: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
}

export interface PaymentResult {
  status: PaymentStatus;
  paidAt: string | null;
  reason: string | null;
  raw: unknown;
}

export interface PaymentProvider {
  readonly id: string;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  getIntent(intentId: string): Promise<PaymentResult>;
  parseWebhook(headers: Record<string, string>, rawBody: string): {
    intentId: string;
    /** Provider-side unique id for this webhook delivery (Stripe `evt_*`).
     *  Used for at-least-once dedup; if absent, dedup falls back to a hash of
     *  the raw body. */
    eventId?: string;
    result: PaymentResult;
  };
}
