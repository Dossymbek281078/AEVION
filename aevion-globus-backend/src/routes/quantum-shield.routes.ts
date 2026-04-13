import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

// ── GET /api/quantum-shield ── list all shield records ──────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId; // from JWT middleware

    const records = await prisma.quantumShieldRecord.findMany({
      where: userId ? { signature: { object: { ownerId: userId } } } : {},
      include: {
        shards: true,
        signature: {
          include: { object: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to frontend format
    const transformed = records.map((r: any) => {
      const activeShards = r.shards.filter((s: any) => s.status === 'ACTIVE').length;
      const totalShards = r.shards.length;
      const threshold = r.threshold;

      let status: 'protected' | 'warning' | 'critical' = 'protected';
      if (activeShards < threshold) status = 'critical';
      else if (activeShards < totalShards) status = 'warning';

      let quantumResistanceLevel = 'Maximum';
      if (status === 'critical') quantumResistanceLevel = 'Degraded';
      else if (status === 'warning') quantumResistanceLevel = 'High';

      return {
        id: r.id,
        originalSignatureId: r.signatureId,
        fileName: r.signature?.object?.fileName || 'Unknown',
        createdAt: r.createdAt.toISOString(),
        algorithm: `Shamir Secret Sharing + ${r.algorithm || 'Ed25519'}`,
        totalShards,
        threshold: r.threshold,
        shards: r.shards.map((s: any, idx: number) => ({
          id: s.id,
          index: idx + 1,
          location: s.location,
          status: s.status.toLowerCase(),
          lastVerified: s.lastVerified?.toISOString() || s.createdAt.toISOString(),
        })),
        status,
        quantumResistanceLevel,
      };
    });

    res.json({ records: transformed });
  } catch (err) {
    console.error('[QuantumShield] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch shield records' });
  }
});

// ── GET /api/quantum-shield/:id ── single record detail ─────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const record = await prisma.quantumShieldRecord.findUnique({
      where: { id: req.params.id },
      include: {
        shards: true,
        signature: { include: { object: true } },
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Shield record not found' });
    }

    res.json({ record });
  } catch (err) {
    console.error('[QuantumShield] GET/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch shield record' });
  }
});

// ── POST /api/quantum-shield/:id/verify ── verify shards ────────
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const record = await prisma.quantumShieldRecord.findUnique({
      where: { id: req.params.id },
      include: { shards: true },
    });

    if (!record) {
      return res.status(404).json({ error: 'Shield record not found' });
    }

    // Update lastVerified on all active shards
    const now = new Date();
    await Promise.all(
      record.shards
        .filter((s: any) => s.status === 'ACTIVE')
        .map((s: any) =>
          prisma.quantumShieldShard.update({
            where: { id: s.id },
            data: { lastVerified: now },
          })
        )
    );

    res.json({ success: true, verifiedAt: now.toISOString() });
  } catch (err) {
    console.error('[QuantumShield] verify error:', err);
    res.status(500).json({ error: 'Failed to verify shards' });
  }
});

// ── GET /api/quantum-shield/stats ── aggregated stats ───────────
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;

    const totalRecords = await prisma.quantumShieldRecord.count();
    const totalShards = await prisma.quantumShieldShard.count();
    const activeShards = await prisma.quantumShieldShard.count({
      where: { status: 'ACTIVE' },
    });
    const compromisedShards = await prisma.quantumShieldShard.count({
      where: { status: 'COMPROMISED' },
    });

    res.json({
      totalRecords,
      totalShards,
      activeShards,
      compromisedShards,
      offlineShards: totalShards - activeShards - compromisedShards,
    });
  } catch (err) {
    console.error('[QuantumShield] stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
