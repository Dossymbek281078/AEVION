/** Проставлено scripts/vercel-deploy.sh при выкатке. В git лежат заглушки. */
export type BuildStamp = {
  commit: string;
  branch: string;
  builtAt: string | null;
};

export const BUILD_STAMP: BuildStamp = {
  commit: "unknown",
  branch: "none",
  builtAt: null,
};
