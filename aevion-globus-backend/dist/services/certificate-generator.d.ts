import "dotenv/config";
interface CertData {
    id: string;
    title: string;
    description: string;
    kind: string;
    contentHash: string;
    ownerName: string | null;
    ownerEmail: string | null;
    signature: string | null;
    createdAt: string;
    quantumShield: {
        recordId: string;
        algorithm: string;
        publicKey: string;
        timestamp: string;
    } | undefined;
}
export declare function generateCertificatePDF(data: CertData): Promise<Buffer>;
export {};
//# sourceMappingURL=certificate-generator.d.ts.map