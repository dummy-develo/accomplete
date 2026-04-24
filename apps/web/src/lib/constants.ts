// Scoring
export const BASE_CHECKIN_VALUE = 10;
export const COMPLETION_MULTIPLIER = 5;

// Milestone tiers — [maxDays, milestoneCount]
// Goals shorter than the first threshold get that count.
// Goals longer than all thresholds get the last count.
export const MILESTONE_TIERS = [
    { maxDays: 30, count: 1 },
    { maxDays: 90, count: 3 },
    { maxDays: Infinity, count: 5 },
];

export function getMilestoneCount(durationDays: number): number {
    for (const tier of MILESTONE_TIERS) {
        if (durationDays < tier.maxDays) return tier.count;
    }
    return MILESTONE_TIERS[MILESTONE_TIERS.length - 1].count;
}
