export declare const authRouter: import("express-serve-static-core").Router;
export declare function verifyToken(token: string): {
    sub: string;
    email: string;
    exp: number;
} | null;
//# sourceMappingURL=auth.d.ts.map