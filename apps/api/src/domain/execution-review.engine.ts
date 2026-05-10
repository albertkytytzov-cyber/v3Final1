import type {
  AssignedBlockExercise,
  AssignedPlanSummary,
  ExecutionExerciseResult,
  ExecutionMetricDeltaSet,
  ExecutionResult,
  ExecutionReviewExercise,
  ExecutionReviewPlan,
  ExecutionReviewStatus,
} from "@training-platform/shared";

function hasBlockActualData(result: ExecutionResult | undefined) {
  if (!result) {
    return false;
  }

  return (
    result.completed ||
    result.setsCompleted !== null ||
    result.repsCompleted !== null ||
    result.weightKg !== null ||
    result.durationMinutes !== null ||
    result.rpe !== null ||
    result.notes.trim().length > 0 ||
    Boolean(result.exerciseResults?.length)
  );
}

function hasExerciseActualData(result: ExecutionExerciseResult | undefined) {
  if (!result) {
    return false;
  }

  return (
    result.completed ||
    result.setsCompleted !== null ||
    result.repsCompleted !== null ||
    result.weightKg !== null ||
    result.durationMinutes !== null ||
    result.rpe !== null ||
    result.notes.trim().length > 0
  );
}

function isTrackablePlanRow(rowKind: AssignedPlanSummary["day"]["sessions"][number]["blocks"][number]["rowKind"]) {
  return rowKind !== "instruction" && rowKind !== "control" && rowKind !== "note";
}

export function getExecutionReviewStatus(
  result: ExecutionResult | ExecutionExerciseResult | undefined,
): ExecutionReviewStatus {
  if (!result) {
    return "not_started";
  }

  if (result.completed) {
    return "completed";
  }

  if (
    ("executionResultId" in result && hasExerciseActualData(result)) ||
    (!("executionResultId" in result) && hasBlockActualData(result))
  ) {
    return "partial";
  }

  return "missed";
}

function buildMetricDelta(planned: number | null, actual: number | null) {
  return {
    planned,
    actual,
    delta:
      planned !== null && actual !== null ? Number((actual - planned).toFixed(1)) : null,
  };
}

function buildDeviationSet(input: {
  targetSets: number | null;
  actualSets: number | null;
  targetReps: number | null;
  actualReps: number | null;
  targetDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  targetRpe: number | null;
  actualRpe: number | null;
}): ExecutionMetricDeltaSet {
  return {
    sets: buildMetricDelta(input.targetSets, input.actualSets),
    reps: buildMetricDelta(input.targetReps, input.actualReps),
    durationMinutes: buildMetricDelta(input.targetDurationMinutes, input.actualDurationMinutes),
    rpe: buildMetricDelta(input.targetRpe, input.actualRpe),
  };
}

function buildExerciseReview(
  exercise: AssignedBlockExercise,
  result: ExecutionExerciseResult | undefined,
): ExecutionReviewExercise {
  return {
    ...exercise,
    executionStatus: getExecutionReviewStatus(result),
    actualResult: result ?? null,
    deviations: buildDeviationSet({
      targetSets: exercise.targetSets,
      actualSets: result?.setsCompleted ?? null,
      targetReps: exercise.targetReps,
      actualReps: result?.repsCompleted ?? null,
      targetDurationMinutes: exercise.targetDurationMinutes,
      actualDurationMinutes: result?.durationMinutes ?? null,
      targetRpe: exercise.targetRpe,
      actualRpe: result?.rpe ?? null,
    }),
  };
}

function hasSignificantDeviation(deviations: ExecutionMetricDeltaSet) {
  return (
    Math.abs(deviations.sets.delta ?? 0) >= 2 ||
    Math.abs(deviations.reps.delta ?? 0) >= 4 ||
    Math.abs(deviations.durationMinutes.delta ?? 0) >= 10 ||
    Math.abs(deviations.rpe.delta ?? 0) >= 1.5
  );
}

