"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.сводкаПейволла = сводкаПейволла;
const planGate_1 = require("./planGate");
const moduleAccess_1 = require("../data/moduleAccess");
const freeActionQuota_1 = require("./freeActionQuota");
function сводкаПейволла() {
    const продаётся = moduleAccess_1.ДОСТУП_МОДУЛЕЙ.filter((м) => м.продаётся);
    return {
        configured: Boolean(process.env.PAYWALL_MODULES?.trim()),
        modulesChecked: moduleAccess_1.ДОСТУП_МОДУЛЕЙ.length,
        walledNow: moduleAccess_1.ДОСТУП_МОДУЛЕЙ.filter((м) => (0, planGate_1.paywallEnabledFor)(м.moduleId)).length,
        walledByData: (0, moduleAccess_1.модулиСоСтенойПоДанным)().length,
        soldButOpen: продаётся.filter((м) => !(0, planGate_1.paywallEnabledFor)(м.moduleId)).length,
        soldTotal: продаётся.length,
        paidActions: (0, freeActionQuota_1.сводкаПлатныхДействий)(),
        guestIpFromSite: (0, freeActionQuota_1.сводкаАдресаГостя)(),
    };
}
