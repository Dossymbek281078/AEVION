export type GlobusProjectKind = "core" | "product" | "service" | "experiment";
export type GlobusProjectStatus = "idea" | "planning" | "in_progress" | "mvp" | "launched";
export interface GlobusProject {
    id: string;
    code: string;
    name: string;
    description: string;
    kind: GlobusProjectKind;
    status: GlobusProjectStatus;
    priority: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=globus.d.ts.map