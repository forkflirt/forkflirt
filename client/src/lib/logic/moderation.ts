import type { Profile } from "../schemas/validator";

// --- Configuration ---

const MINIMUM_OVERLAP = 3; // Profiles must share at least 3 questions to be scored

const POINTS: Record<string, number> = {
  mandatory: 250,
  very_important: 50,
  somewhat_important: 10,
  little_importance: 1,
  irrelevant: 0,
};

// --- Types ---

export interface MatchResult {
  percent: number; // 0 to 100
  overlap: number; // Number of common questions answered
  isDealbreaker: boolean; // True if a mandatory requirement was failed
  insufficientData: boolean; // True if overlap < MINIMUM_OVERLAP
}

interface SurveyMap {
  [questionId: string]: {
    answer: string;
    acceptable: Set<string>;
    importance: string;
  };
}

// --- Helpers ---

/**
 * Converts the array into a Map for O(1) lookups during comparison.
 */
function mapSurvey(profile: Profile): SurveyMap {
  const map: SurveyMap = {};
  if (!profile.survey) return map;

  for (const q of profile.survey) {
    map[q.question_id] = {
      answer: q.answer_choice,
      acceptable: new Set(q.acceptable_answers),
      importance: q.importance,
    };
  }
  return map;
}

/**
 * Calculates satisfaction score in one direction (Source judging Target).
 */
function calculateDirectionalScore(sourceMap: SurveyMap, targetMap: SurveyMap) {
  let pointsEarned = 0;
  let pointsPossible = 0;
  let dealbreakerFound = false;
  let overlappingQuestions = 0;

  // Iterate over questions the SOURCE cares about
  for (const [qId, sourceData] of Object.entries(sourceMap)) {
    const targetData = targetMap[qId];

    // If target hasn't answered this question, skip it
    if (!targetData) continue;

    overlappingQuestions++;

    const weight = POINTS[sourceData.importance] || 0;

    // Irrelevant questions don't affect the denominator
    if (weight === 0) continue;

    pointsPossible += weight;

    // Logic: Is target's answer in source's acceptable list?
    const isAcceptable = sourceData.acceptable.has(targetData.answer);

    if (isAcceptable) {
      pointsEarned += weight;
    } else {
      // It's a miss. Check if it was mandatory.
      if (sourceData.importance === "mandatory") {
        dealbreakerFound = true;
      }
    }
  }

  // Prevent divide by zero
  const rawScore = pointsPossible === 0 ? 0 : pointsEarned / pointsPossible;

  return {
    rawScore, // 0.0 to 1.0
    overlappingQuestions,
    dealbreakerFound,
  };
}

// --- Main Algorithm ---

export function calculateMatch(
  viewer: Profile,
  candidate: Profile
): MatchResult {
  const viewerMap = mapSurvey(viewer);
  const candidateMap = mapSurvey(candidate);

  // 1. Calculate A -> B
  const scoreA = calculateDirectionalScore(viewerMap, candidateMap);

  // 2. Calculate B -> A
  const scoreB = calculateDirectionalScore(candidateMap, viewerMap);

  // 3. Check Constraints

  // Use the lower overlap count of the two (should be identical, but safe to be conservative)
  const overlap = Math.min(
    scoreA.overlappingQuestions,
    scoreB.overlappingQuestions
  );

  if (overlap < MINIMUM_OVERLAP) {
    return {
      percent: 0,
      overlap,
      isDealbreaker: false,
      insufficientData: true,
    };
  }

  if (scoreA.dealbreakerFound || scoreB.dealbreakerFound) {
    return {
      percent: 0,
      overlap,
      isDealbreaker: true,
      insufficientData: false,
    };
  }

  // 4. Geometric Mean
  // Math.sqrt(SatisfationA * SatisfactionB)
  const geometricMean = Math.sqrt(scoreA.rawScore * scoreB.rawScore);

  // Round to integer percentage
  const percent = Math.floor(geometricMean * 100);

  return {
    percent,
    overlap,
    isDealbreaker: false,
    insufficientData: false,
  };
}
