import {
  type AdaptedPlanBlock,
  type AssignedPlanSummary,
} from "@training-platform/shared";
import type {
  AdaptationEngineInput,
  AdaptationEngineOutput,
} from "./adaptation.types";

function shouldKeepOnRed(blockType: AdaptedPlanBlock["blockType"]) {
  return (
    blockType === "technical" ||
    blockType === "activation" ||
    blockType === "mobility" ||
    blockType === "recovery"
  );
}

function buildAction(
  action: AdaptedPlanBlock["action"],
  block: AssignedPlanSummary["day"]["sessions"][number]["blocks"][number],
  adaptationReason: string,
): AdaptedPlanBlock {
  return {
    ...block,
    action,
    adaptationReason,
  };
}

function isFatiguingBlock(blockType: AdaptedPlanBlock["blockType"]) {
  return (
    blockType === "strength" ||
    blockType === "speed" ||
    blockType === "CNS_high" ||
    blockType === "metabolic" ||
    blockType === "conditioning"
  );
}

export function adaptAssignedPlan(input: AdaptationEngineInput): AdaptationEngineOutput {
  const { assignedPlan, readiness, competitionContext = null } = input;
  const removedBlocks: string[] = [];
  const reducedBlocks: string[] = [];
  const replacedBlocks: string[] = [];
  const explanation: string[] = [];

  const sessions = assignedPlan.day.sessions.map((session) => {
    const blocks: AdaptedPlanBlock[] = session.blocks.flatMap((block) => {
      if (readiness.status === "green") {
        return [buildAction("kept", block, "Green day: keep planned structure.")];
      }

      const isTaper = competitionContext?.phase === "taper";
      const isRecoveryPhase = competitionContext?.phase === "recovery";
      const isPriorityA = competitionContext?.competitionPriority === "A";
      const closeToCompetition =
        competitionContext?.daysToCompetition !== null &&
        competitionContext?.daysToCompetition !== undefined &&
        competitionContext.daysToCompetition <= 3;
      const shouldProtectSpecificBlock =
        isTaper &&
        (block.blockType === "technical" ||
          block.blockType === "activation" ||
          block.blockType === "mobility");

      if (readiness.status === "yellow") {
        if (closeToCompetition && !isFatiguingBlock(block.blockType)) {
          return [
            buildAction(
              "kept",
              block,
              "Close to competition: keep activation, mobility, and technical blocks intact.",
            ),
          ];
        }

        if (shouldProtectSpecificBlock || (isPriorityA && block.isMandatory)) {
          reducedBlocks.push(block.name);
          explanation.push(
            `${block.name} was preserved with only light reduction because the competition context is protective.`,
          );
          return [
            buildAction(
              "reduced",
              block,
              "Competition context: preserve key specific work and reduce volume instead of removing it.",
            ),
          ];
        }

        if (!block.isMandatory && block.removePriorityYellow >= 4) {
          removedBlocks.push(block.name);
          explanation.push(
            `${block.name} was removed on yellow day because removePriorityYellow >= 4.`,
          );
          return [];
        }

        if (isFatiguingBlock(block.blockType)) {
          reducedBlocks.push(block.name);
          explanation.push(
            `${block.name} volume/intensity was reduced for a yellow readiness day.`,
          );
          return [
            buildAction(
              "reduced",
              block,
              `Yellow day: reduce load by ${block.reductionPercentYellow}% and keep technical intent.`,
            ),
          ];
        }

        return [
          buildAction(
            "kept",
            block,
            "Yellow day: keep technical or supportive work unchanged.",
          ),
        ];
      }

      if (readiness.status === "red") {
        if (isRecoveryPhase && isFatiguingBlock(block.blockType)) {
          if (block.isMandatory) {
            replacedBlocks.push(block.name);
            explanation.push(
              `${block.name} was replaced with recovery work because the athlete is in a recovery competition phase.`,
            );
            return [
              {
                ...block,
                name: `${block.name} -> recovery reset`,
                blockType: "recovery",
                action: "replaced",
                adaptationReason:
                  "Recovery phase: replace heavy mandatory work with mobility or recovery emphasis.",
              },
            ];
          }

          removedBlocks.push(block.name);
          explanation.push(
            `${block.name} was removed because recovery phase allows aggressive unloading of optional heavy work.`,
          );
          return [];
        }

        if (closeToCompetition && !isFatiguingBlock(block.blockType)) {
          reducedBlocks.push(block.name);
          explanation.push(
            `${block.name} stays because only fatiguing blocks should be changed in the final days before competition.`,
          );
          return [
            buildAction(
              "reduced",
              block,
              "Competition close-out: preserve low-fatigue activation and technical work.",
            ),
          ];
        }

        if (shouldKeepOnRed(block.blockType)) {
          reducedBlocks.push(block.name);
          explanation.push(`${block.name} stays because low-risk block types are preserved on red day.`);
          return [
            buildAction(
              "reduced",
              block,
              `Red day: keep only safe technical/recovery work and reduce by ${block.reductionPercentRed}%.`,
            ),
          ];
        }

        if (isTaper || isPriorityA) {
          if (!block.isMandatory) {
            reducedBlocks.push(block.name);
            explanation.push(
              `${block.name} was reduced instead of removed because taper/A-priority context prefers conservative volume reduction.`,
            );
            return [
              buildAction(
                "reduced",
                block,
                "Competition context: reduce optional load first and avoid deleting key structure.",
              ),
            ];
          }
        }

        if (block.isMandatory) {
          replacedBlocks.push(block.name);
          explanation.push(`${block.name} was replaced by safe low-load work on red day.`);
          return [
            {
              ...block,
              name: `${block.name} -> technical recovery alternative`,
              blockType: "recovery",
              action: "replaced",
              adaptationReason:
                "Red day: high-load mandatory block replaced with a safe technical or recovery alternative.",
            },
          ];
        }

        removedBlocks.push(block.name);
        explanation.push(`${block.name} was removed on red day because it is a high-load optional block.`);
        return [];
      }

      return [buildAction("kept", block, "No adaptation rule applied.")];
    });

    return {
      id: session.id,
      name: session.name,
      orderIndex: session.orderIndex,
      blocks,
    };
  });

  return {
    assignedPlanId: assignedPlan.id,
    athleteId: assignedPlan.athleteId,
    readinessStatus: readiness.status,
    readinessScore: readiness.score,
    dayLabel: assignedPlan.day.label,
    dayDate: assignedPlan.day.dayDate,
    sessions,
    removedBlocks,
    reducedBlocks,
    replacedBlocks,
    explanation,
    competitionContext,
  };
}
