import type { SyncActionKind, UserRole } from "./types/models.js";

export const ATHLETE_EXECUTION_REQUIRED_MESSAGE =
  "Только спортсмен может отправлять отметку выполнения тренировки.";
export const COACH_EXECUTION_READ_ONLY_MESSAGE =
  "Тренер может просматривать планы и результаты, но отправлять выполнение тренировки может только спортсмен.";
export const ADMIN_EXECUTION_READ_ONLY_MESSAGE =
  "Администратор может просматривать планы и результаты, но отправлять выполнение тренировки может только спортсмен.";
export const ATHLETE_READINESS_REQUIRED_MESSAGE =
  "Только спортсмен может отправлять данные готовности.";
export const COACH_COMPETITION_REQUIRED_MESSAGE =
  "Только тренер или администратор может сохранять результат соревнования.";
export const COACH_DIARY_REQUIRED_MESSAGE =
  "Только тренер или администратор может сохранять записи тренера.";

const API_ERROR_TRANSLATIONS: Record<string, string> = {
  "Only athlete accounts can submit execution tracking": ATHLETE_EXECUTION_REQUIRED_MESSAGE,
  "Only athlete accounts can view execution tracking":
    "Только спортсмен может просматривать отметки выполнения тренировки.",
  "Only athlete accounts can submit readiness": ATHLETE_READINESS_REQUIRED_MESSAGE,
  "Only athlete accounts have readiness entries":
    "Только спортсмен может просматривать данные готовности.",
  "Only athlete accounts can sync device health data": ATHLETE_READINESS_REQUIRED_MESSAGE,
  "Only athlete accounts can view device health data": ATHLETE_READINESS_REQUIRED_MESSAGE,
  "Only coach or admin accounts can save competition results": COACH_COMPETITION_REQUIRED_MESSAGE,
  "Only coach or admin accounts can view coach diary entries": COACH_DIARY_REQUIRED_MESSAGE,
  "Only coach or admin accounts can save coach diary entries": COACH_DIARY_REQUIRED_MESSAGE,
  "Only athlete accounts can view coach diary entries":
    "Только спортсмен может просматривать свои записи дневника.",
  "Diary notes are required": "Добавьте текст записи тренера.",
  "Diary task selection is required": "Выберите задания или переключите запись на весь день.",
  "Assigned plan was not found for this athlete": "План дня не найден для этого спортсмена.",
  "Assigned diary task was not found for this plan": "Выбранное задание не найдено в плане дня.",
  "Session expired or invalid": "Сессия истекла. Войдите снова.",
  "Athlete can only access their own competition context":
    "Спортсмен может просматривать только свои данные.",
  "Athlete is not assigned to this coach": "Спортсмен не назначен этому тренеру.",
  "competitionPlanId is required": "Выберите старт.",
  "Competition plan was not found": "План соревнования не найден.",
};

export function translateApiErrorMessage(message: string) {
  const trimmedMessage = message.trim();

  if (API_ERROR_TRANSLATIONS[trimmedMessage]) {
    return API_ERROR_TRANSLATIONS[trimmedMessage];
  }

  if (/^Only .+ accounts?/iu.test(trimmedMessage)) {
    return "Недостаточно прав для этого действия.";
  }

  if (/\b(required|must be|invalid)\b/iu.test(trimmedMessage)) {
    return "Проверьте заполненные поля.";
  }

  if (/\bnot found\b/iu.test(trimmedMessage)) {
    return "Данные не найдены.";
  }

  if (/[a-z]/iu.test(trimmedMessage) && !/[а-яё]/iu.test(trimmedMessage)) {
    return "Ошибка сервера. Повторите действие позже.";
  }

  return trimmedMessage;
}

export function canSubmitSyncAction(role: UserRole | null | undefined, kind: SyncActionKind) {
  if (
    kind === "readiness" ||
    kind === "execution" ||
    kind === "device-health" ||
    kind === "device-workouts"
  ) {
    return role === "athlete";
  }

  if (kind === "competition-result") {
    return role === "coach" || role === "admin";
  }

  if (kind === "coach-diary") {
    return role === "coach" || role === "admin";
  }

  return false;
}

export function getSyncActionRestrictionMessage(
  role: UserRole | null | undefined,
  kind: SyncActionKind,
) {
  if (kind === "execution") {
    if (role === "coach") {
      return COACH_EXECUTION_READ_ONLY_MESSAGE;
    }

    if (role === "admin") {
      return ADMIN_EXECUTION_READ_ONLY_MESSAGE;
    }

    return ATHLETE_EXECUTION_REQUIRED_MESSAGE;
  }

  if (kind === "readiness" || kind === "device-health" || kind === "device-workouts") {
    return ATHLETE_READINESS_REQUIRED_MESSAGE;
  }

  if (kind === "coach-diary") {
    return COACH_DIARY_REQUIRED_MESSAGE;
  }

  return COACH_COMPETITION_REQUIRED_MESSAGE;
}

export function isPermanentPermissionError(kind: SyncActionKind, message: string) {
  const translatedMessage = translateApiErrorMessage(message);

  if (kind === "execution") {
    return translatedMessage === ATHLETE_EXECUTION_REQUIRED_MESSAGE ||
      translatedMessage === COACH_EXECUTION_READ_ONLY_MESSAGE ||
      translatedMessage === ADMIN_EXECUTION_READ_ONLY_MESSAGE;
  }

  if (kind === "readiness" || kind === "device-health" || kind === "device-workouts") {
    return translatedMessage === ATHLETE_READINESS_REQUIRED_MESSAGE;
  }

  if (kind === "competition-result") {
    return translatedMessage === COACH_COMPETITION_REQUIRED_MESSAGE;
  }

  if (kind === "coach-diary") {
    return translatedMessage === COACH_DIARY_REQUIRED_MESSAGE;
  }

  return false;
}
