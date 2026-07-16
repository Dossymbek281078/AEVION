// LEGACY SHIM. The real component now lives in ./UpgradeButton (Gumroad is the
// only live processor; Paddle never passed KYC and is dead). ~11 module pages
// still import { PaddleUpgradeButton } — this alias keeps them working without
// touching those pages. New code should import { UpgradeButton }.
export { UpgradeButton, UpgradeButton as PaddleUpgradeButton } from "./UpgradeButton";
