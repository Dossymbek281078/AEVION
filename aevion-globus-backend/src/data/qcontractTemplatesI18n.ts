// Шаблоны QContract на en/kk. 28.10.2026: /api/qcontract/templates отдавал только русский —
// на /qcontract/create?lang=en и kk человек получал договор на чужом языке и в списке, и в тексте.
// Русский исходник остаётся в routes/qcontract.ts; здесь — те же пять договоров по смыслу,
// с теми же полями-пропусками, чтобы заполнение не зависело от языка.

export type TemplateText = { title: string; description: string; content: string };

export const QCONTRACT_TEMPLATES_I18N: Record<"en" | "kk", Record<string, TemplateText>> = {
  en: {
    nda: {
      title: "Non-Disclosure Agreement (NDA)",
      description: "Standard NDA for business partners",
      content: `NON-DISCLOSURE AGREEMENT

Date: _______________
Parties: _______________ (Disclosing Party) and _______________ (Receiving Party)

1. SUBJECT OF THE AGREEMENT
The Parties agree not to disclose confidential information exchanged in the course of their cooperation.

2. CONFIDENTIAL INFORMATION
Confidential information means any information of a technical, commercial or financial nature.

3. OBLIGATIONS OF THE PARTIES
The Receiving Party undertakes to:
- not disclose the information received to third parties
- use the information solely for the purposes of the cooperation
- notify the Disclosing Party of any leak

4. TERM
This Agreement enters into force upon signature and remains in effect for 3 (three) years.

5. LIABILITY
A breach of this Agreement entails compensation for the damage caused.

Signatures of the Parties:

Disclosing Party: _______________________
Receiving Party:  _______________________`,
    },
    offer: {
      title: "Job Offer",
      description: "Employment offer with terms",
      content: `JOB OFFER

Dear _______________,

We are pleased to offer you the position of _______________ at _______________.

TERMS OF THE OFFER:
• Position:     _______________
• Department:   _______________
• Start date:   _______________
• Salary: _______________ KZT per month (before taxes)
• Probation period: 3 months

ADDITIONAL TERMS:
• Working hours: Mon–Fri, 09:00–18:00
• Format: _______________
• Benefits: _______________

Please confirm your acceptance of this offer by _______________.

Sincerely,
_______________
HR Manager, _______________`,
    },
    service: {
      title: "Service Agreement",
      description: "Contract template for freelancers",
      content: `SERVICE AGREEMENT No.___

City: _______________, date: _______________ 2026

_______________ (Contractor) and _______________ (Client) have entered into this Agreement:

1. SUBJECT OF THE AGREEMENT
The Contractor undertakes to provide the following services: _______________.

2. TIMELINE
Start: _______________. End: _______________.

3. PRICE AND PAYMENT TERMS
The price of the services is _______________ KZT.
Payment is made: _______________.

4. OBLIGATIONS OF THE PARTIES
The Contractor undertakes to complete the work within the agreed time.
The Client undertakes to accept and pay for the result of the work.

5. LIABILITY
The Parties are liable in accordance with the legislation of the Republic of Kazakhstan.

Details and signatures:
Contractor: _______________________
Client:     _______________________`,
    },
    construction: {
      title: "Construction Contract",
      description: "Template for construction and renovation works",
      content: `CONSTRUCTION CONTRACT No.___

City: _______________, date: _______________ 2026

_______________ (Contractor) and _______________ (Client):

1. SUBJECT OF THE CONTRACT
The Contractor undertakes to perform construction and installation works according to the project documentation:
Site: _______________
Type of works: _______________
Site address: _______________

2. SCHEDULE
Start: _______________. End: _______________.
For missed deadlines — a penalty of 0.1% per day of the cost of the delayed works.

3. PRICE AND SETTLEMENT
Total price: _______________ KZT (including 12% VAT).
Advance payment (30%): _______________ KZT by _______________.
Interim payments: monthly, based on acceptance certificates (form KS-2).
Final payment: within 10 business days after the final KS-2 certificate is signed.

4. ESTIMATE AND PROJECT DOCUMENTATION
Cost estimate: Appendix No.1 to this Contract.
The estimate may be changed only by a supplementary agreement.

5. WARRANTY
Warranty period: 2 (two) years from the handover of the site.

6. ACCEPTANCE OF WORKS
Acceptance is made by certificates KS-2 (works accepted for the period) and KS-3 (statement of cost).

Signatures:
Contractor: _______________________
Client:     _______________________`,
    },
    "equipment-lease": {
      title: "Equipment Lease Agreement",
      description: "For renting machinery and equipment",
      content: `EQUIPMENT LEASE AGREEMENT No.___

City: _______________, date: _______________ 2026

_______________ (Lessor) and _______________ (Lessee):

1. SUBJECT OF THE AGREEMENT
The Lessor provides the Lessee with the following for temporary paid use:
Item: _______________
Inventory No.: _______________
Technical condition at handover: _______________

2. LEASE TERM
From: _______________ to: _______________

3. RENT
Rent: _______________ KZT per ___
Payment terms: _______________

4. OBLIGATIONS OF THE LESSEE
- Use the equipment strictly for its intended purpose
- Keep it in good working order
- Report any malfunction immediately
- Return it on time and in the same condition (normal wear and tear excepted)

5. LIABILITY
If the equipment is damaged through the Lessee's fault — full compensation for the damage.

Signatures:
Lessor: _______________________
Lessee: _______________________`,
    },
  },
  kk: {
    nda: {
      title: "Құпия ақпаратты жария етпеу туралы келісім (NDA)",
      description: "Бизнес серіктестерге арналған стандартты NDA",
      content: `ҚҰПИЯ АҚПАРАТТЫ ЖАРИЯ ЕТПЕУ ТУРАЛЫ КЕЛІСІМ

Күні: _______________
Тараптар: _______________ (Ашатын тарап) және _______________ (Алатын тарап)

1. КЕЛІСІМНІҢ МӘНІ
Тараптар ынтымақтастық барысында берілетін құпия ақпаратты жария етпеуге келісті.

2. ҚҰПИЯ АҚПАРАТ
Құпия ақпарат деп техникалық, коммерциялық немесе қаржылық сипаттағы кез келген ақпарат түсініледі.

3. ТАРАПТАРДЫҢ МІНДЕТТЕМЕЛЕРІ
Алатын тарап міндеттенеді:
- алынған ақпаратты үшінші тұлғаларға жария етпеуге
- ақпаратты тек ынтымақтастық мақсатында пайдалануға
- кез келген ақпарат таралуы туралы Ашатын тарапқа хабарлауға

4. ҚОЛДАНЫЛУ МЕРЗІМІ
Осы келісім қол қойылған сәттен бастап күшіне енеді және 3 (үш) жыл бойы қолданылады.

5. ЖАУАПКЕРШІЛІК
Осы келісімді бұзу келтірілген залалды өтеуге әкеп соғады.

Тараптардың қолдары:

Ашатын тарап: _______________________
Алатын тарап: _______________________`,
    },
    offer: {
      title: "Қызметкерге жұмыс ұсынысы",
      description: "Шарттары көрсетілген жұмыс ұсынысы",
      content: `ЖҰМЫСҚА ҚАБЫЛДАУ ТУРАЛЫ ҰСЫНЫС

Құрметті _______________,

Сізге _______________ компаниясында _______________ лауазымын ұсынуға қуаныштымыз.

ҰСЫНЫС ШАРТТАРЫ:
• Лауазымы:      _______________
• Бөлімі:        _______________
• Жұмысты бастау: _______________
• Жалақы: айына _______________ теңге (салық шегерілгенге дейін)
• Сынақ мерзімі: 3 ай

ҚОСЫМША ШАРТТАР:
• Жұмыс кестесі: дс–жм, 09:00–18:00
• Формат: _______________
• Әлеуметтік пакет: _______________

Ұсынысты қабылдағаныңызды _______________ дейін растауыңызды сұраймыз.

Құрметпен,
_______________
HR-менеджер, _______________`,
    },
    service: {
      title: "Қызмет көрсету шарты",
      description: "Фрилансерлерге арналған шарт үлгісі",
      content: `ҚЫЗМЕТ КӨРСЕТУ ШАРТЫ №___

_______________ қ., 2026 ж. «___» _______________

_______________ (Орындаушы) және _______________ (Тапсырыс беруші) осы шартты жасасты:

1. ШАРТТЫҢ МӘНІ
Орындаушы мына қызметтерді көрсетуге міндеттенеді: _______________.

2. МЕРЗІМДЕР
Басталуы: _______________. Аяқталуы: _______________.

3. ҚҰНЫ ЖӘНЕ ТӨЛЕУ ТӘРТІБІ
Қызметтердің құны _______________ теңге.
Төлем жүргізіледі: _______________.

4. ТАРАПТАРДЫҢ МІНДЕТТЕМЕЛЕРІ
Орындаушы жұмысты белгіленген мерзімде орындауға міндеттенеді.
Тапсырыс беруші жұмыс нәтижесін қабылдауға және оған ақы төлеуге міндеттенеді.

5. ЖАУАПКЕРШІЛІК
Тараптар ҚР заңнамасына сәйкес жауап береді.

Деректемелер мен қолдар:
Орындаушы:        _______________________
Тапсырыс беруші: _______________________`,
    },
    construction: {
      title: "Құрылыс мердігерлігі шарты",
      description: "Құрылыс және жөндеу жұмыстарына арналған үлгі",
      content: `ҚҰРЫЛЫС МЕРДІГЕРЛІГІ ШАРТЫ №___

_______________ қ., 2026 ж. «___» _______________

_______________ (Мердігер) және _______________ (Тапсырыс беруші):

1. ШАРТТЫҢ МӘНІ
Мердігер жобалық құжаттамаға сәйкес құрылыс-монтаж жұмыстарын орындауға міндеттенеді:
Нысан: _______________
Жұмыс түрі: _______________
Нысанның мекенжайы: _______________

2. ЖҰМЫСТЫ ОРЫНДАУ МЕРЗІМДЕРІ
Басталуы: _______________. Аяқталуы: _______________.
Мерзім сақталмаса — кешіктірілген жұмыс құнының күніне 0,1% өсімпұл.

3. ҚҰНЫ ЖӘНЕ ЕСЕП АЙЫРЫСУ ТӘРТІБІ
Жалпы құны: _______________ теңге (ҚҚС 12% қоса алғанда).
Аванс (30%): _______________ теңге, _______________ дейін.
Аралық есеп айырысу: ай сайын КС-2 актілері бойынша.
Түпкілікті есеп айырысу: қорытынды КС-2 актісіне қол қойылғаннан кейін 10 жұмыс күні ішінде.

4. СМЕТА ЖӘНЕ ЖОБАЛЫҚ ҚҰЖАТТАМА
Сметалық құжаттама: осы шартқа №1 қосымша.
Сметаны өзгерту тек қосымша келісіммен мүмкін.

5. КЕПІЛДІК МІНДЕТТЕМЕЛЕР
Кепілдік мерзімі: нысан тапсырылған сәттен бастап 2 (екі) жыл.

6. ЖҰМЫСТЫ ТАПСЫРУ ТӘРТІБІ
Қабылдау КС-2 (кезең ішіндегі қабылдау) және КС-3 (құны туралы анықтама) актілері бойынша жүргізіледі.

Қолдар:
Мердігер:         _______________________
Тапсырыс беруші: _______________________`,
    },
    "equipment-lease": {
      title: "Жабдықты жалға беру шарты",
      description: "Техника мен жабдықты жалға алуға арналған",
      content: `ЖАБДЫҚТЫ ЖАЛҒА БЕРУ ШАРТЫ №___

_______________ қ., 2026 ж. «___» _______________

_______________ (Жалға беруші) және _______________ (Жалға алушы):

1. ШАРТТЫҢ МӘНІ
Жалға беруші Жалға алушыға уақытша ақылы пайдалануға береді:
Атауы: _______________
Түгендеу №: _______________
Беру сәтіндегі техникалық жағдайы: _______________

2. ЖАЛҒА АЛУ МЕРЗІМІ
_______________ бастап _______________ дейін

3. ЖАЛДАУ АҚЫСЫ
Жалдау құны: _______________ теңге/___
Төлеу тәртібі: _______________

4. ЖАЛҒА АЛУШЫНЫҢ МІНДЕТТЕРІ
- Жабдықты тек мақсатына сай пайдалану
- Жарамды техникалық күйде ұстау
- Ақаулар туралы дереу хабарлау
- Мерзімінде және сол күйінде қайтару (қалыпты тозуды ескере отырып)

5. ЖАУАПКЕРШІЛІК
Жабдық Жалға алушының кінәсінен зақымдалса — залалды толық өтеу.

Қолдар:
Жалға беруші: _______________________
Жалға алушы:  _______________________`,
    },
  },
};