export function buildExecutionReviewPlan(
  assignedPlan: AssignedPlanSummary,
  results: ExecutionResult[],
): ExecutionReviewPlan {
  const resultsByBlockId = new Map(results.map((result) => [result.assignedBlockId, result]));

  let plannedBlocks = 0;
  let completedBlocks = 0;
  let partialBlocks = 0;
  let missedBlocks = 0;
  let plannedExercises = 0;
  let completedExercises = 0;
  let partialExercises = 0;
  let missedExercises = 0;
  let totalDurationMinutes = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  let deviationAlerts = 0;

  const sessions = assignedPlan.day.sessions.map((session) => ({
    id: session.id,
    name: session.name,
    orderIndex: session.orderIndex,
    executionMode: session.executionMode,
    deviceLinkMode: session.deviceLinkMode,
    blocks: session.blocks.map((block) => {
      const trackableRow = isTrackablePlanRow(block.rowKind);
      const actualResult = resultsByBlockId.get(block.id);
      const executionStatus = getExecutionReviewStatus(actualResult);

      if (trackableRow) {
        plannedBlocks += 1;

        if (executionStatus === "completed") {
          completedBlocks += 1;
        } else if (executionStatus === "partial") {
          partialBlocks += 1;
        } else if (executionStatus === "missed") {
          missedBlocks += 1;
        }
      }

      if (actualResult?.durationMinutes) {
        totalDurationMinutes += actualResult.durationMinutes;
      }

      if (actualResult?.rpe !== null && actualResult?.rpe !== undefined) {
        rpeSum += actualResult.rpe;
        rpeCount += 1;
      }

      const exerciseResultsById = new Map(
        (actualResult?.exerciseResults ?? []).map((exerciseResult) => [
          exerciseResult.assignedExerciseId,
          exerciseResult,
        ]),
      );
      const reviewedExercises = (block.exercises ?? []).map((exercise) => {
        const reviewedExercise = buildExerciseReview(
          exercise,
          exerciseResultsById.get(exercise.id),
        );

        if (trackableRow) {
          plannedExercises += 1;
        }

        if (trackableRow) {
          if (reviewedExercise.executionStatus === "completed") {
            completedExercises += 1;
          } else if (reviewedExercise.executionStatus === "partial") {
            partialExercises += 1;
          } else if (reviewedExercise.executionStatus === "missed") {
            missedExercises += 1;
          }
        }

        if (trackableRow && hasSignificantDeviation(reviewedExercise.deviations)) {
          deviationAlerts += 1;
        }

        return reviewedExercise;
      });

      const deviations = buildDeviationSet({
        targetSets: block.targetSets,
        actualSets: actualResult?.setsCompleted ?? null,
        targetReps: block.targetReps,
        actualReps: actualResult?.repsCompleted ?? null,
        targetDurationMinutes: block.targetDurationMinutes,
        actualDurationMinutes: actualResult?.durationMinutes ?? null,
        targetRpe: block.targetRpe,
        actualRpe: actualResult?.rpe ?? null,
      });

      if (trackableRow && hasSignificantDeviation(deviations)) {
        deviationAlerts += 1;
      }

      return {
        ...block,
        executionStatus,
        planLabel: `${assignedPlan.templateName} / ${assignedPlan.day.label}`,
        actualResult: actualResult ?? null,
        exerciseSummary: {
          plannedExercises: reviewedExercises.length,
          completedExercises: reviewedExercises.filter(
            (item) => item.executionStatus === "completed",
          ).length,
          partialExercises: reviewedExercises.filter(
            (item) => item.executionStatus === "partial",
          ).length,
          missedExercises: reviewedExercises.filter(
            (item) => item.executionStatus === "missed",
          ).length,
        },
        deviations,
        exercises: reviewedExercises,
      };
    }),
  }));

  const reviewStatus =
    missedBlocks > 0 ||
    partialBlocks > 0 ||
    missedExercises > 0 ||
    partialExercises > 0
      ? "needs_attention"
      : deviationAlerts > 0
        ? "ready_for_review"
        : "all_good";

  return {
    assignedPlanId: assignedPlan.id,
    athleteId: assignedPlan.athleteId,
    athleteName: assignedPlan.athleteName,
    templateName: assignedPlan.templateName,
    dayLabel: assignedPlan.day.label,
    dayDate: assignedPlan.day.dayDate,
    summary: {
      plannedBlocks,
      completedBlocks,
      partialBlocks,
      missedBlocks,
      plannedExercises,
      completedExercises,
      partialExercises,
      missedExercises,
      completionRate: plannedBlocks
        ? Math.round((completedBlocks / plannedBlocks) * 100)
        : 0,
      averageRpe: rpeCount ? Number((rpeSum / rpeCount).toFixed(1)) : null,
      totalDurationMinutes,
      reviewStatus,
    },
    sessions,
  };
}
