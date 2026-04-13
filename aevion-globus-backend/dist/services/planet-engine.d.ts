import "dotenv/config";
export declare function xpForLevel(level: number): number;
export declare function calcLevel(totalXp: number): {
    level: number;
    currentXp: number;
    nextLevelXp: number;
};
export declare function awardXp(userId: string, amount: number, reason: string, metadata?: object): Promise<{
    level: number;
    currentXp: number;
    nextLevelXp: number;
    id: string;
    createdAt: Date;
    userId: string;
    xp: number;
    totalScore: number;
    updatedAt: Date;
}>;
export declare function getAllTerritories(userId: string): Promise<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    xpReward: number;
    order: number;
    unlocked: boolean;
    progress: number;
    unlockedAt: Date | null;
}[]>;
export declare function unlockTerritory(userId: string, slug: string): Promise<{
    id: string;
    planetUserId: string;
    territoryId: string;
    unlockedAt: Date;
    progress: number;
}>;
export declare function updateTerritoryProgress(userId: string, slug: string, progress: number): Promise<{
    id: string;
    planetUserId: string;
    territoryId: string;
    unlockedAt: Date;
    progress: number;
}>;
export declare function getAvailableQuests(userId: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    type: import("@prisma/client").$Enums.QuestType;
    xpReward: number;
    territoryId: string | null;
    status: import("@prisma/client").$Enums.QuestStatus | null;
    userProgress: number;
    completedAt: Date | null;
}[]>;
export declare function startQuest(userId: string, questId: string): Promise<{
    id: string;
    status: import("@prisma/client").$Enums.QuestStatus;
    planetUserId: string;
    progress: number;
    questId: string;
    completedAt: Date | null;
}>;
export declare function completeQuest(userId: string, questId: string): Promise<{
    level: number;
    currentXp: number;
    nextLevelXp: number;
    id: string;
    createdAt: Date;
    userId: string;
    xp: number;
    totalScore: number;
    updatedAt: Date;
    quest: {
        id: string;
        title: string;
        description: string | null;
        createdAt: Date;
        type: import("@prisma/client").$Enums.QuestType;
        territoryId: string | null;
        xpReward: number;
        isActive: boolean;
    };
    xpAwarded: number;
}>;
export declare function updateQuestProgress(userId: string, questId: string, progress: number): Promise<{
    id: string;
    status: import("@prisma/client").$Enums.QuestStatus;
    planetUserId: string;
    progress: number;
    questId: string;
    completedAt: Date | null;
}>;
export declare function getLeaderboard(limit?: number): Promise<{
    id: string;
    userId: string;
    xp: number;
    level: number;
    updatedAt: Date;
    displayName: string;
    avatarUrl: string | null;
    rank: number | null;
    period: import("@prisma/client").$Enums.LeaderboardPeriod;
}[]>;
export declare function getUserRank(userId: string): Promise<{
    rank: null;
    xp: number;
} | {
    rank: number;
    xp: number;
}>;
export declare function seedPlanetEngine(): Promise<{
    territories: number;
    quests: number;
}>;
//# sourceMappingURL=planet-engine.d.ts.map