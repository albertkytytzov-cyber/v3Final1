import type {
  ReadinessFormValues,
  ReadinessReason,
  ReadinessStatus,
} from "@training-platform/shared";
import type {
  BaselineProfile,
  ReadinessEngineInput,
  ReadinessEngineOutput,
} from "./readiness.types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scoreFivePointHigherIsBetter(value: number) {
  return clamp(((value - 1) / 4) * 100, 0, 100);
}

function scoreFivePointLowerIsBetter(value: number) {
  return clamp(((5 - value) / 4) * 100, 0, 100);
}

function scoreSleepHours(hours: number) {
  const diff = Math.abs(hours - 8);
  return clamp(100 - diff * 18, 0, 100);
}

function scorePainLevel(value: number) {
  return clamp(100 - value * 10, 0, 100);
}

function scoreRestingHr(restingHr: number, baseline: number | null) {
  if (!baseline) {
    return clamp(100 - Math.abs(restingHr - 55) * 4, 0, 100);
  }

  const diff = restingHr - baseline;
  return clamp(100 - Math.max(diff, 0) * 8 - Math.abs(Math.min(diff, 0)) * 2, 0, 100);
}

function scoreWeight(weight: number, baseline: number | null) {
  if (!baseline) {
    return 100;
  }

  const diffPercent = Math.abs(weight - baseline) / baseline;
  return clamp(100 - diffPercent * 1000, 40, 100);
}

function getReasons(
  values: ReadinessFormValues,
  baseline: BaselineProfile,
): ReadinessReason[] {
  const reasons: ReadinessReason[] = [];

  if (values.feverFlag) {
    reasons.push({ code: "fever", label: "Fever was reported", impact: -100 });
  }

  if (values.illnessFlag) {
    reasons.push({ code: "illness", label: "Illness symptoms were reported", impact: -35 });
  }

  if (values.sleepHours < 6) {
    reasons.push({ code: "sleep_hours", label: `Sleep dropped to ${values.sleepHours} hours`, impact: -20 });
  }

  if (values.sleepQuality <= 2) {
    reasons.push({ code: "sleep_quality", label: "Sleep quality is poor", impact: -15 });
  }

  if (values.fatigueLevel >= 4) {
    reasons.push({ code: "fatigue", label: `Fatigue is ${values.fatigueLevel}/5`, impact: -15 });
  }

  if (values.muscleSoreness >= 4) {
    reasons.push({ code: "soreness", label: `Muscle soreness is ${values.muscleSoreness}/5`, impact: -12 });
  }

  if (values.painLevel >= 7) {
    reasons.push({ code: "pain", label: `Pain level is ${values.painLevel}/10`, impact: -35 });
  }

  if (
    baseline.baselineRestingHr !== null &&
    values.restingHr >= baseline.baselineRestingHr + 10
  ) {
    reasons.push({
      code: "resting_hr",
      label: `Resting HR is ${values.restingHr - baseline.baselineRestingHr} bpm above baseline`,
      impact: -25,
    });
  }

  return reasons;
}

export function calculateReadiness(input: ReadinessEngineInput): ReadinessEngineOutput {
  const { values, baseline, competitionContext = null } = input;
  const weightedScore =
    scoreSleepHours(values.sleepHours) * 0.17 +
    scoreFivePointHigherIsBetter(values.sleepQuality) * 0.1 +
    scoreFivePointHigherIsBetter(values.generalFeeling) * 0.14 +
    scoreFivePointLowerIsBetter(values.fatigueLevel) * 0.12 +
    scoreFivePointLowerIsBetter(values.muscleSoreness) * 0.11 +
    scoreFivePointHigherIsBetter(values.motivationLevel) * 0.08 +
    scoreRestingHr(values.restingHr, baseline.baselineRestingHr) * 0.14 +
    scoreWeight(values.bodyWeight, baseline.baselineWeightKg) * 0.04 +
    scorePainLevel(values.painLevel) * 0.1;

  const reasons = getReasons(values, baseline);
  const hasRedOverride =
    values.feverFlag ||
    values.painLevel >= 7 ||
    (baseline.baselineRestingHr !== null &&
      values.restingHr >= baseline.baselineRestingHr + 10) ||
    (values.illnessFlag && values.generalFeeling <= 2) ||
    values.sleepHours < 4;

  const score = clamp(Math.round(weightedScore), 0, 100);
  let status: ReadinessStatus = "green";

  if (hasRedOverride || score < 60) {
    status = "red";
  } else if (score < 80) {
    status = "yellow";
  }

  let adjustedScore = score;
  let adjustedStatus = status;

  if (
    competitionContext?.phase === "taper" &&
    !hasRedOverride &&
    adjustedStatus === "red" &&
    adjustedScore >= 55 &&
    values.fatigueLevel <= 4 &&
    values.painLevel < 7
  ) {
    adjustedScore = clamp(adjustedScore + 4, 0, 100);
    adjustedStatus = "yellow";
    reasons.push({
      code: "competition_taper",
      label: "Taper phase softens penalties for moderate fatigue to protect competition sharpness",
      impact: 4,
    });
  }

  if (competitionContext?.phase === "recovery" && !hasRedOverride) {
    const recoveryBonus =
      (values.motivationLevel <= 2 ? 2 : 0) + (values.muscleSoreness >= 4 ? 2 : 0);

    if (recoveryBonus > 0) {
      adjustedScore = clamp(adjustedScore + recoveryBonus, 0, 100);
      adjustedStatus =
        adjustedScore < 60 ? "red" : adjustedScore < 80 ? "yellow" : "green";
      reasons.push({
        code: "competition_recovery",
        label: "Recovery phase tolerates low motivation and residual soreness more softly",
        impact: recoveryBonus,
      });
    }
  }

  if (competitionContext?.competitionPriority === "A") {
    reasons.push({
      code: "competition_priority_A",
      label: "A-priority competition context is active and readiness is interpreted conservatively",
      impact: 0,
    });
  }

  if (competitionContext?.phase) {
    reasons.push({
      code: "competition_phase",
      label: `Preparation phase: ${competitionContext.phase}`,
      impact: 0,
    });
  }

  return {
    score: adjustedScore,
    status: adjustedStatus,
    explanation: reasons,
  };
}
