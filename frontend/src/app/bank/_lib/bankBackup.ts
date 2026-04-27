// Single-file portable backup of all client-side bank state stored in
// localStorage. Lets users move setup between browsers/devices and acts as
// a safety net for the "browser reset wipes everything" gotcha.
//
// What's included:
//   - Goals, recurring, splits, circles, gifts, contacts
//   - Signatures (audit trail), devices, biometric prefs, freeze state+log
//   - Salary advance state, autopilot config/actions/state
//   - UI prefs: display currency, last tier
//
// Excluded by design:
//   - aevion_auth_token_v1 (security: never include credentials in a file)
//   - demo seed flag, tour-seen flag, primer/copilot dismiss flags
//     (UX state — should reset per-browser, not travel with backups)

const PORTABLE_KEYS: string[] = [
  "aevion_bank_goals_v1",
  "aevion_bank_recurring_v1",
  "aevion_bank_splits_v1",
  "aevion_bank_circles_v1",
  "aevion_bank_gifts_v1",
  "aevion_bank_contacts_v1",
  "aevion_bank_signatures_v1",
  "aevion_bank_devices_v1",
  "aevion_bank_biometric_v1",
  "aevion_bank_freeze_v1",
  "aevion_bank_freeze_log_v1",
  "aevion_bank_advance_v1",
  "aevion_bank_autopilot_config_v1",
  "aevion_bank_autopilot_actions_v1",
  "aevion_bank_autopilot_state_v1",
  "aevion_bank_display_currency_v1",
  "aevion_bank_last_tier_v1",
];

export const BACKUP_VERSION = 1;
export const BACKUP_MAGIC = "aevion_bank_backup";

export type BankBackup = {
  magic: typeof BACKUP_MAGIC;
  version: number;
  exportedAt: string; // ISO
  accountId: string | null;
  data: Record<string, string>; // raw localStorage values
};

export type ImportSummary = {
  restoredKeys: number;
  skippedKeys: number;
  warnings: string[];
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function buildBackup(accountId: string | null): BankBackup {
  const data: Record<string, string> = {};
  for (const key of PORTABLE_KEYS) {
    const value = safeGet(key);
    if (value != null) data[key] = value;
  }
  return {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    accountId,
    data,
  };
}

export function downloadBackup(accountId: string | null): { filename: string; size: number } {
  const backup = buildBackup(accountId);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = backup.exportedAt.slice(0, 10).replace(/-/g, "");
  const tail = accountId ? `-${accountId.slice(0, 10)}` : "";
  a.href = url;
  a.download = `aevion-bank-backup-${stamp}${tail}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { filename: a.download, size: blob.size };
}

function isBackup(obj: unknown): obj is BankBackup {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    o.magic === BACKUP_MAGIC &&
    typeof o.version === "number" &&
    typeof o.exportedAt === "string" &&
    o.data !== null &&
    typeof o.data === "object"
  );
}

export async function importBackupFromFile(file: File): Promise<ImportSummary> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup file: not valid JSON");
  }
  if (!isBackup(parsed)) {
    throw new Error("Invalid backup file: not an AEVION Bank backup");
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error(
      `Backup version ${parsed.version} is newer than this app (v${BACKUP_VERSION}). Update the app and try again.`,
    );
  }

  const summary: ImportSummary = { restoredKeys: 0, skippedKeys: 0, warnings: [] };
  const allowed = new Set(PORTABLE_KEYS);

  for (const [key, value] of Object.entries(parsed.data)) {
    if (!allowed.has(key)) {
      summary.skippedKeys += 1;
      summary.warnings.push(`Skipped unknown key: ${key}`);
      continue;
    }
    if (typeof value !== "string") {
      summary.skippedKeys += 1;
      summary.warnings.push(`Skipped non-string value for: ${key}`);
      continue;
    }
    try {
      localStorage.setItem(key, value);
      summary.restoredKeys += 1;
    } catch {
      summary.skippedKeys += 1;
      summary.warnings.push(`Failed to write: ${key}`);
    }
  }

  notifyConsumers();
  return summary;
}

// Wakes every consumer hook that listens for storage / custom events.
// Storage event in modern browsers is only fired in *other* tabs, so we
// dispatch the same-tab custom events used across the bank.
function notifyConsumers(): void {
  try {
    window.dispatchEvent(new Event("storage"));
  } catch {}
  for (const evt of [
    "aevion:goals-changed",
    "aevion:circles-changed",
    "aevion:signatures-changed",
    "aevion:splits-changed",
    "aevion:recurring-changed",
    "aevion:gifts-changed",
    "aevion:contacts-changed",
    "aevion:devices-changed",
    "aevion:freeze-changed",
    "aevion:advance-changed",
    "aevion:autopilot-changed",
  ]) {
    try {
      window.dispatchEvent(new Event(evt));
    } catch {}
  }
}
