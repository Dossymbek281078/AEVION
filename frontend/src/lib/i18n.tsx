"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "ru" | "kk" | "de" | "fr" | "es" | "zh" | "ja" | "ar" | "pt" | "tr";

export const LANGS: Lang[] = ["ru", "en", "kk", "de", "fr", "es", "zh", "ja", "ar", "pt", "tr"];

export const LANG_FLAG: Record<Lang, string> = {
  en: "🇺🇸", ru: "🇷🇺", kk: "🇰🇿", de: "🇩🇪", fr: "🇫🇷",
  es: "🇪🇸", zh: "🇨🇳", ja: "🇯🇵", ar: "🇸🇦", pt: "🇧🇷", tr: "🇹🇷",
};

export const LANG_SHORT: Record<Lang, string> = {
  en: "EN", ru: "RU", kk: "KZ", de: "DE", fr: "FR",
  es: "ES", zh: "ZH", ja: "JA", ar: "AR", pt: "PT", tr: "TR",
};

export const LANG_FULL: Record<Lang, string> = {
  en: "English", ru: "Русский", kk: "Қазақша",
  de: "Deutsch", fr: "Français", es: "Español",
  zh: "中文", ja: "日本語", ar: "العربية", pt: "Português", tr: "Türkçe",
};

export const LANG_RTL: Partial<Record<Lang, true>> = { ar: true };

export const LANG_COOKIE = "aevion_lang_v1";

const STORAGE_KEY = "aevion_lang_v1";

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as string[]).includes(x);
}

function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "ru";
  const raw = (navigator.language || "en").toLowerCase();
  if (raw.startsWith("kk") || raw.startsWith("kz")) return "kk";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("tr")) return "tr";
  return "en";
}

