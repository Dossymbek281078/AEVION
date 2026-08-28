/** Проставлено scripts/vercel-deploy.sh при выкатке. В git лежат заглушки. */
export type BuildStamp = {
  commit: string;
  branch: string;
  builtAt: string | null;
};

export const BUILD_STAMP: BuildStamp = {
  commit: "55f3848bc7f2",
  branch: "feat/funnel-upsell-allaccess",
  builtAt: "2026-08-28T14:56:18Z",
};
