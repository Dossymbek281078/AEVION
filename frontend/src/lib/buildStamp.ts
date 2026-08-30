/** Проставлено scripts/vercel-deploy.sh при выкатке. В git лежат заглушки. */
export type BuildStamp = {
  commit: string;
  branch: string;
  builtAt: string | null;
};

export const BUILD_STAMP: BuildStamp = {
  commit: "20fd4874fe26",
  branch: "deploy/startupx-merged-2026-08-29",
  builtAt: "2026-08-30T15:21:18Z",
};
