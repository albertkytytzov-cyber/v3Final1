"use client";

import type { ConstructorDraft } from "@training-platform/shared";
import { constructorPreviewSessionsForDay } from "../../lib/constructor-matrix-ui";

type MatrixDraftReadOnlyViewProps = {
  draft: ConstructorDraft;
  phaseLabel: (phase: ConstructorDraft["plan"]["weeks"][number]["phase"]) => string;
  keyPrefix?: string;
  className?: string;
};

type ConstructorDraftBlock =
  ConstructorDraft["plan"]["weeks"][number]["days"][number]["blocks"][number];
type ConstructorDraftExercise = NonNullable<ConstructorDraftBlock["exercises"]>[number];

const TECHNICAL_NOTE_MARKERS = [
  "coachEditable=",
  "loadLocked=",
  "not medical advice",
  "reviewRequired=",
  "mode=",
  "source-verified",
  "safety:",
  "regressions:",
  "progressions:",
  "coach-editable prescription",
  "no medical threshold",
] as const;

function exerciseDetails(exercise: ConstructorDraftExercise) {
  return [
    exercise.targetSets ? `${exercise.targetSets} сер.` : "",
    exercise.targetReps ? `${exercise.targetReps} повт.` : "",
    exercise.targetDurationMinutes ? `${exercise.targetDurationMinutes} мин` : "",
    exercise.targetRpe ? `RPE ${exercise.targetRpe}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

function coachVisibleExerciseNotes(exercise: ConstructorDraftExercise) {
  return (exercise.notes ?? "")
    .split(" · ")
    .map((item) => item.trim())
    .filter((item) =>
      item && !TECHNICAL_NOTE_MARKERS.some((marker) => item.toLowerCase().includes(marker.toLowerCase())),
    )
    .slice(0, 3)
    .join(" · ");
}

function blockReviewNotes(block: ConstructorDraftBlock) {
  return [
    block.coachEditable ? "редактируется тренером" : "нагрузка зафиксирована",
    block.volumeLocked ? "нагрузка заблокирована" : "",
    block.riskFlags.length ? "есть risk flags" : "",
    block.evidenceRefs.length ? "есть evidence refs" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function blockTechnicalMetadata(block: ConstructorDraftBlock) {
  return [
    block.riskFlags.length ? `Risk flags: ${block.riskFlags.join(", ")}` : "",
    block.evidenceRefs.length ? `Evidence refs: ${block.evidenceRefs.slice(0, 6).join(", ")}` : "",
    block.localLoadZones.length ? `Load zones: ${block.localLoadZones.slice(0, 6).join(", ")}` : "",
  ].filter(Boolean);
}

export function MatrixDraftReadOnlyView({
  draft,
  phaseLabel,
  keyPrefix = "constructor-draft",
  className = "constructor-week-list",
}: MatrixDraftReadOnlyViewProps) {
  return (
    <div className={className}>
      {draft.plan.weeks.map((week) => (
        <article className="constructor-week-card" key={`${keyPrefix}-${week.weekNumber}-${week.title}`}>
          <div className="summary-topline">
            <strong>{week.title}</strong>
            <span>{phaseLabel(week.phase)}</span>
          </div>
          <p>{week.mainIntent}</p>
          <div className="constructor-day-list">
            {week.days.map((day) => (
              <div
                className="constructor-day-row"
                key={`${keyPrefix}-${week.weekNumber}-${day.dayLabel}-${day.dayIntent}`}
              >
                <div>
                  <strong>{day.dayLabel}</strong>
                  <span>{day.dayIntent}</span>
                </div>
                <small>{day.readinessGate}</small>
                {constructorPreviewSessionsForDay(day).map((session) => (
                  <div
                    className="constructor-session-preview"
                    key={`${keyPrefix}-${day.dayLabel}-${session.name}`}
                  >
                    <div className="summary-topline">
                      <strong>{session.name}</strong>
                      <span>{session.notes}</span>
                    </div>
                    <ul>
                      {session.blocks.map((block, blockIndex) => (
                        <li key={`${keyPrefix}-${day.dayLabel}-${session.name}-${block.name}-${blockIndex}`}>
                          <span>{block.name}</span>
                          <strong>{block.volume}</strong>
                          <small>{blockReviewNotes(block)}</small>
                          {block.exercises?.length ? (
                            <div className="matrix-coach-exercise-list">
                              {block.exercises.slice(0, 4).map((exercise) => {
                                const details = exerciseDetails(exercise);
                                const coachNotes = coachVisibleExerciseNotes(exercise);

                                return (
                                  <small key={`${keyPrefix}-${day.dayLabel}-${session.name}-${exercise.name}`}>
                                    {details ? `${exercise.name} (${details})` : exercise.name}
                                    {coachNotes ? ` — ${coachNotes}` : ""}
                                  </small>
                                );
                              })}
                            </div>
                          ) : null}
                          {blockTechnicalMetadata(block).length ? (
                            <details>
                              <summary>Проверка и доказательства</summary>
                              <div className="matrix-coach-exercise-list">
                                {blockTechnicalMetadata(block).map((item) => (
                                  <small key={`${keyPrefix}-${day.dayLabel}-${session.name}-${block.name}-${item}`}>
                                    {item}
                                  </small>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
