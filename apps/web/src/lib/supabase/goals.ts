import { SupabaseClient } from "@supabase/supabase-js";
import { createMilestones, deleteUnreachedMilestones, getMilestonesByGoal } from "./milestones";
import { scoreGoalCompletion } from "./scoring";
import { resetStaleStreaks } from "./streak";
import { BASE_CHECKIN_VALUE, getMilestoneCount } from "../constants";

const ALLOWED_UPDATE_FIELDS = [
    'goal_name', 'goal_description', 'goal_type',
    'benchmark_name', 'benchmark_target_value',
    'target_completion_at', 'completion_message',
    'is_public', 'is_goal_name_public', 'is_username_public',
    'is_description_public', 'is_goal_type_public',
    'are_checkins_public', 'is_benchmark_name_public',
    'is_deleted',
];

const ALLOWED_STATUS_VALUES = [
    'dropped',
    'completed',
    'active',
];

export async function getGoalsByUser(
    supabase: SupabaseClient, 
    userId: string,
    status: string | null
) {
    if (status && !ALLOWED_STATUS_VALUES.includes(status)) {
        return { data: null, error: { message: 'Invalid status value' } };
    }

    let query = supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

    if (status) {
        query = query.eq('status', status);
    }

    const result = await query;

    // Reset streaks for goals where the user missed a day (write-on-read cleanup)
    if (result.data) {
        result.data = await resetStaleStreaks(supabase, result.data);
    }

    return result;
}



export async function getGoalById(supabase: SupabaseClient
    , goalId: string,
    userId: string
) {
    const result = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();

    // Reset streak if the user missed a day (write-on-read cleanup)
    if (result.data) {
        const [corrected] = await resetStaleStreaks(supabase, [result.data]);
        result.data = corrected;
    }

    return result;
}

export async function createGoal(supabase: SupabaseClient,
    userId: string,
    body: Record<string, unknown>
) {
    const newGoal = {
        user_id: userId,
        goal_name: body.goal_name,
        goal_description: body.goal_description,
        goal_type: body.goal_type,
        benchmark_name: body.benchmark_name,
        benchmark_target_value: body.benchmark_target_value,
        checkin_frequency: body.checkin_frequency ?? 'daily',
        days_between_checkins: body.days_between_checkins ?? 1,
        checkin_value: BASE_CHECKIN_VALUE,
        target_completion_at: body.target_completion_at,
        completion_message: body.completion_message,
        is_public: body.is_public,
        is_goal_name_public: body.is_goal_name_public ?? true,
        is_username_public: body.is_username_public ?? true,
        is_description_public: body.is_description_public ?? true,
        is_goal_type_public: body.is_goal_type_public ?? true,
        are_checkins_public: body.are_checkins_public ?? true,
        is_benchmark_name_public: body.is_benchmark_name_public ?? true,
    };

    // Insert the goal row
    const { data: goal, error: goalError } = await supabase
        .from('goals')
        .insert(newGoal)
        .select()
        .single();

    if (goalError || !goal) {
        return { data: null, error: goalError };
    }

    // Auto-generate milestones based on goal duration
    const milestoneRows = generateMilestoneRows(goal.id, userId, goal.target_completion_at, goal.created_at);
    const milestoneCount = milestoneRows.length;

    if (milestoneCount > 0) {
        const { error: msError } = await createMilestones(supabase, milestoneRows);

        if (msError) {
            // Milestone creation failed — delete the goal to avoid partial state
            await supabase.from('goals').delete().eq('id', goal.id);
            return { data: null, error: { message: 'Failed to create milestones' } };
        }

        // Store the count on the goal row
        await supabase
            .from('goals')
            .update({ total_milestones: milestoneCount })
            .eq('id', goal.id);
    }

    // Increment active_goals_count on the profile
    await supabase
        .from('profiles')
        .select('active_goals_count')
        .eq('id', userId)
        .single()
        .then(({ data }) => {
            return supabase
                .from('profiles')
                .update({
                    active_goals_count: (data?.active_goals_count ?? 0) + 1,
                })
                .eq('id', userId);
        });

    return { data: { ...goal, total_milestones: milestoneCount }, error: null };
}

