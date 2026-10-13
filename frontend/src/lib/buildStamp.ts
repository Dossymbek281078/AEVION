/** Проставлено scripts/vercel-deploy.sh при выкатке. В git лежат заглушки. */
export type BuildStamp = {
  commit: string;
  branch: string;
  builtAt: string | null;
};

export const BUILD_STAMP: BuildStamp = {
  commit: "c7db2d5a4e30",
  branch: "deploy/wave58-1210-1040",
  builtAt: "2026-10-13T10:05:32Z",
};
