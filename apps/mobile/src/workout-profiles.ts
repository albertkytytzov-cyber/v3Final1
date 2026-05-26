export type DeviceWorkoutMetricKey =
  | "duration"
  | "calories"
  | "heartRate"
  | "distance"
  | "steps"
  | "pace"
  | "speed"
  | "gps"
  | "cadence"
  | "elevation"
  | "laps"
  | "strokes"
  | "swolf"
  | "jumps"
  | "strokeRate";

export type DeviceWorkoutMetricExpectation = "expected" | "optional" | "not-required";

export type DeviceWorkoutProfileId =
  | "generic"
  | "outdoor-locomotion"
  | "outdoor-distance"
  | "outdoor-variable"
  | "treadmill"
  | "outdoor-cycling"
  | "indoor-cycling"
  | "gym"
  | "field-sport"
  | "water-sport"
  | "winter-sport"
  | "swimming"
  | "rowing"
  | "jump-rope"
  | "elliptical"
  | "static";

export interface DeviceWorkoutProfile {
  id: DeviceWorkoutProfileId;
  label: string;
  requiredMetrics: readonly DeviceWorkoutMetricKey[];
  optionalMetrics: readonly DeviceWorkoutMetricKey[];
}

export type DeviceWorkoutMetricPresence = Partial<Record<DeviceWorkoutMetricKey, boolean>>;

const DEVICE_WORKOUT_PROFILES: Record<DeviceWorkoutProfileId, DeviceWorkoutProfile> = {
  generic: {
    id: "generic",
    label: "Device workout",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["distance", "steps", "pace", "speed", "gps", "cadence"],
  },
  "outdoor-locomotion": {
    id: "outdoor-locomotion",
    label: "Outdoor run/walk",
    requiredMetrics: ["duration", "distance", "steps", "calories", "heartRate"],
    optionalMetrics: ["pace", "speed", "gps", "cadence", "elevation"],
  },
  "outdoor-distance": {
    id: "outdoor-distance",
    label: "Outdoor distance sport",
    requiredMetrics: ["duration", "distance", "calories", "heartRate"],
    optionalMetrics: ["speed", "gps", "pace", "cadence", "elevation"],
  },
  "outdoor-variable": {
    id: "outdoor-variable",
    label: "Outdoor variable sport",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["distance", "steps", "pace", "speed", "gps", "cadence", "elevation"],
  },
  treadmill: {
    id: "treadmill",
    label: "Treadmill",
    requiredMetrics: ["duration", "distance", "steps", "calories", "heartRate"],
    optionalMetrics: ["pace", "speed", "cadence"],
  },
  "outdoor-cycling": {
    id: "outdoor-cycling",
    label: "Outdoor cycling",
    requiredMetrics: ["duration", "distance", "calories", "heartRate"],
    optionalMetrics: ["speed", "gps", "elevation", "cadence"],
  },
  "indoor-cycling": {
    id: "indoor-cycling",
    label: "Indoor cycling",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["speed", "cadence", "distance"],
  },
  gym: {
    id: "gym",
    label: "Gym / combat / conditioning",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["cadence"],
  },
  "field-sport": {
    id: "field-sport",
    label: "Field / game sport",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["distance", "steps", "gps", "speed"],
  },
  "water-sport": {
    id: "water-sport",
    label: "Water sport",
    requiredMetrics: ["duration", "calories"],
    optionalMetrics: ["distance", "heartRate", "gps", "strokes"],
  },
  "winter-sport": {
    id: "winter-sport",
    label: "Winter sport",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["distance", "speed", "gps", "elevation"],
  },
  swimming: {
    id: "swimming",
    label: "Swimming",
    requiredMetrics: ["duration", "distance", "calories"],
    optionalMetrics: ["heartRate", "laps", "strokes", "swolf"],
  },
  rowing: {
    id: "rowing",
    label: "Rowing",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["strokes", "strokeRate", "distance"],
  },
  "jump-rope": {
    id: "jump-rope",
    label: "Jump rope",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["jumps", "cadence"],
  },
  elliptical: {
    id: "elliptical",
    label: "Elliptical",
    requiredMetrics: ["duration", "calories", "heartRate"],
    optionalMetrics: ["steps", "cadence", "distance"],
  },
  static: {
    id: "static",
    label: "Static / leisure",
    requiredMetrics: ["duration"],
    optionalMetrics: ["calories", "heartRate"],
  },
};

const DEVICE_WORKOUT_TYPE_PROFILE_MAP: Record<string, DeviceWorkoutProfileId> = {
  athletics: "outdoor-variable",
  "outdoor-sport": "outdoor-variable",
  cycling: "outdoor-cycling",
  dance: "gym",
  "field-sport": "field-sport",
  hiking: "outdoor-variable",
  "indoor-cycling": "indoor-cycling",
  "jump-rope": "jump-rope",
  "open-water": "swimming",
  "open-water-swim": "swimming",
  "outdoor-cycling": "outdoor-cycling",
  "outdoor-run": "outdoor-locomotion",
  "outdoor-walk": "outdoor-locomotion",
  "pool-swim": "swimming",
  "pool-swimming": "swimming",
  running: "outdoor-locomotion",
  swimming: "swimming",
  treadmill: "treadmill",
  triathlon: "outdoor-distance",
  "water-polo": "water-sport",
  "water-sport": "water-sport",
  "winter-sport": "winter-sport",
  walking: "outdoor-locomotion",

  boxing: "gym",
  combat: "gym",
  conditioning: "gym",
  "functional-strength-training": "gym",
  freestyle: "gym",
  hiit: "gym",
  "high-intensity-interval-training": "gym",
  "martial-arts": "gym",
  pilates: "gym",
  strength: "gym",
  "traditional-strength-training": "gym",
  workout: "gym",
  wrestling: "gym",
  yoga: "gym",

  elliptical: "elliptical",
  rowing: "rowing",
  "rowing-machine": "rowing",

  chess: "static",
  esports: "static",
  leisure: "static",
  static: "static",
};

export function normalizeDeviceWorkoutType(workoutType: string | null | undefined) {
  return (workoutType ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

export function getDeviceWorkoutProfile(workoutType: string | null | undefined): DeviceWorkoutProfile {
  const normalizedType = normalizeDeviceWorkoutType(workoutType);

  if (!normalizedType || /^exercise-\d+$/i.test(normalizedType) || /^workout-\d+$/i.test(normalizedType)) {
    return DEVICE_WORKOUT_PROFILES.generic;
  }

  return DEVICE_WORKOUT_PROFILES[DEVICE_WORKOUT_TYPE_PROFILE_MAP[normalizedType] ?? "generic"];
}

export function getDeviceWorkoutMetricExpectation(
  workoutType: string | null | undefined,
  metric: DeviceWorkoutMetricKey,
): DeviceWorkoutMetricExpectation {
  const profile = getDeviceWorkoutProfile(workoutType);

  if (profile.requiredMetrics.includes(metric)) {
    return "expected";
  }

  if (profile.optionalMetrics.includes(metric)) {
    return "optional";
  }

  return "not-required";
}

export function isDeviceWorkoutMetricRelevant(
  workoutType: string | null | undefined,
  metric: DeviceWorkoutMetricKey,
) {
  return getDeviceWorkoutMetricExpectation(workoutType, metric) !== "not-required";
}

export function getMissingDeviceWorkoutMetrics(
  workoutType: string | null | undefined,
  presence: DeviceWorkoutMetricPresence,
) {
  return getDeviceWorkoutProfile(workoutType).requiredMetrics.filter((metric) => presence[metric] !== true);
}