// Compact translation dict — common + nav keys for all 11 languages
export const translations: Record<Lang, Record<string, string>> = {
  en: {
    "nav.demo": "Ecosystem demo", "nav.auth": "Auth", "nav.qright": "QRight",
    "nav.qsign": "QSign", "nav.bureau": "Bureau", "nav.planet": "Planet",
    "nav.awards": "Awards", "nav.bank": "Bank", "nav.chess": "Chess", "nav.help": "Help",
    "home.badge": "Product MVP · ready for demo",
    "home.title": "Trust infrastructure for digital assets and intellectual property",
    "home.subtitle": "A unified environment for investment and partnership evaluation: identity, object registry, cryptographic signature, patent bureau, and compliance layer — on an interactive ecosystem map with 27 product nodes and open APIs.",
    "home.cta.auth": "Start with identity (Auth)", "home.cta.qright": "QRight Registry",
    "home.cta.music": "Music Awards", "home.cta.film": "Film Awards", "home.cta.demo": "Full demo →",
    "auth.title": "AEVION Identity", "auth.register": "Register", "auth.login": "Sign in",
    "auth.name": "Name", "auth.email": "Email", "auth.password": "Password",
    "auth.password.hint": "Minimum 6 characters", "auth.submit.register": "Create account",
    "auth.submit.login": "Sign in", "auth.waiting": "Please wait...",
    "auth.session": "Session active", "auth.logout": "Sign out",
    "auth.cta.qright": "Create object in QRight →", "auth.cta.planet": "Planet Lab",
    "auth.toast.registered": "Account created! Welcome to AEVION",
    "auth.toast.loggedin": "Signed in", "auth.toast.loggedout": "Signed out",
    "auth.jwt.label": "JWT token (for developers)",
    "qright.title": "QRight", "qright.form.title": "Title *", "qright.form.desc": "Description *",
    "qright.form.owner": "Author name (optional)", "qright.form.email": "Author email (optional)",
    "qright.form.country": "Country (optional)", "qright.form.city": "City (optional)",
    "qright.form.submit": "Register object", "qright.form.saving": "Saving...",
    "qright.toast.created": "Object registered in QRight",
    "qright.registry": "QRight Registry", "qright.mine": "Only mine (requires Auth)",
    "pipeline.auth": "Auth", "pipeline.qright": "QRight", "pipeline.qsign": "QSign",
    "pipeline.bureau": "Bureau", "pipeline.planet": "Planet",
    "bank.title": "Ecosystem digital bank", "bank.balance": "Balance",
    "bank.available": "Available", "bank.frozen": "Frozen", "bank.pending": "Pending royalties",
    "bank.transfer": "P2P Transfer", "bank.recipient": "Recipient",
    "bank.amount": "Amount AEC", "bank.send": "Send", "bank.sending": "Sending...",
    "bank.history": "Transaction history",
    "footer.brand": "Global trust infrastructure for digital content, intellectual property and creator economy.",
    "footer.products": "Products", "footer.company": "Company",
    "footer.contact": "Contact", "footer.rights": "All rights reserved.",
    "help.title": "Help Center",
    "common.save": "Save", "common.cancel": "Cancel", "common.close": "Close",
    "common.back": "Back", "common.next": "Next", "common.loading": "Loading…",
    "common.error": "Error", "common.success": "Success", "common.search": "Search",
    "common.language": "Language", "common.settings": "Settings",
  },
  ru: {
    "nav.demo": "Демо экосистемы", "nav.auth": "Auth", "nav.qright": "QRight",
    "nav.qsign": "QSign", "nav.bureau": "Бюро", "nav.planet": "Planet",
    "nav.awards": "Премии", "nav.bank": "Банк", "nav.chess": "Шахматы", "nav.help": "Помощь",
    "home.badge": "Продуктовый MVP · готово к демонстрации",
    "home.title": "Инфраструктура доверия для цифровых активов и интеллектуальной собственности",
    "home.subtitle": "Единый контур для инвестиционной и партнёрской оценки: идентичность, реестр объектов, криптоподпись, патентное бюро и слой compliance — на интерактивной карте экосистемы с 27 продуктовыми узлами и открытыми API.",
    "home.cta.auth": "Начать с идентичности (Auth)", "home.cta.qright": "Реестр QRight",
    "home.cta.music": "Премии — музыка", "home.cta.film": "Премии — кино", "home.cta.demo": "Полная демонстрация →",
    "auth.title": "Идентичность AEVION", "auth.register": "Регистрация", "auth.login": "Вход",
    "auth.name": "Имя", "auth.email": "Email", "auth.password": "Пароль",
    "auth.password.hint": "Минимум 6 символов", "auth.submit.register": "Создать аккаунт",
    "auth.submit.login": "Войти", "auth.waiting": "Подождите...",
    "auth.session": "Сессия активна", "auth.logout": "Выйти",
    "auth.cta.qright": "Создать объект в QRight →", "auth.cta.planet": "Planet Lab",
    "auth.toast.registered": "Аккаунт создан! Добро пожаловать в AEVION",
    "auth.toast.loggedin": "Вход выполнен", "auth.toast.loggedout": "Вы вышли из системы",
    "auth.jwt.label": "JWT-токен (для разработчиков)",
    "qright.title": "QRight", "qright.form.title": "Название *", "qright.form.desc": "Описание *",
    "qright.form.owner": "Имя автора (опционально)", "qright.form.email": "Email автора (опционально)",
    "qright.form.country": "Страна (опционально)", "qright.form.city": "Город (опционально)",
    "qright.form.submit": "Зарегистрировать объект", "qright.form.saving": "Сохранение...",
    "qright.toast.created": "Объект зарегистрирован в QRight",
    "qright.registry": "Реестр QRight", "qright.mine": "Только мои (нужен вход в Auth)",
    "pipeline.auth": "Auth", "pipeline.qright": "QRight", "pipeline.qsign": "QSign",
    "pipeline.bureau": "Бюро", "pipeline.planet": "Planet",
    "bank.title": "Цифровой банк экосистемы", "bank.balance": "Баланс",
    "bank.available": "Доступно", "bank.frozen": "Заморожено", "bank.pending": "Ожидает роялти",
    "bank.transfer": "Перевод P2P", "bank.recipient": "Получатель",
    "bank.amount": "Сумма AEC", "bank.send": "Отправить", "bank.sending": "Отправка...",
    "bank.history": "История транзакций",
    "footer.brand": "Глобальная инфраструктура доверия для цифрового контента, интеллектуальной собственности и экономики создателей.",
    "footer.products": "Продукты", "footer.company": "Компания",
    "footer.contact": "Контакты", "footer.rights": "Все права защищены.",
    "help.title": "Центр помощи",
    "common.save": "Сохранить", "common.cancel": "Отмена", "common.close": "Закрыть",
    "common.back": "Назад", "common.next": "Далее", "common.loading": "Загрузка…",
    "common.error": "Ошибка", "common.success": "Успех", "common.search": "Поиск",
    "common.language": "Язык", "common.settings": "Настройки",
  },
  kk: {
    "nav.demo": "Экожүйе демосы", "nav.auth": "Auth", "nav.bureau": "Бюро",
    "nav.planet": "Планета", "nav.awards": "Марапаттар", "nav.bank": "Банк",
    "nav.chess": "Шахмат", "nav.help": "Көмек",
    "home.title": "Цифрлық активтер мен зияткерлік меншікке арналған сенім инфрақұрылымы",
    "home.cta.demo": "Толық демо →",
    "auth.title": "AEVION сәйкестігі", "auth.register": "Тіркелу", "auth.login": "Кіру",
    "auth.name": "Аты", "auth.password": "Құпия сөз", "auth.logout": "Шығу",
    "auth.submit.register": "Аккаунт жасау", "auth.submit.login": "Кіру",
    "pipeline.bureau": "Бюро",
    "bank.balance": "Баланс", "bank.send": "Жіберу",
    "footer.rights": "Барлық құқықтар қорғалған.",
    "common.save": "Сақтау", "common.cancel": "Бас тарту", "common.close": "Жабу",
    "common.loading": "Жүктелуде…", "common.error": "Қате", "common.search": "Іздеу",
    "common.language": "Тіл",
  },
  de: {
    "nav.demo": "Ökosystem-Demo", "nav.auth": "Anmeldung", "nav.bureau": "Büro",
    "nav.planet": "Planet", "nav.awards": "Preise", "nav.bank": "Bank",
    "nav.chess": "Schach", "nav.help": "Hilfe",
    "home.title": "Vertrauensinfrastruktur für digitale Vermögenswerte und geistiges Eigentum",
    "home.badge": "Produkt MVP · bereit für Demo", "home.cta.demo": "Vollständige Demo →",
    "auth.title": "AEVION-Identität", "auth.register": "Registrieren", "auth.login": "Anmelden",
    "auth.name": "Name", "auth.password": "Passwort", "auth.logout": "Abmelden",
    "auth.submit.register": "Konto erstellen", "auth.submit.login": "Anmelden",
    "auth.waiting": "Bitte warten...", "auth.session": "Sitzung aktiv",
    "pipeline.bureau": "Büro",
    "bank.title": "Digitale Bank des Ökosystems", "bank.balance": "Guthaben",
    "bank.available": "Verfügbar", "bank.send": "Senden",
    "bank.history": "Transaktionsverlauf",
    "footer.products": "Produkte", "footer.company": "Unternehmen",
    "footer.rights": "Alle Rechte vorbehalten.",
    "common.save": "Speichern", "common.cancel": "Abbrechen", "common.close": "Schließen",
    "common.back": "Zurück", "common.next": "Weiter", "common.loading": "Lädt…",
    "common.error": "Fehler", "common.success": "Erfolg", "common.search": "Suchen",
    "common.language": "Sprache", "common.settings": "Einstellungen",
  },
  fr: {
    "nav.demo": "Démo de l'écosystème", "nav.auth": "Connexion", "nav.bureau": "Bureau",
    "nav.planet": "Planète", "nav.awards": "Prix", "nav.bank": "Banque",
    "nav.chess": "Échecs", "nav.help": "Aide",
    "home.title": "Infrastructure de confiance pour les actifs numériques et la propriété intellectuelle",
    "home.badge": "Produit MVP · prêt pour la démo", "home.cta.demo": "Démo complète →",
    "auth.title": "Identité AEVION", "auth.register": "S'inscrire", "auth.login": "Se connecter",
    "auth.name": "Nom", "auth.password": "Mot de passe", "auth.logout": "Se déconnecter",
    "auth.submit.register": "Créer un compte", "auth.submit.login": "Se connecter",
    "auth.waiting": "Veuillez patienter...", "auth.session": "Session active",
    "pipeline.bureau": "Bureau",
    "bank.title": "Banque numérique de l'écosystème", "bank.balance": "Solde",
    "bank.available": "Disponible", "bank.send": "Envoyer",
    "bank.history": "Historique des transactions",
    "footer.products": "Produits", "footer.company": "Société",
    "footer.rights": "Tous droits réservés.",
    "common.save": "Enregistrer", "common.cancel": "Annuler", "common.close": "Fermer",
    "common.back": "Retour", "common.next": "Suivant", "common.loading": "Chargement…",
    "common.error": "Erreur", "common.success": "Succès", "common.search": "Rechercher",
    "common.language": "Langue", "common.settings": "Paramètres",
  },
  es: {
    "nav.demo": "Demo del ecosistema", "nav.auth": "Acceso", "nav.bureau": "Oficina",
    "nav.planet": "Planeta", "nav.awards": "Premios", "nav.bank": "Banco",
    "nav.chess": "Ajedrez", "nav.help": "Ayuda",
    "home.title": "Infraestructura de confianza para activos digitales y propiedad intelectual",
    "home.badge": "MVP del producto · listo para demo", "home.cta.demo": "Demo completa →",
    "auth.title": "Identidad AEVION", "auth.register": "Registrarse", "auth.login": "Iniciar sesión",
    "auth.name": "Nombre", "auth.password": "Contraseña", "auth.logout": "Cerrar sesión",
    "auth.submit.register": "Crear cuenta", "auth.submit.login": "Iniciar sesión",
    "auth.waiting": "Por favor espere...", "auth.session": "Sesión activa",
    "pipeline.bureau": "Oficina",
    "bank.title": "Banco digital del ecosistema", "bank.balance": "Saldo",
    "bank.available": "Disponible", "bank.send": "Enviar",
    "bank.history": "Historial de transacciones",
    "footer.products": "Productos", "footer.company": "Empresa",
    "footer.rights": "Todos los derechos reservados.",
    "common.save": "Guardar", "common.cancel": "Cancelar", "common.close": "Cerrar",
    "common.back": "Atrás", "common.next": "Siguiente", "common.loading": "Cargando…",
    "common.error": "Error", "common.success": "Éxito", "common.search": "Buscar",
    "common.language": "Idioma", "common.settings": "Configuración",
  },
  zh: {
    "nav.demo": "生态系统演示", "nav.auth": "登录", "nav.bureau": "局",
    "nav.planet": "星球", "nav.awards": "奖项", "nav.bank": "银行",
    "nav.chess": "国际象棋", "nav.help": "帮助",
    "home.title": "数字资产和知识产权的信任基础设施",
    "home.badge": "产品 MVP · 演示就绪", "home.cta.demo": "完整演示 →",
    "auth.title": "AEVION 身份", "auth.register": "注册", "auth.login": "登录",
    "auth.name": "姓名", "auth.password": "密码", "auth.logout": "退出",
    "auth.submit.register": "创建账户", "auth.submit.login": "登录",
    "auth.waiting": "请稍候...", "auth.session": "会话活跃",
    "pipeline.bureau": "局",
    "bank.title": "生态系统数字银行", "bank.balance": "余额",
    "bank.available": "可用", "bank.send": "发送",
    "bank.history": "交易历史",
    "footer.products": "产品", "footer.company": "公司",
    "footer.rights": "版权所有。",
    "common.save": "保存", "common.cancel": "取消", "common.close": "关闭",
    "common.back": "返回", "common.next": "下一步", "common.loading": "加载中…",
    "common.error": "错误", "common.success": "成功", "common.search": "搜索",
    "common.language": "语言", "common.settings": "设置",
  },
  ja: {
    "nav.demo": "エコシステムデモ", "nav.auth": "ログイン", "nav.bureau": "局",
    "nav.planet": "プラネット", "nav.awards": "アワード", "nav.bank": "バンク",
    "nav.chess": "チェス", "nav.help": "ヘルプ",
    "home.title": "デジタル資産と知的財産のための信頼インフラ",
    "home.badge": "製品 MVP · デモ準備完了", "home.cta.demo": "完全なデモ →",
    "auth.title": "AEVION アイデンティティ", "auth.register": "登録", "auth.login": "ログイン",
    "auth.name": "名前", "auth.password": "パスワード", "auth.logout": "ログアウト",
    "auth.submit.register": "アカウント作成", "auth.submit.login": "ログイン",
    "auth.waiting": "お待ちください...", "auth.session": "セッション有効",
    "pipeline.bureau": "局",
    "bank.title": "エコシステムデジタルバンク", "bank.balance": "残高",
    "bank.available": "利用可能", "bank.send": "送信",
    "bank.history": "取引履歴",
    "footer.products": "製品", "footer.company": "会社",
    "footer.rights": "全著作権所有。",
    "common.save": "保存", "common.cancel": "キャンセル", "common.close": "閉じる",
    "common.back": "戻る", "common.next": "次へ", "common.loading": "読み込み中…",
    "common.error": "エラー", "common.success": "成功", "common.search": "検索",
    "common.language": "言語", "common.settings": "設定",
  },
  ar: {
    "nav.demo": "عرض النظام البيئي", "nav.auth": "تسجيل الدخول", "nav.bureau": "المكتب",
    "nav.planet": "الكوكب", "nav.awards": "الجوائز", "nav.bank": "البنك",
    "nav.chess": "الشطرنج", "nav.help": "المساعدة",
    "home.title": "بنية تحتية موثوقة للأصول الرقمية والملكية الفكرية",
    "home.badge": "منتج MVP · جاهز للعرض", "home.cta.demo": "العرض الكامل →",
    "auth.title": "هوية AEVION", "auth.register": "التسجيل", "auth.login": "تسجيل الدخول",
    "auth.name": "الاسم", "auth.password": "كلمة المرور", "auth.logout": "تسجيل الخروج",
    "auth.submit.register": "إنشاء حساب", "auth.submit.login": "تسجيل الدخول",
    "auth.waiting": "يرجى الانتظار...", "auth.session": "الجلسة نشطة",
    "pipeline.bureau": "المكتب",
    "bank.title": "البنك الرقمي للنظام البيئي", "bank.balance": "الرصيد",
    "bank.available": "المتاح", "bank.send": "إرسال",
    "bank.history": "سجل المعاملات",
    "footer.products": "المنتجات", "footer.company": "الشركة",
    "footer.rights": "جميع الحقوق محفوظة.",
    "common.save": "حفظ", "common.cancel": "إلغاء", "common.close": "إغلاق",
    "common.back": "رجوع", "common.next": "التالي", "common.loading": "جاري التحميل…",
    "common.error": "خطأ", "common.success": "نجاح", "common.search": "بحث",
    "common.language": "اللغة", "common.settings": "الإعدادات",
  },
  pt: {
    "nav.demo": "Demo do ecossistema", "nav.auth": "Acesso", "nav.bureau": "Escritório",
    "nav.planet": "Planeta", "nav.awards": "Prêmios", "nav.bank": "Banco",
    "nav.chess": "Xadrez", "nav.help": "Ajuda",
    "home.title": "Infraestrutura de confiança para ativos digitais e propriedade intelectual",
    "home.badge": "Produto MVP · pronto para demo", "home.cta.demo": "Demo completa →",
    "auth.title": "Identidade AEVION", "auth.register": "Cadastrar", "auth.login": "Entrar",
    "auth.name": "Nome", "auth.password": "Senha", "auth.logout": "Sair",
    "auth.submit.register": "Criar conta", "auth.submit.login": "Entrar",
    "auth.waiting": "Aguarde...", "auth.session": "Sessão ativa",
    "pipeline.bureau": "Escritório",
    "bank.title": "Banco digital do ecossistema", "bank.balance": "Saldo",
    "bank.available": "Disponível", "bank.send": "Enviar",
    "bank.history": "Histórico de transações",
    "footer.products": "Produtos", "footer.company": "Empresa",
    "footer.rights": "Todos os direitos reservados.",
    "common.save": "Salvar", "common.cancel": "Cancelar", "common.close": "Fechar",
    "common.back": "Voltar", "common.next": "Próximo", "common.loading": "Carregando…",
    "common.error": "Erro", "common.success": "Sucesso", "common.search": "Pesquisar",
    "common.language": "Idioma", "common.settings": "Configurações",
  },
  tr: {
    "nav.demo": "Ekosistem demosu", "nav.auth": "Giriş", "nav.bureau": "Büro",
    "nav.planet": "Gezegen", "nav.awards": "Ödüller", "nav.bank": "Banka",
    "nav.chess": "Satranç", "nav.help": "Yardım",
    "home.title": "Dijital varlıklar ve fikri mülkiyet için güven altyapısı",
    "home.badge": "Ürün MVP · demoya hazır", "home.cta.demo": "Tam demo →",
    "auth.title": "AEVION Kimliği", "auth.register": "Kayıt ol", "auth.login": "Giriş yap",
    "auth.name": "Ad", "auth.password": "Şifre", "auth.logout": "Çıkış yap",
    "auth.submit.register": "Hesap oluştur", "auth.submit.login": "Giriş yap",
    "auth.waiting": "Lütfen bekleyin...", "auth.session": "Oturum aktif",
    "pipeline.bureau": "Büro",
    "bank.title": "Ekosistem dijital bankası", "bank.balance": "Bakiye",
    "bank.available": "Mevcut", "bank.send": "Gönder",
    "bank.history": "İşlem geçmişi",
    "footer.products": "Ürünler", "footer.company": "Şirket",
    "footer.rights": "Tüm hakları saklıdır.",
    "common.save": "Kaydet", "common.cancel": "İptal", "common.close": "Kapat",
    "common.back": "Geri", "common.next": "İleri", "common.loading": "Yükleniyor…",
    "common.error": "Hata", "common.success": "Başarı", "common.search": "Ara",
    "common.language": "Dil", "common.settings": "Ayarlar",
  },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) { setLangState(saved); return; }
    } catch {}
    setLangState(detectBrowserLang());
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
      document.documentElement.dir = LANG_RTL[l] ? "rtl" : "ltr";
      try {
        document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = LANG_RTL[lang] ? "rtl" : "ltr";
    }
  }, [lang]);

  const t = useCallback(
    (key: string): string => translations[lang]?.[key] || translations.en?.[key] || key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Compact language switcher — used in narrow spaces */
export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", overflow: "hidden", fontSize: 12 }}>
      {LANGS.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={LANG_FULL[l]}
          style={{
            padding: "5px 10px",
            border: "none",
            borderLeft: i === 0 ? "none" : "1px solid rgba(15,23,42,0.12)",
            background: lang === l ? "#0f172a" : "transparent",
            color: lang === l ? "#fff" : "#64748b",
            fontWeight: lang === l ? 800 : 500,
            cursor: "pointer",
          }}
        >
          {LANG_FLAG[l]}
        </button>
      ))}
    </div>
  );
}
