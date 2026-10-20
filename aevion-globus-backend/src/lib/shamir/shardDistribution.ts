/**
 * Сводка размещения долей Shamir для /api/pipeline/verify/:id.
 *
 * 🔴 20.10.2026: поле realDistributed отдавалось как «policy === distributed_v2» и читалось
 * интеграторами как «сервер не может собрать ключ один». Это ложь: при distributed_v2 доли 2
 * (QuantumShield.shards) и 3 (PublicShardWitness) обе лежат в нашей базе при пороге 2.
 * Теперь realDistributed = true только когда у сервера МЕНЬШЕ порога долей; рядом честные
 * поля serverCanReconstructAlone и shardsOutsideServer. Добавление полей контракт не ломает.
 */
export type ShardLocation = {
  index: number;
  place: string;
  held: string;
  serverHasCopy: boolean;
  cid?: string | null;
  cidValid?: boolean | null;
};

export type ShardDistributionSummary<W> = {
  policy: string;
  realDistributed: boolean;
  serverCanReconstructAlone: boolean;
  shardsOutsideServer: number;
  threshold: number;
  serverCopies: number;
  locations: ShardLocation[];
  witness: W;
};

export function shardDistributionSummary<W>(input: {
  policy: string;
  threshold: unknown;
  locations: ShardLocation[];
  witness: W;
}): ShardDistributionSummary<W> {
  const threshold = Number(input.threshold) > 0 ? Number(input.threshold) : 2;
  const serverCopies = input.locations.filter((l) => l.serverHasCopy).length;
  return {
    policy: input.policy,
    realDistributed: serverCopies < threshold,
    serverCanReconstructAlone: serverCopies >= threshold,
    shardsOutsideServer: input.locations.length - serverCopies,
    threshold,
    serverCopies,
    locations: input.locations,
    witness: input.witness,
  };
}
