import { redirect } from "next/navigation";

// Paddle never passed KYC and is dead. This route used to render a Paddle
// checkout ("Merchant of Record") — factually wrong now. Gumroad is the only
// live processor, so send any /pricing/paddle traffic to the real pricing page.
export default function PaddlePricingRedirect() {
  redirect("/pricing");
}