// Builds milestone row objects evenly spaced across the goal timeline.
// Each milestone lands at i/(N+1) of the way through, so the last one
// is always before the goal's end date, never coinciding with it.
// All target_dates are set to midnight UTC for clean display.
// scoreSnapshot defaults to 0 (new goal). When adding milestones to an
// existing goal (tier change), pass the goal's current score_checkin so
// new milestones don't award retroactive bonus points.
export function generateMilestoneRows(
    goalId: string,
    userId: string,
    targetCompletionAt: string,
    createdAt: string,
    scoreSnapshot: number = 0,
) {
    const start = new Date(createdAt);
    const end = new Date(targetCompletionAt);
    const durationMs = end.getTime() - start.getTime();
    const durationDays = durationMs / (1000 * 60 * 60 * 24);

    if (durationDays <= 0) return [];

    const count = getMilestoneCount(durationDays);
    const rows = [];

    for (let i = 1; i <= count; i++) {
        // Place at i/(count+1) of the timeline
        const fraction = i / (count + 1);
        const targetDate = new Date(start.getTime() + durationMs * fraction);

        // Snap to midnight UTC
        targetDate.setUTCHours(0, 0, 0, 0);

        rows.push({
            goal_id: goalId,
            user_id: userId,
            order_index: i,
            target_date: targetDate.toISOString(),
            checkin_score_at_creation: scoreSnapshot,
            points_earned: 0,
        });
    }

    return rows;
}

// Nulls out fields the goal owner marked as private.
// Used when returning public goals to non-owners so raw data doesn't leak.
export function stripPrivateFields(goal: Record<string, any>) {
    const stripped = { ...goal };
    if (!goal.is_goal_name_public)      stripped.goal_name = null;
    if (!goal.is_description_public)    stripped.goal_description = null;
    if (!goal.is_goal_type_public)      stripped.goal_type = null;
    if (!goal.is_benchmark_name_public) {
        stripped.benchmark_name = null;
        stripped.benchmark_target_value = null;
    }
    // completion_message is always private to the owner
    stripped.completion_message = null;
    return stripped;
}

// Fetches public, non-deleted goals for any user (used on profile pages).
// No streak reset here — this is a read-only view for other users.
// By default, excludes goals where is_username_public is false (showing them
// on a profile page would reveal the owner). Pass skipUsernameFilter: true
// for the owner viewing their own profile.
export async function getPublicGoalsByUserId(
    supabase: SupabaseClient,
    userId: string,
    options?: { skipUsernameFilter?: boolean }
) {
    let query = supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_public', true)
        .eq('is_deleted', false);

    if (!options?.skipUsernameFilter) {
        query = query.eq('is_username_public', true);
    }

    return await query.order('created_at', { ascending: false });
}

// Public goal feed, newest first, paginated. Always filters out goals whose
// owner hid their username (showing them in a public feed would reveal the
// owner — same rule as getPublicGoalsByUserId). The viewer's block set is
// passed as excludeUserIds; the following feed additionally restricts to a
// set of followed user ids.
export async function getPublicGoalsFeed(
    supabase: SupabaseClient,
    options: {
        excludeUserIds?: string[];
        restrictToUserIds?: string[];
        limit: number;
        offset: number;
    }
) {
    let query = supabase
        .from('goals')
        .select('*')
        .eq('is_public', true)
        .eq('is_deleted', false)
        .eq('is_username_public', true);

    if (options.restrictToUserIds) {
        query = query.in('user_id', options.restrictToUserIds);
    }

    if (options.excludeUserIds && options.excludeUserIds.length > 0) {
        // PostgREST `not in` list syntax: (uuid1,uuid2,...)
        query = query.not('user_id', 'in', `(${options.excludeUserIds.join(',')})`);
    }

    return await query
        .order('created_at', { ascending: false })
        .range(options.offset, options.offset + options.limit - 1);
}

export async function updateGoal(
    supabase: SupabaseClient, 
    goalId: string, 
    userId: string, 
    body: Record<string, unknown>
) {
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
        if (field in body) {
            updates[field] = body[field];
        }
    }

    if (Object.keys(updates).length !== Object.keys(body).length) {
        return { data: null, error: { message: 'Invalid input' } };
    }

    return await supabase
        .from('goals')
        .update(updates)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();
}

export async function dropGoal(
    supabase: SupabaseClient,
    goalId: string,
    userId: string
) {
    const result = await supabase
        .from('goals')
        .update({
            status: 'dropped',
            current_streak: 0,
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();

    // Update profile goal counts: active -1, dropped +1
    if (result.data) {
        await supabase
            .from('profiles')
            .select('active_goals_count, dropped_goals_count')
            .eq('id', userId)
            .single()
            .then(({ data }) => {
                return supabase
                    .from('profiles')
                    .update({
                        active_goals_count: Math.max((data?.active_goals_count ?? 0) - 1, 0),
                        dropped_goals_count: (data?.dropped_goals_count ?? 0) + 1,
                    })
                    .eq('id', userId);
            });
    }

    return result;
}

export async function completeGoal(
    supabase: SupabaseClient,
    goalId: string,
    userId: string
) {
    // Fetch the goal to get scores for the completion bonus
    const { data: goal, error: fetchError } = await supabase
        .from('goals')
        .select('id, user_id, score_checkin, score_milestone')
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    if (fetchError || !goal) {
        return { data: null, error: { message: 'Goal not found or not active' } };
    }

    // Mark the goal as completed
    const { data: updated, error: updateError } = await supabase
        .from('goals')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', goalId)
        .select()
        .single();

    if (updateError) {
        return { data: null, error: updateError };
    }

    // Apply 5× completion bonus to profile score + update goal counts
    const { completionBonus } = await scoreGoalCompletion(supabase, goal);

    return { data: { ...updated, completion_bonus: completionBonus }, error: null };
}

// Reconciles milestones when a goal's target_completion_at changes.
// Adds new milestones if the tier increased, removes unreached ones if
// it decreased, and cleans up any milestones whose target_date is now
// past the new end date. Returns the new total_milestones count.
export async function reconcileMilestones(
    supabase: SupabaseClient,
    goal: Record<string, any>,
    newTargetDate: string,
) {
    const oldEnd = new Date(goal.target_completion_at);
    const newEnd = new Date(newTargetDate);
    const start = new Date(goal.created_at);

    const oldDurationDays = (oldEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const newDurationDays = (newEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    const oldTierCount = getMilestoneCount(oldDurationDays);
    const newTierCount = getMilestoneCount(newDurationDays);

    // Fetch existing milestones
    const { data: milestones } = await getMilestonesByGoal(supabase, goal.id, goal.user_id);
    if (!milestones) return goal.total_milestones ?? oldTierCount;

    const reached = milestones.filter((m: any) => m.reached_at !== null);
    const unreached = milestones.filter((m: any) => m.reached_at === null);

    if (newTierCount > oldTierCount) {
        // Tier increased — add new milestones. Generate a full set for the
        // new timeline, then only insert the extras (beyond what already exists).
        const needed = newTierCount - milestones.length;
        if (needed > 0) {
            const allRows = generateMilestoneRows(
                goal.id, goal.user_id, newTargetDate, goal.created_at, goal.score_checkin ?? 0
            );
            // Take the last `needed` rows and assign order_index continuing from existing
            const startIndex = milestones.length + 1;
            const newRows = allRows.slice(allRows.length - needed).map((row, i) => ({
                ...row,
                order_index: startIndex + i,
            }));
            if (newRows.length > 0) {
                await createMilestones(supabase, newRows);
            }
        }
    } else if (newTierCount < oldTierCount) {
        // Tier decreased — remove unreached milestones down to
        // max(newTierCount, reachedCount) so we never delete reached ones.
        const keepCount = Math.max(newTierCount, reached.length);
        const toDelete = milestones.length - keepCount;
        if (toDelete > 0) {
            // Delete from the end (highest order_index first)
            const idsToDelete = unreached
                .sort((a: any, b: any) => b.order_index - a.order_index)
                .slice(0, toDelete)
                .map((m: any) => m.id);
            await deleteUnreachedMilestones(supabase, goal.id, goal.user_id, idsToDelete);
        }
    }

    // Remove any unreached milestones whose target_date is after the new end date
    const orphaned = unreached.filter((m: any) => new Date(m.target_date) > newEnd);
    if (orphaned.length > 0) {
        const orphanIds = orphaned.map((m: any) => m.id);
        await deleteUnreachedMilestones(supabase, goal.id, goal.user_id, orphanIds);
    }

    // Calculate final count by re-fetching (simplest way to get accurate number)
    const { data: finalMilestones } = await getMilestonesByGoal(supabase, goal.id, goal.user_id);
    const finalCount = finalMilestones?.length ?? 0;

    // Update the goal's total_milestones
    await supabase
        .from('goals')
        .update({ total_milestones: finalCount })
        .eq('id', goal.id);

    return finalCount;
}
