import {
  getDeviceWorkoutProfile,
  getMissingDeviceWorkoutMetrics,
} from "../workout-profiles.js";
import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthSamplePayload,
  DeviceHealthSleepSummary,
  DeviceHealthWorkoutSummary,
  DeviceWorkoutPayload,
  DeviceWorkoutSamplePayload,
  DeviceWorkoutsSyncPayload,
} from "../types/models.js";
import type { DirectWatchWeatherPayload } from "./watch-weather.js";

const DIRECT_WATCH_TIME_OFFSET_MINUTES = 0;
const DIRECT_WATCH_RAW_CACHE_KEY = "perform.mobile.directWatchRawCache";
const DIRECT_WATCH_RAW_CACHE_LIMIT = 6;

export interface DirectWatchAvailability {
  available?: boolean;
  bluetoothEnabled?: boolean;
  reason?: string | null;
  requiresLocationPermission?: boolean;
}

export interface DirectWatchPermissionResult {
  granted?: boolean;
  reason?: string | null;
}

export interface DirectWatchDevice {
  bondState?: "bonded" | "bonding" | "not-bonded" | "unknown" | null;
  bondStateCode?: number | null;
  deviceType?: "classic" | "dual" | "le" | "unknown" | null;
  deviceTypeCode?: number | null;
  id: string;
  isConnectable?: boolean | null;
  name?: string | null;
  rssi?: number | null;
  isLikelyWatch?: boolean;
  manufacturerData?: DirectWatchPayloadPreview[];
  serviceData?: DirectWatchPayloadPreview[];
  serviceUuids?: string[];
  txPowerLevel?: number | null;
}

export interface DirectWatchCharacteristic {
  uuid: string;
  name?: string | null;
  properties?: string[];
}

export interface DirectWatchStandardReading {
  error?: string | null;
  kind?: "battery" | "manufacturer" | "model" | "serial" | "firmware" | "hardware" | "software" | "body-sensor" | "unknown" | null;
  name?: string | null;
  numericValue?: number | null;
  rawHex?: string | null;
  serviceUuid?: string | null;
  status?: "read" | "not-readable" | "error" | string | null;
  textValue?: string | null;
  uuid: string;
}

export interface DirectWatchService {
  uuid: string;
  name?: string | null;
  characteristics?: DirectWatchCharacteristic[];
}

export interface DirectWatchInspection {
  bondState?: "bonded" | "bonding" | "not-bonded" | "unknown" | null;
  bondStateCode?: number | null;
  deviceId: string;
  deviceName?: string | null;
  deviceType?: "classic" | "dual" | "le" | "unknown" | null;
  deviceTypeCode?: number | null;
  canReadBatteryLevel?: boolean;
  canReadDeviceInfo?: boolean;
  canSubscribeHeartRate?: boolean;
  hasBatteryService?: boolean;
  hasDeviceInfoService?: boolean;
  hasHeartRateService?: boolean;
  inspectedAt?: string | null;
  proprietaryServiceCount?: number;
  serviceCount?: number;
  services?: DirectWatchService[];
  standardReadings?: DirectWatchStandardReading[];
  unknownServiceCount?: number;
}

export interface DirectWatchPairingResult {
  bondState?: "bonded" | "bonding" | "not-bonded" | "unknown" | null;
  bondStateCode?: number | null;
  deviceId: string;
  deviceName?: string | null;
  pairedAt?: string | null;
  pairingStarted?: boolean;
  status?: "already-bonded" | "bonded" | "not-bonded" | "not-started" | "timeout" | string | null;
}

export interface DirectWatchSubscribedCharacteristic {
  error?: string | null;
  name?: string | null;
  properties?: string[];
  serviceUuid?: string | null;
  status?: "subscribed" | "no-cccd" | "error" | string | null;
  uuid: string;
}

export interface DirectWatchSessionPacket {
  byteLength?: number | null;
  characteristicUuid?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  name?: string | null;
  packetIndex?: number | null;
  rawHex?: string | null;
  receivedAt?: string | null;
  serviceUuid?: string | null;
}

export interface DirectWatchActivityFile {
  detailType?: number | null;
  idHex?: string | null;
  kind?: string | null;
  subtype?: number | null;
  timestamp?: string | null;
  timezone?: number | null;
  type?: number | null;
  version?: number | null;
}

export interface DirectWatchDecryptedPacket {
  activityChunkNumber?: number | null;
  activityChunkPayloadBytes?: number | null;
  activityChunkTotal?: number | null;
  activityFile?: DirectWatchActivityFile | null;
  activityFileCount?: number | null;
  activityFileCrcValid?: boolean | null;
  activityFileIdsHex?: string | null;
  activityFileKind?: string | null;
  activityFilePadding?: number | null;
  activityFileParsed?: boolean | null;
  activityFilePayloadBytes?: number | null;
  activityFileRawHex?: string | null;
  activityFiles?: DirectWatchActivityFile[];
  activitySamples?: DirectWatchActivitySample[];
  activityCalories?: number | null;
  activityHeartRateAvg?: number | null;
  activityHeartRateMax?: number | null;
  activityHeartRateMin?: number | null;
  activityHeartRateResting?: number | null;
  activitySampleCount?: number | null;
  activitySpo2Avg?: number | null;
  activitySpo2Max?: number | null;
  activitySpo2Min?: number | null;
  activitySteps?: number | null;
  activityStressAvg?: number | null;
  activityStressMax?: number | null;
  activityStressMin?: number | null;
  activityTrainingLoadDay?: number | null;
  activityTrainingLoadWeek?: number | null;
  activityVitality?: number | null;
  activityWorkoutDistanceMeters?: number | null;
  activityWorkoutDurationMinutes?: number | null;
  activityWorkoutEndTime?: string | null;
  activityWorkoutAltitudeAvgMeters?: number | null;
  activityWorkoutAltitudeMaxMeters?: number | null;
  activityWorkoutAltitudeMinMeters?: number | null;
  activityWorkoutCadenceAvg?: number | null;
  activityWorkoutCadenceMax?: number | null;
  activityWorkoutElevationGainMeters?: number | null;
  activityWorkoutElevationLossMeters?: number | null;
  activityWorkoutHeartRateZoneAerobicSeconds?: number | null;
  activityWorkoutHeartRateZoneAnaerobicSeconds?: number | null;
  activityWorkoutHeartRateZoneExtremeSeconds?: number | null;
  activityWorkoutHeartRateZoneFatBurnSeconds?: number | null;
  activityWorkoutHeartRateZoneWarmUpSeconds?: number | null;
  activityWorkoutJumpRateAvg?: number | null;
  activityWorkoutJumpRateMax?: number | null;
  activityWorkoutJumps?: number | null;
  activityWorkoutLaps?: number | null;
  activityWorkoutLoad?: number | null;
  activityWorkoutPaceAvgSecondsPerKm?: number | null;
  activityWorkoutPaceMaxSecondsPerKm?: number | null;
  activityWorkoutPaceMinSecondsPerKm?: number | null;
  activityWorkoutRecoveryTimeHours?: number | null;
  activityWorkoutGpsSampleCount?: number | null;
  activityWorkoutGpsSamples?: DirectWatchWorkoutGpsSample[];
  activityWorkoutSpeedAvgKmh?: number | null;
  activityWorkoutSpeedMaxKmh?: number | null;
  activityWorkoutStartTime?: string | null;
  activityWorkoutSteps?: number | null;
  activityWorkoutStepLengthAvgCm?: number | null;
  activityWorkoutStepRateAvg?: number | null;
  activityWorkoutStepRateMax?: number | null;
  activityWorkoutStrokeRateAvg?: number | null;
  activityWorkoutStrokes?: number | null;
  activityWorkoutSwimStyle?: number | null;
  activityWorkoutSwolfAvg?: number | null;
  activityWorkoutTrainingEffectAerobic?: number | null;
  activityWorkoutTrainingEffectAnaerobic?: number | null;
  activityWorkoutType?: string | null;
  activityWorkoutTypeCode?: number | null;
  activityWorkoutVitalityGain?: number | null;
  activityWorkoutVo2Max?: number | null;
  batteryLevel?: number | null;
  batteryState?: number | null;
  byteLength?: number | null;
  calories?: number | null;
  channel?: string | null;
  commandStatus?: number | null;
  commandSubtype?: number | null;
  commandType?: number | null;
  deviceModel?: string | null;
  firmware?: string | null;
  heartRate?: number | null;
  heartRateDisabled?: boolean | null;
  heartRateInterval?: number | null;
  isCharging?: boolean | null;
  isUserAsleep?: boolean | null;
  isWorn?: boolean | null;
  label?: string | null;
  rawHex?: string | null;
  sequenceNumber?: number | null;
  serialNumber?: string | null;
  sleepAwakeMinutes?: number | null;
  sleepDeepMinutes?: number | null;
  sleepDurationMinutes?: number | null;
  sleepEndTime?: string | null;
  sleepIsAwake?: boolean | null;
  sleepLightMinutes?: number | null;
  sleepRemMinutes?: number | null;
  sleepScore?: number | null;
  sleepStageCount?: number | null;
  sleepStartTime?: string | null;
  steps?: number | null;
}

export interface DirectWatchActivitySample {
  heartRate?: number | null;
  sampleTime?: string | null;
  spo2?: number | null;
  steps?: number | null;
  stress?: number | null;
}

export interface DirectWatchWorkoutGpsSample {
  distanceMeters?: number | null;
  hdop?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sampleTime?: string | null;
  speedMetersPerSecond?: number | null;
}

export interface DirectWatchSessionStatus {
  connected?: boolean;
  deviceId?: string | null;
  deviceName?: string | null;
  lastPacket?: DirectWatchSessionPacket | null;
  packetCount?: number;
  packets?: DirectWatchSessionPacket[];
  serviceCount?: number;
  startedAt?: string | null;
  subscribed?: DirectWatchSubscribedCharacteristic[];
  subscribedCount?: number;
  updatedAt?: string | null;
}

export interface DirectWatchClassicProbe {
  activityFileProbeCompletedCount?: number | null;
  activityFileProbeCount?: number | null;
  activityFileProbeFailedCount?: number | null;
  activityFileProbeRequests?: DirectWatchActivityFileProbeRequest[];
  activityFileAckCount?: number | null;
  activityFileAckIds?: string[];
  authStage?: "watch-nonce" | "auth-response" | string | null;
  authKeyError?: string | null;
  authKeyStatus?: "not-provided" | "valid" | "invalid" | "invalid-format" | "no-watch-nonce" | string | null;
  authStatus?: number | null;
  authSubtype?: number | null;
  bondState?: "bonded" | "bonding" | "not-bonded" | "unknown" | null;
  bondStateCode?: number | null;
  connected?: boolean;
  decryptedPackets?: DirectWatchDecryptedPacket[];
  detectedProtocol?: "spp-v1" | "spp-v2" | "unknown" | string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  error?: string | null;
  packetCount?: number;
  packetType?: string | null;
  packets?: DirectWatchSessionPacket[];
  probedAt?: string | null;
  rawHex?: string | null;
  phoneNonceHex?: string | null;
  sentAuthStep1?: boolean;
  sentAuthStep2?: boolean;
  sentActivityFileProbe?: boolean;
  sentActivityFileAck?: boolean;
  sentPostAuthProbe?: boolean;
  sentSessionConfig?: boolean;
  sentVersionRequest?: boolean;
  versionHex?: string | null;
  watchHmacHex?: string | null;
  watchNonceHex?: string | null;
}

export interface DirectWatchActivityFileProbeRequest {
  activityFile?: DirectWatchActivityFile | null;
  chunkNumber?: number | null;
  chunkTotal?: number | null;
  crcValid?: boolean | null;
  detailType?: number | null;
  durationMs?: number | null;
  error?: string | null;
  idHex?: string | null;
  kind?: string | null;
  payloadBytes?: number | null;
  parsed?: boolean | null;
  sequenceNumber?: number | null;
  status?: string | null;
  subtype?: number | null;
  timestamp?: string | null;
  type?: number | null;
  version?: number | null;
}

export interface DirectWatchActivityInventory {
  entryDates: string[];
  fileCount: number;
  files: DirectWatchActivityFile[];
  probe: DirectWatchClassicProbe;
}

export interface DirectWatchDailySyncPayload {
  ackFileIds: string[];
  rawCacheId?: string | null;
  summary: DeviceHealthDailySummaryPayload;
  workouts: DeviceWorkoutsSyncPayload;
}

export type DirectWatchRawCacheStatus = "captured" | "queued" | "submitted" | "acked" | "ack-error";

export interface DirectWatchRawCacheFile {
  crcValid?: boolean | null;
  detailType?: number | null;
  idHex: string;
  kind?: string | null;
  parsed?: boolean | null;
  payloadBytes?: number | null;
  rawHex?: string | null;
  sampleCount?: number | null;
  subtype?: number | null;
  timestamp?: string | null;
  type?: number | null;
  version?: number | null;
}

export interface DirectWatchRawCacheEntry {
  ackedAt?: string | null;
  ackError?: string | null;
  ackFileIds: string[];
  capturedAt: string;
  deviceId: string;
  deviceName?: string | null;
  entryDate: string;
  files: DirectWatchRawCacheFile[];
  id: string;
  status: DirectWatchRawCacheStatus;
  submittedAt?: string | null;
  summary: {
    fileCount: number;
    heartRateSampleCount: number;
    oxygenSampleCount: number;
    sleepMinutes: number | null;
    workoutCount: number;
    workoutSampleCount: number;
  };
}

export interface DirectWatchServiceSyncResult extends DirectWatchClassicProbe {
  sentServiceSync?: boolean;
  sentTime?: boolean;
  sentPhoneLocation?: boolean;
  sentWeatherCurrent?: boolean;
  sentWeatherDaily?: boolean;
  sentWeatherHourly?: boolean;
  sentWeatherLocation?: boolean;
  sentWeatherLocationsRead?: boolean;
  sentWeatherLocationsOrder?: boolean;
  sentWeatherPrefsRead?: boolean;
  sentWeatherPrefs?: boolean;
  bridgeUntil?: string | null;
  keepAliveMs?: number | null;
  keptBluetoothBridge?: boolean;
  serviceCommands?: string[];
  syncedAt?: string | null;
}

export interface DirectWatchSyncServiceStatus {
  backgroundSync?: DirectWatchBackgroundSyncStatus | null;
  bridgeUntil?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  message?: string | null;
  running?: boolean;
  updatedAt?: string | null;
}

export interface DirectWatchBackgroundSyncStatus {
  available?: boolean;
  deviceId?: string | null;
  entryDate?: string | null;
  message?: string | null;
  reason?: string | null;
  updatedAt?: string | null;
}

export interface DirectWatchBackgroundSyncResult extends DirectWatchServiceSyncResult {
  available?: boolean;
  backgroundAvailable?: boolean;
  backgroundDeviceId?: string | null;
  backgroundEntryDate?: string | null;
  backgroundReason?: string | null;
  backgroundSavedAt?: string | null;
}

export interface DirectWatchSyncCoordinatorRequest {
  blockedReason?: string | null;
  createdAt?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  entryDate?: string | null;
  force?: boolean;
  id?: string | null;
  reason?: string | null;
  requested?: boolean;
  source?: string | null;
}

export interface DirectWatchSyncCoordinatorStatus {
  configured?: boolean;
  deviceId?: string | null;
  deviceName?: string | null;
  enabled?: boolean;
  failureBackoffMs?: number | null;
  hasAuthKey?: boolean;
  hasWeatherPayload?: boolean;
  intervalMs?: number | null;
  lastBlockedReason?: string | null;
  lastCompletedAt?: string | null;
  lastEventAt?: string | null;
  lastHandledAt?: string | null;
  lastOutcome?: string | null;
  lastReason?: string | null;
  lastRequestedAt?: string | null;
  lastSuccessfulAt?: string | null;
  nextAllowedAt?: string | null;
  nextAllowedReason?: string | null;
  pendingAgeMs?: number | null;
  pendingCreatedAt?: string | null;
  pendingEntryDate?: string | null;
  pendingReason?: string | null;
  pendingRequestId?: string | null;
  pendingTtlMs?: number | null;
  retryAfterMs?: number | null;
}

export interface DirectWatchPayloadPreview {
  byteLength?: number | null;
  companyId?: number | null;
  previewHex?: string | null;
  uuid?: string | null;
}

export interface DirectWatchScanResult {
  devices: DirectWatchDevice[];
  scannedAt?: string | null;
}

interface DirectWatchPlugin {
  addListener?: (
    eventName: "directWatchPacket" | "directWatchSession" | "directWatchSyncRequested",
    listenerFunc: (event: unknown) => void,
  ) => Promise<DirectWatchListenerHandle> | DirectWatchListenerHandle;
  configureSyncCoordinator?: (input: {
    authKeyHex?: string | null;
    deviceId?: string | null;
    deviceName?: string | null;
    enabled?: boolean;
    weather?: DirectWatchWeatherPayload | null;
  }) => Promise<DirectWatchSyncCoordinatorStatus>;
  getSessionStatus?: () => Promise<DirectWatchSessionStatus>;
  getSyncCoordinatorStatus?: () => Promise<DirectWatchSyncCoordinatorStatus>;
  inspectDevice?: (input: { deviceId: string }) => Promise<DirectWatchInspection>;
  isAvailable?: () => Promise<DirectWatchAvailability>;
  markSyncRequestHandled?: (input: {
    outcome?: string;
    requestId?: string | null;
  }) => Promise<DirectWatchSyncCoordinatorStatus>;
  notifyAppVisible?: () => Promise<DirectWatchSyncCoordinatorStatus>;
  pairDevice?: (input: { deviceId: string }) => Promise<DirectWatchPairingResult>;
  ackActivityFiles?: (input: {
    authKeyHex: string;
    deviceId: string;
    fileIds: string[];
  }) => Promise<DirectWatchClassicProbe>;
  probeClassicSession?: (input: {
    authKeyHex?: string;
    authStep1?: boolean;
    deviceId: string;
    entryDate?: string;
    includeHistory?: boolean;
    includeSleep?: boolean;
    postAuthProbe?: boolean;
  }) => Promise<DirectWatchClassicProbe>;
  requestAuthorization?: () => Promise<DirectWatchPermissionResult>;
  requestCoordinatorSync?: (input: {
    force?: boolean;
    reason?: string;
  }) => Promise<DirectWatchSyncCoordinatorRequest>;
  scanDevices?: (input?: { durationMs?: number }) => Promise<DirectWatchScanResult>;
  startSession?: (input: { deviceId: string }) => Promise<DirectWatchSessionStatus>;
  stopSession?: () => Promise<DirectWatchSessionStatus>;
  getSyncServiceStatus?: () => Promise<DirectWatchSyncServiceStatus>;
  getBackgroundSyncResult?: () => Promise<DirectWatchBackgroundSyncResult | DirectWatchBackgroundSyncStatus>;
  clearBackgroundSyncResult?: () => Promise<DirectWatchBackgroundSyncStatus>;
  stopSyncService?: () => Promise<DirectWatchSyncServiceStatus>;
  syncService?: (input: {
    authKeyHex: string;
    deviceId: string;
    entryDate?: string;
    fetchActivity?: boolean;
    includeHistory?: boolean;
    includeSleep?: boolean;
    keepAliveMs?: number;
    timeOffsetMinutes?: number;
    weather?: DirectWatchWeatherPayload;
  }) => Promise<DirectWatchServiceSyncResult>;
  unpairDevice?: (input: { deviceId: string }) => Promise<DirectWatchPairingResult>;
}

export interface DirectWatchListenerHandle {
  remove: () => Promise<void> | void;
}

type CapacitorWithDirectWatch = {
  Capacitor?: {
    Plugins?: {
      DirectWatch?: DirectWatchPlugin;
    };
  };
};

export async function scanDirectWatchDevices(): Promise<DirectWatchScanResult> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.scanDevices) {
    throw new Error("Прямое подключение часов доступно только в Android-сборке PERFORM.");
  }

  if (plugin.isAvailable) {
    const availability = await plugin.isAvailable();
    if (!availability.available) {
      throw new Error(availability.reason || "Bluetooth LE недоступен на этом телефоне.");
    }
    if (!availability.bluetoothEnabled) {
      throw new Error("Включите Bluetooth на телефоне и повторите поиск часов.");
    }
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM поиск и подключение Bluetooth-устройств.");
    }
  }

  const result = await plugin.scanDevices({ durationMs: 6000 });
  return {
    devices: Array.isArray(result.devices) ? result.devices.map(normalizeDirectWatchDevice) : [],
    scannedAt: normalizeString(result.scannedAt),
  };
}

export function isDirectWatchRuntime() {
  const capacitor = (globalThis as CapacitorWithDirectWatch).Capacitor;
  return capacitor?.Plugins?.DirectWatch !== undefined;
}

export async function inspectDirectWatchDevice(deviceId: string): Promise<DirectWatchInspection> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.inspectDevice) {
    throw new Error("Проверка сервисов часов доступна только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const inspection = await plugin.inspectDevice({ deviceId });
  return normalizeDirectWatchInspection(inspection);
}

export async function pairDirectWatchDevice(deviceId: string): Promise<DirectWatchPairingResult> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.pairDevice) {
    throw new Error("Системное сопряжение часов доступно только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const pairing = await plugin.pairDevice({ deviceId });
  return normalizeDirectWatchPairing(pairing);
}

export async function unpairDirectWatchDevice(deviceId: string): Promise<DirectWatchPairingResult> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.unpairDevice) {
    throw new Error("Сброс системного сопряжения часов доступен только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const pairing = await plugin.unpairDevice({ deviceId });
  return normalizeDirectWatchPairing(pairing);
}

export async function startDirectWatchSession(deviceId: string): Promise<DirectWatchSessionStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.startSession) {
    throw new Error("PERFORM Sync-сессия доступна только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const status = await plugin.startSession({ deviceId });
  return normalizeDirectWatchSessionStatus(status);
}

export async function stopDirectWatchSession(): Promise<DirectWatchSessionStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.stopSession) {
    throw new Error("PERFORM Sync-сессия доступна только в Android-сборке PERFORM.");
  }

  const status = await plugin.stopSession();
  return normalizeDirectWatchSessionStatus(status);
}

export async function getDirectWatchSessionStatus(): Promise<DirectWatchSessionStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.getSessionStatus) {
    return { connected: false, packets: [], subscribed: [] };
  }

  const status = await plugin.getSessionStatus();
  return normalizeDirectWatchSessionStatus(status);
}

export async function getDirectWatchSyncServiceStatus(): Promise<DirectWatchSyncServiceStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.getSyncServiceStatus) {
    return { running: false };
  }

  const status = await plugin.getSyncServiceStatus();
  return normalizeDirectWatchSyncServiceStatus(status);
}

export async function getDirectWatchBackgroundSyncResult(): Promise<DirectWatchBackgroundSyncResult | null> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.getBackgroundSyncResult) {
    return null;
  }

  const result = await plugin.getBackgroundSyncResult();
  if (!isRecord(result) || result.available === false) {
    return null;
  }

  return normalizeDirectWatchBackgroundSyncResult(result);
}

export async function clearDirectWatchBackgroundSyncResult(): Promise<DirectWatchBackgroundSyncStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.clearBackgroundSyncResult) {
    return { available: false };
  }

  return normalizeDirectWatchBackgroundSyncStatus(await plugin.clearBackgroundSyncResult());
}

export async function stopDirectWatchSyncService(): Promise<DirectWatchSyncServiceStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.stopSyncService) {
    throw new Error("Служебный режим часов доступен только в Android-сборке PERFORM.");
  }

  const status = await plugin.stopSyncService();
  return normalizeDirectWatchSyncServiceStatus(status);
}

export async function configureDirectWatchSyncCoordinator(input: {
  authKeyHex?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  enabled?: boolean;
  weather?: DirectWatchWeatherPayload | null;
}): Promise<DirectWatchSyncCoordinatorStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.configureSyncCoordinator) {
    return { configured: false, enabled: false };
  }

  const status = await plugin.configureSyncCoordinator(input);
  return normalizeDirectWatchSyncCoordinatorStatus(status);
}

export async function getDirectWatchSyncCoordinatorStatus(): Promise<DirectWatchSyncCoordinatorStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.getSyncCoordinatorStatus) {
    return { configured: false, enabled: false };
  }

  const status = await plugin.getSyncCoordinatorStatus();
  return normalizeDirectWatchSyncCoordinatorStatus(status);
}

export async function notifyDirectWatchAppVisible(): Promise<DirectWatchSyncCoordinatorStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.notifyAppVisible) {
    return { configured: false, enabled: false };
  }

  const status = await plugin.notifyAppVisible();
  return normalizeDirectWatchSyncCoordinatorStatus(status);
}

export async function requestDirectWatchCoordinatorSync(
  reason: string,
  force = false,
): Promise<DirectWatchSyncCoordinatorRequest> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.requestCoordinatorSync) {
    return { requested: false, reason, blockedReason: "not-supported" };
  }

  const request = await plugin.requestCoordinatorSync({ force, reason });
  return normalizeDirectWatchSyncCoordinatorRequest(request);
}

export async function markDirectWatchSyncRequestHandled(
  requestId?: string | null,
  outcome = "handled",
): Promise<DirectWatchSyncCoordinatorStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.markSyncRequestHandled) {
    return { configured: false, enabled: false };
  }

  const status = await plugin.markSyncRequestHandled({ outcome, requestId });
  return normalizeDirectWatchSyncCoordinatorStatus(status);
}

export async function probeDirectWatchClassicSession(
  deviceId: string,
  authStep1 = false,
  authKeyHex?: string,
  postAuthProbe = false,
  entryDate?: string,
  includeHistory = true,
  includeSleep = true,
): Promise<DirectWatchClassicProbe> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.probeClassicSession) {
    throw new Error("Classic/SPP-диагностика доступна только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const probe = await plugin.probeClassicSession({
    authKeyHex,
    authStep1,
    deviceId,
    entryDate,
    includeHistory,
    includeSleep,
    postAuthProbe,
  });
  return normalizeDirectWatchClassicProbe(probe);
}

export async function ackDirectWatchActivityFiles(
  deviceId: string,
  authKeyHex: string,
  fileIds: string[],
): Promise<DirectWatchClassicProbe> {
  const plugin = getDirectWatchPlugin();
  const normalizedFileIds = Array.from(new Set(fileIds.map((fileId) => fileId.trim()).filter(Boolean)));

  if (!normalizedFileIds.length) {
    return {
      activityFileAckCount: 0,
      activityFileAckIds: [],
      sentActivityFileAck: false,
    };
  }

  if (!plugin?.ackActivityFiles) {
    throw new Error("Подтверждение файлов часов доступно только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const result = await plugin.ackActivityFiles({
    authKeyHex,
    deviceId,
    fileIds: normalizedFileIds,
  });
  return normalizeDirectWatchClassicProbe(result);
}

export async function readDirectWatchActivityInventory(
  deviceId: string,
  authKeyHex: string,
): Promise<DirectWatchActivityInventory> {
  const probe = await probeDirectWatchClassicSession(deviceId, true, authKeyHex, true, formatLocalDateValue(new Date()), true);
  const files = collectDirectWatchActivityFiles(probe);
  const entryDates = collectDirectWatchInventoryEntryDates(files);

  return {
    entryDates,
    fileCount: files.length,
    files,
    probe,
  };
}

export async function syncDirectWatchService(
  deviceId: string,
  authKeyHex: string,
  weather?: DirectWatchWeatherPayload | null,
  keepAliveMs?: number,
  options: {
    entryDate?: string;
    fetchActivity?: boolean;
    includeHistory?: boolean;
    includeSleep?: boolean;
  } = {},
): Promise<DirectWatchServiceSyncResult> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.syncService) {
    throw new Error("Служебная синхронизация часов доступна только в Android-сборке PERFORM.");
  }

  if (plugin.requestAuthorization) {
    const authorization = await plugin.requestAuthorization();
    if (!authorization.granted) {
      throw new Error(authorization.reason || "Нужно разрешить PERFORM подключение к Bluetooth-устройствам.");
    }
  }

  const result = await plugin.syncService({
    authKeyHex,
    deviceId,
    ...(options.entryDate ? { entryDate: options.entryDate } : {}),
    ...(options.fetchActivity ? { fetchActivity: true } : {}),
    ...(options.includeHistory !== undefined ? { includeHistory: options.includeHistory } : {}),
    ...(options.includeSleep !== undefined ? { includeSleep: options.includeSleep } : {}),
    ...(keepAliveMs ? { keepAliveMs } : {}),
    timeOffsetMinutes: DIRECT_WATCH_TIME_OFFSET_MINUTES,
    ...(weather ? { weather } : {}),
  });
  return normalizeDirectWatchServiceSyncResult(result);
}

export async function readDirectWatchDailySummary(
  entryDate: string,
  deviceId: string,
  authKeyHex: string,
): Promise<DeviceHealthDailySummaryPayload> {
  const result = await readDirectWatchDailySync(entryDate, deviceId, authKeyHex);
  return result.summary;
}

export async function readDirectWatchDeviceWorkouts(
  entryDate: string,
  deviceId: string,
  authKeyHex: string,
): Promise<DeviceWorkoutsSyncPayload> {
  const result = await readDirectWatchDailySync(entryDate, deviceId, authKeyHex);
  return result.workouts;
}

export async function readDirectWatchDailySync(
  entryDate: string,
  deviceId: string,
  authKeyHex: string,
  options: { includeHistory?: boolean; includeSleep?: boolean } = {},
): Promise<DirectWatchDailySyncPayload> {
  const includeHistory = options.includeHistory ?? true;
  const includeSleep = options.includeSleep ?? true;
  const probe = await probeDirectWatchClassicSession(
    deviceId,
    true,
    authKeyHex,
    true,
    entryDate,
    includeHistory,
    includeSleep,
  );

  const payload = buildDirectWatchDailySyncPayload(entryDate, probe);
  const rawCacheId = saveDirectWatchRawSyncCache(entryDate, deviceId, probe, payload);
  return attachDirectWatchRawCacheId(payload, rawCacheId);
}

export function buildDirectWatchDailySyncPayloadFromProbe(
  entryDate: string,
  deviceId: string,
  probe: DirectWatchClassicProbe,
): DirectWatchDailySyncPayload {
  const payload = buildDirectWatchDailySyncPayload(entryDate, probe);
  const rawCacheId = saveDirectWatchRawSyncCache(entryDate, deviceId, probe, payload);
  return attachDirectWatchRawCacheId(payload, rawCacheId);
}

function buildDirectWatchDailySyncPayload(
  entryDate: string,
  probe: DirectWatchClassicProbe,
): DirectWatchDailySyncPayload {
  if (probe.authKeyStatus !== "valid") {
    throw new Error(formatDirectWatchAuthFailure(probe));
  }
  if (!probe.sentActivityFileProbe) {
    throw new Error("За выбранный день часы не отдали отдельные файлы активности.");
  }

  const packets = dedupeDirectWatchActivityPackets(
    (probe.decryptedPackets ?? [])
      .filter(hasDirectWatchActivityFile)
      .filter(isCompleteDirectWatchActivityPacket),
  );
  const activityPackets = packets.filter((packet) =>
    getDirectWatchActivityEntryDate(packet.activityFile) === entryDate ||
      hasDirectWatchSampleForEntryDate(packet, entryDate),
  );
  const sleepPackets = packets.filter((packet) =>
    getDirectWatchSleepEntryDate(packet) === entryDate,
  );
  const dayPackets = mergeDirectWatchPackets(activityPackets, sleepPackets);

  if (!dayPackets.length) {
    throw new Error("Часы подключились, но за выбранный день не отдали файлы активности.");
  }

  const dailySummary = pickLatestDirectWatchPacket(activityPackets, (packet) =>
    packet.activityFile?.type === 0 &&
    packet.activityFile.subtype === 0 &&
    packet.activityFile.detailType === 1,
  );
  const detailAggregate = aggregateDirectWatchMinuteDetails(activityPackets, entryDate);
  const heartRate = buildDirectWatchHeartRateSummary(dailySummary, detailAggregate);
  const oxygenSaturation = buildDirectWatchOxygenSummary(dailySummary, detailAggregate);
  const sleep = buildDirectWatchSleepSummary(sleepPackets);
  const samples = buildDirectWatchSamples(dayPackets, entryDate);
  const workouts = buildDirectWatchDeviceWorkouts(entryDate, probe, activityPackets);
  const workoutSummary = buildDirectWatchWorkoutSummary(workouts.workouts);

  if (!sleep && !heartRate && !oxygenSaturation && !dailySummary && !workoutSummary) {
    throw new Error("PERFORM Sync прочитал день, но пока не нашёл сон, пульс, SpO2 или итоговые показатели.");
  }

  return {
    ackFileIds: collectDirectWatchAckFileIds(probe, dayPackets),
    summary: {
      entryDate,
      provider: "direct-watch",
      sourceDevice: probe.deviceName || "Redmi Watch / PERFORM Sync",
      sleep,
      heartRate,
      oxygenSaturation,
      workout: workoutSummary,
      samples,
      rawPayload: buildDirectWatchRawPayload(probe, dayPackets, dailySummary, detailAggregate, workouts.workouts),
      syncedAt: new Date().toISOString(),
    },
    workouts,
  };
}

function formatDirectWatchAuthFailure(probe: DirectWatchClassicProbe) {
  if (probe.authKeyStatus === "no-watch-nonce" && probe.error) {
    return probe.error;
  }

  return probe.authKeyError || probe.error || "PERFORM Sync не смог авторизоваться на часах.";
}

function dedupeDirectWatchActivityPackets(packets: DirectWatchDecryptedPacket[]) {
  const dedupedPackets: DirectWatchDecryptedPacket[] = [];
  const packetsByFileId = new Map<string, { index: number; score: number }>();

  packets.forEach((packet) => {
    const fileId = normalizeString(packet.activityFile?.idHex)?.toUpperCase();
    if (!fileId) {
      dedupedPackets.push(packet);
      return;
    }

    const score = scoreDirectWatchActivityPacket(packet);
    const existing = packetsByFileId.get(fileId);
    if (!existing) {
      packetsByFileId.set(fileId, { index: dedupedPackets.length, score });
      dedupedPackets.push(packet);
      return;
    }

    if (score >= existing.score) {
      dedupedPackets[existing.index] = packet;
      packetsByFileId.set(fileId, { ...existing, score });
    }
  });

  return dedupedPackets;
}

function isCompleteDirectWatchActivityPacket(packet: DirectWatchDecryptedPacket) {
  return packet.activityFileCrcValid === true;
}

function scoreDirectWatchActivityPacket(packet: DirectWatchDecryptedPacket) {
  const rawHexLength = normalizeString(packet.activityFileRawHex)?.length ?? 0;
  const sampleCount = Math.max(
    packet.activitySampleCount ?? 0,
    packet.activitySamples?.length ?? 0,
    packet.activityWorkoutGpsSampleCount ?? 0,
    packet.activityWorkoutGpsSamples?.length ?? 0,
  );
  const summaryScore = [
    packet.activityWorkoutStartTime,
    packet.activityWorkoutEndTime,
    packet.activityWorkoutDurationMinutes,
    packet.activityWorkoutDistanceMeters,
    packet.activityWorkoutSteps,
    packet.activityWorkoutType,
    packet.activityCalories,
    packet.activityHeartRateAvg,
    packet.activitySpo2Avg,
    packet.activityStressAvg,
  ].filter((value) => value !== null && value !== undefined && value !== "").length;
  const isCompleteChunk =
    typeof packet.activityChunkTotal === "number" &&
    packet.activityChunkNumber === packet.activityChunkTotal;

  return (
    (packet.activityFileCrcValid === true ? 1_000_000 : 0) +
    (isCompleteChunk ? 100_000 : 0) +
    summaryScore * 10_000 +
    sampleCount * 100 +
    (packet.activityFilePayloadBytes ?? 0) +
    rawHexLength
  );
}

function attachDirectWatchRawCacheId(
  payload: DirectWatchDailySyncPayload,
  rawCacheId: string | null,
): DirectWatchDailySyncPayload {
  if (!rawCacheId) {
    return payload;
  }

  return {
    ...payload,
    rawCacheId,
    summary: {
      ...payload.summary,
      rawPayload: {
        ...(payload.summary.rawPayload ?? {}),
        directWatchRawCacheId: rawCacheId,
      },
    },
    workouts: {
      ...payload.workouts,
      workouts: payload.workouts.workouts.map((workout) => ({
        ...workout,
        rawPayload: {
          ...(workout.rawPayload ?? {}),
          directWatchRawCacheId: rawCacheId,
        },
      })),
    },
  };
}

function saveDirectWatchRawSyncCache(
  entryDate: string,
  deviceId: string,
  probe: DirectWatchClassicProbe,
  payload: DirectWatchDailySyncPayload,
) {
  const packets = (probe.decryptedPackets ?? []).filter(hasDirectWatchActivityFile);
  const dayPackets = packets.filter((packet) =>
    getDirectWatchActivityEntryDate(packet.activityFile) === entryDate ||
      hasDirectWatchSampleForEntryDate(packet, entryDate) ||
      getDirectWatchSleepEntryDate(packet) === entryDate,
  );
  const files = collectDirectWatchRawCacheFiles(dayPackets);
  if (!files.length) {
    return null;
  }

  const cacheId = createDirectWatchRawCacheId(entryDate, deviceId, files);
  const entry: DirectWatchRawCacheEntry = {
    ackedAt: null,
    ackError: null,
    ackFileIds: collectDirectWatchAckFileIds(probe, dayPackets),
    capturedAt: new Date().toISOString(),
    deviceId,
    deviceName: probe.deviceName ?? null,
    entryDate,
    files,
    id: cacheId,
    status: "captured",
    submittedAt: null,
    summary: {
      fileCount: files.length,
      heartRateSampleCount: payload.summary.samples?.filter((sample) => sample.metric === "heart_rate").length ?? 0,
      oxygenSampleCount: payload.summary.samples?.filter((sample) => sample.metric === "oxygen_saturation").length ?? 0,
      sleepMinutes: payload.summary.sleep?.durationMinutes ?? null,
      workoutCount: payload.workouts.workouts.length,
      workoutSampleCount: payload.workouts.workouts.reduce((total, workout) => total + workout.samples.length, 0),
    },
  };

  upsertDirectWatchRawCacheEntry(entry);
  return cacheId;
}

function collectDirectWatchRawCacheFiles(dayPackets: DirectWatchDecryptedPacket[]) {
  const seen = new Set<string>();
  const files: DirectWatchRawCacheFile[] = [];

  for (const packet of dayPackets) {
    const idHex = packet.activityFile?.idHex?.trim();
    if (!idHex || seen.has(idHex)) {
      continue;
    }
    seen.add(idHex);

    files.push({
      crcValid: packet.activityFileCrcValid ?? null,
      detailType: packet.activityFile?.detailType ?? null,
      idHex,
      kind: packet.activityFileKind ?? packet.activityFile?.kind ?? null,
      parsed: packet.activityFileParsed ?? null,
      payloadBytes: packet.activityFilePayloadBytes ?? null,
      rawHex: packet.activityFileRawHex ?? null,
      sampleCount: packet.activitySampleCount ?? null,
      subtype: packet.activityFile?.subtype ?? null,
      timestamp: packet.activityFile?.timestamp ?? null,
      type: packet.activityFile?.type ?? null,
      version: packet.activityFile?.version ?? null,
    });
  }

  return files;
}

function createDirectWatchRawCacheId(
  entryDate: string,
  deviceId: string,
  files: DirectWatchRawCacheFile[],
) {
  const filePart = files.map((file) => file.idHex).sort().join("-");
  return `direct-watch:${entryDate}:${deviceId}:${filePart}`;
}

export function loadDirectWatchRawCacheEntries(): DirectWatchRawCacheEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(DIRECT_WATCH_RAW_CACHE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const entries = JSON.parse(rawValue) as DirectWatchRawCacheEntry[];
    return Array.isArray(entries)
      ? entries.filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      : [];
  } catch {
    return [];
  }
}

export function markDirectWatchRawCacheQueued(cacheId: string | null | undefined) {
  updateDirectWatchRawCacheEntry(cacheId, {
    status: "queued",
  });
}

export function markDirectWatchRawCacheSubmitted(cacheId: string | null | undefined) {
  updateDirectWatchRawCacheEntry(cacheId, {
    status: "submitted",
    submittedAt: new Date().toISOString(),
  });
}

export function markDirectWatchRawCacheAcked(
  cacheId: string | null | undefined,
  ackFileIds: string[],
) {
  updateDirectWatchRawCacheEntry(cacheId, {
    ackedAt: new Date().toISOString(),
    ackError: null,
    ackFileIds: Array.from(new Set(ackFileIds.map((fileId) => fileId.trim()).filter(Boolean))),
    status: "acked",
  });
}

export function markDirectWatchRawCacheAckError(
  cacheId: string | null | undefined,
  error: unknown,
) {
  updateDirectWatchRawCacheEntry(cacheId, {
    ackError: error instanceof Error ? error.message : typeof error === "string" ? error : "ACK не выполнен.",
    status: "ack-error",
  });
}

function upsertDirectWatchRawCacheEntry(entry: DirectWatchRawCacheEntry) {
  const entries = loadDirectWatchRawCacheEntries();
  const previous = entries.find((item) => item.id === entry.id);
  const nextEntry: DirectWatchRawCacheEntry = previous
    ? {
        ...entry,
        ackedAt: previous.ackedAt,
        ackError: previous.ackError,
        capturedAt: previous.capturedAt,
        status: previous.status === "acked" ||
          previous.status === "submitted" ||
          previous.status === "queued" ||
          previous.status === "ack-error"
          ? previous.status
          : entry.status,
        submittedAt: previous.submittedAt,
      }
    : entry;
  writeDirectWatchRawCacheEntries([
    nextEntry,
    ...entries.filter((item) => item.id !== entry.id),
  ].slice(0, DIRECT_WATCH_RAW_CACHE_LIMIT));
}

function updateDirectWatchRawCacheEntry(
  cacheId: string | null | undefined,
  patch: Partial<DirectWatchRawCacheEntry>,
) {
  if (!cacheId) {
    return;
  }

  const entries = loadDirectWatchRawCacheEntries();
  const nextEntries = entries.map((entry) =>
    entry.id === cacheId
      ? {
          ...entry,
          ...patch,
        }
      : entry,
  );
  writeDirectWatchRawCacheEntries(nextEntries);
}

function writeDirectWatchRawCacheEntries(entries: DirectWatchRawCacheEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEntries = entries.slice(0, DIRECT_WATCH_RAW_CACHE_LIMIT);
  try {
    window.localStorage.setItem(DIRECT_WATCH_RAW_CACHE_KEY, JSON.stringify(normalizedEntries));
    return;
  } catch {
    // Fall through to a compact metadata-only fallback below.
  }

  const compactEntries = normalizedEntries.map((entry) => ({
    ...entry,
    files: entry.files.map((file) => ({
      ...file,
      rawHex: file.rawHex && file.rawHex.length <= 2048 ? file.rawHex : null,
    })),
  }));

  try {
    window.localStorage.setItem(DIRECT_WATCH_RAW_CACHE_KEY, JSON.stringify(compactEntries));
  } catch {
    window.localStorage.removeItem(DIRECT_WATCH_RAW_CACHE_KEY);
  }
}

function collectDirectWatchAckFileIds(
  probe: DirectWatchClassicProbe,
  _dayPackets: DirectWatchDecryptedPacket[],
): string[] {
  const fileIds = new Set<string>();

  for (const request of probe.activityFileProbeRequests ?? []) {
    const fileId = request.idHex?.trim();
    if (request.status === "complete" && request.crcValid === true && request.parsed === true && fileId) {
      fileIds.add(fileId);
    }
  }

  return Array.from(fileIds);
}

export async function addDirectWatchPacketListener(
  callback: (packet: DirectWatchSessionPacket) => void,
): Promise<DirectWatchListenerHandle | null> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.addListener) {
    return null;
  }

  const handle = await Promise.resolve(
    plugin.addListener("directWatchPacket", (event) => {
      callback(normalizeDirectWatchSessionPacket(event));
    }),
  );
  return handle ?? null;
}

export async function addDirectWatchSessionListener(
  callback: (status: DirectWatchSessionStatus) => void,
): Promise<DirectWatchListenerHandle | null> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.addListener) {
    return null;
  }

  const handle = await Promise.resolve(
    plugin.addListener("directWatchSession", (event) => {
      callback(normalizeDirectWatchSessionStatus(event));
    }),
  );
  return handle ?? null;
}

export async function addDirectWatchSyncRequestListener(
  callback: (request: DirectWatchSyncCoordinatorRequest) => void,
): Promise<DirectWatchListenerHandle | null> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.addListener) {
    return null;
  }

  const handle = await Promise.resolve(
    plugin.addListener("directWatchSyncRequested", (event) => {
      callback(normalizeDirectWatchSyncCoordinatorRequest(event));
    }),
  );
  return handle ?? null;
}

function getDirectWatchPlugin() {
  return (globalThis as CapacitorWithDirectWatch).Capacitor?.Plugins?.DirectWatch ?? null;
}

function normalizeDirectWatchDevice(value: unknown): DirectWatchDevice {
  if (!isRecord(value)) {
    return { id: "" };
  }

  return {
    bondState: normalizeBluetoothState(value.bondState),
    bondStateCode: normalizeNumber(value.bondStateCode),
    deviceType: normalizeDeviceType(value.deviceType),
    deviceTypeCode: normalizeNumber(value.deviceTypeCode),
    id: normalizeString(value.id) ?? "",
    isConnectable: normalizeNullableBoolean(value.isConnectable),
    isLikelyWatch: typeof value.isLikelyWatch === "boolean" ? value.isLikelyWatch : false,
    manufacturerData: Array.isArray(value.manufacturerData)
      ? value.manufacturerData.map(normalizePayloadPreview)
      : [],
    name: normalizeString(value.name),
    rssi: normalizeNumber(value.rssi),
    serviceData: Array.isArray(value.serviceData)
      ? value.serviceData.map(normalizePayloadPreview)
      : [],
    serviceUuids: Array.isArray(value.serviceUuids)
      ? value.serviceUuids.map((uuid) => normalizeString(uuid)).filter((uuid): uuid is string => Boolean(uuid))
      : [],
    txPowerLevel: normalizeNumber(value.txPowerLevel),
  };
}

function normalizeDirectWatchInspection(value: unknown): DirectWatchInspection {
  if (!isRecord(value)) {
    return { deviceId: "" };
  }

  return {
    bondState: normalizeBluetoothState(value.bondState),
    bondStateCode: normalizeNumber(value.bondStateCode),
    canReadBatteryLevel: normalizeBoolean(value.canReadBatteryLevel),
    canReadDeviceInfo: normalizeBoolean(value.canReadDeviceInfo),
    canSubscribeHeartRate: normalizeBoolean(value.canSubscribeHeartRate),
    deviceId: normalizeString(value.deviceId) ?? "",
    deviceName: normalizeString(value.deviceName),
    deviceType: normalizeDeviceType(value.deviceType),
    deviceTypeCode: normalizeNumber(value.deviceTypeCode),
    hasBatteryService: normalizeBoolean(value.hasBatteryService),
    hasDeviceInfoService: normalizeBoolean(value.hasDeviceInfoService),
    hasHeartRateService: normalizeBoolean(value.hasHeartRateService),
    inspectedAt: normalizeString(value.inspectedAt),
    proprietaryServiceCount: normalizeNumber(value.proprietaryServiceCount) ?? 0,
    serviceCount: normalizeNumber(value.serviceCount) ?? 0,
    services: Array.isArray(value.services)
      ? value.services.map(normalizeDirectWatchService)
      : [],
    standardReadings: Array.isArray(value.standardReadings)
      ? value.standardReadings.map(normalizeDirectWatchStandardReading)
      : [],
    unknownServiceCount: normalizeNumber(value.unknownServiceCount) ?? 0,
  };
}

function normalizeDirectWatchPairing(value: unknown): DirectWatchPairingResult {
  if (!isRecord(value)) {
    return { deviceId: "" };
  }

  return {
    bondState: normalizeBluetoothState(value.bondState),
    bondStateCode: normalizeNumber(value.bondStateCode),
    deviceId: normalizeString(value.deviceId) ?? "",
    deviceName: normalizeString(value.deviceName),
    pairedAt: normalizeString(value.pairedAt),
    pairingStarted: normalizeNullableBoolean(value.pairingStarted) ?? false,
    status: normalizeString(value.status),
  };
}

function normalizeDirectWatchSessionStatus(value: unknown): DirectWatchSessionStatus {
  if (!isRecord(value)) {
    return { connected: false, packets: [], subscribed: [] };
  }

  return {
    connected: normalizeBoolean(value.connected),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    lastPacket: isRecord(value.lastPacket)
      ? normalizeDirectWatchSessionPacket(value.lastPacket)
      : null,
    packetCount: normalizeNumber(value.packetCount) ?? 0,
    packets: Array.isArray(value.packets)
      ? value.packets.map(normalizeDirectWatchSessionPacket)
      : [],
    serviceCount: normalizeNumber(value.serviceCount) ?? 0,
    startedAt: normalizeString(value.startedAt),
    subscribed: Array.isArray(value.subscribed)
      ? value.subscribed.map(normalizeDirectWatchSubscribedCharacteristic)
      : [],
    subscribedCount: normalizeNumber(value.subscribedCount) ?? 0,
    updatedAt: normalizeString(value.updatedAt),
  };
}

function normalizeDirectWatchClassicProbe(value: unknown): DirectWatchClassicProbe {
  if (!isRecord(value)) {
    return {};
  }

  return {
    authStage: normalizeString(value.authStage),
    authKeyError: normalizeString(value.authKeyError),
    authKeyStatus: normalizeString(value.authKeyStatus),
    activityFileProbeCompletedCount: normalizeNumber(value.activityFileProbeCompletedCount),
    activityFileProbeCount: normalizeNumber(value.activityFileProbeCount),
    activityFileProbeFailedCount: normalizeNumber(value.activityFileProbeFailedCount),
    activityFileProbeRequests: Array.isArray(value.activityFileProbeRequests)
      ? value.activityFileProbeRequests.map(normalizeDirectWatchActivityFileProbeRequest)
      : [],
    activityFileAckCount: normalizeNumber(value.activityFileAckCount),
    activityFileAckIds: Array.isArray(value.activityFileAckIds)
      ? value.activityFileAckIds.map((fileId) => normalizeString(fileId)).filter((fileId): fileId is string => Boolean(fileId))
      : [],
    authStatus: normalizeNumber(value.authStatus),
    authSubtype: normalizeNumber(value.authSubtype),
    bondState: normalizeBluetoothState(value.bondState),
    bondStateCode: normalizeNumber(value.bondStateCode),
    connected: normalizeBoolean(value.connected),
    decryptedPackets: Array.isArray(value.decryptedPackets)
      ? value.decryptedPackets.map(normalizeDirectWatchDecryptedPacket)
      : [],
    detectedProtocol: normalizeString(value.detectedProtocol),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    error: normalizeString(value.error),
    packetCount: normalizeNumber(value.packetCount) ?? 0,
    packetType: normalizeString(value.packetType),
    packets: Array.isArray(value.packets)
      ? value.packets.map(normalizeDirectWatchSessionPacket)
      : [],
    probedAt: normalizeString(value.probedAt),
    rawHex: normalizeString(value.rawHex),
    phoneNonceHex: normalizeString(value.phoneNonceHex),
    sentAuthStep1: normalizeBoolean(value.sentAuthStep1),
    sentAuthStep2: normalizeBoolean(value.sentAuthStep2),
    sentActivityFileProbe: normalizeBoolean(value.sentActivityFileProbe),
    sentActivityFileAck: normalizeBoolean(value.sentActivityFileAck),
    sentPostAuthProbe: normalizeBoolean(value.sentPostAuthProbe),
    sentSessionConfig: normalizeBoolean(value.sentSessionConfig),
    sentVersionRequest: normalizeBoolean(value.sentVersionRequest),
    versionHex: normalizeString(value.versionHex),
    watchHmacHex: normalizeString(value.watchHmacHex),
    watchNonceHex: normalizeString(value.watchNonceHex),
  };
}

function normalizeDirectWatchServiceSyncResult(value: unknown): DirectWatchServiceSyncResult {
  const base = normalizeDirectWatchClassicProbe(value);
  if (!isRecord(value)) {
    return base;
  }

  return {
    ...base,
    sentServiceSync: normalizeBoolean(value.sentServiceSync),
    sentTime: normalizeBoolean(value.sentTime),
    sentPhoneLocation: normalizeBoolean(value.sentPhoneLocation),
    sentWeatherCurrent: normalizeBoolean(value.sentWeatherCurrent),
    sentWeatherDaily: normalizeBoolean(value.sentWeatherDaily),
    sentWeatherHourly: normalizeBoolean(value.sentWeatherHourly),
    sentWeatherLocation: normalizeBoolean(value.sentWeatherLocation),
    sentWeatherLocationsRead: normalizeBoolean(value.sentWeatherLocationsRead),
    sentWeatherLocationsOrder: normalizeBoolean(value.sentWeatherLocationsOrder),
    sentWeatherPrefsRead: normalizeBoolean(value.sentWeatherPrefsRead),
    sentWeatherPrefs: normalizeBoolean(value.sentWeatherPrefs),
    bridgeUntil: normalizeString(value.bridgeUntil),
    keepAliveMs: normalizeNumber(value.keepAliveMs),
    keptBluetoothBridge: normalizeBoolean(value.keptBluetoothBridge),
    serviceCommands: Array.isArray(value.serviceCommands)
      ? value.serviceCommands.map((item) => normalizeString(item)).filter((item): item is string => Boolean(item))
      : [],
    syncedAt: normalizeString(value.syncedAt),
  };
}

function normalizeDirectWatchBackgroundSyncResult(value: unknown): DirectWatchBackgroundSyncResult {
  const base = normalizeDirectWatchServiceSyncResult(value);
  if (!isRecord(value)) {
    return base;
  }

  return {
    ...base,
    available: normalizeBoolean(value.available),
    backgroundAvailable: normalizeBoolean(value.backgroundAvailable),
    backgroundDeviceId: normalizeString(value.backgroundDeviceId),
    backgroundEntryDate: normalizeString(value.backgroundEntryDate),
    backgroundReason: normalizeString(value.backgroundReason),
    backgroundSavedAt: normalizeString(value.backgroundSavedAt),
  };
}

function normalizeDirectWatchBackgroundSyncStatus(value: unknown): DirectWatchBackgroundSyncStatus {
  if (!isRecord(value)) {
    return { available: false };
  }

  return {
    available: normalizeBoolean(value.available),
    deviceId: normalizeString(value.deviceId),
    entryDate: normalizeString(value.entryDate),
    message: normalizeString(value.message),
    reason: normalizeString(value.reason),
    updatedAt: normalizeString(value.updatedAt),
  };
}

function normalizeDirectWatchSyncServiceStatus(value: unknown): DirectWatchSyncServiceStatus {
  if (!isRecord(value)) {
    return { running: false };
  }

  return {
    backgroundSync: normalizeDirectWatchBackgroundSyncStatus(value.backgroundSync),
    bridgeUntil: normalizeString(value.bridgeUntil),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    message: normalizeString(value.message),
    running: Boolean(value.running),
    updatedAt: normalizeString(value.updatedAt),
  };
}

function normalizeDirectWatchSyncCoordinatorRequest(value: unknown): DirectWatchSyncCoordinatorRequest {
  if (!isRecord(value)) {
    return { requested: false };
  }

  return {
    blockedReason: normalizeString(value.blockedReason),
    createdAt: normalizeString(value.createdAt),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    entryDate: normalizeString(value.entryDate),
    force: normalizeBoolean(value.force),
    id: normalizeString(value.id),
    reason: normalizeString(value.reason),
    requested: normalizeBoolean(value.requested),
    source: normalizeString(value.source),
  };
}

function normalizeDirectWatchSyncCoordinatorStatus(value: unknown): DirectWatchSyncCoordinatorStatus {
  if (!isRecord(value)) {
    return { configured: false, enabled: false };
  }

  return {
    configured: normalizeBoolean(value.configured),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    enabled: normalizeBoolean(value.enabled),
    failureBackoffMs: normalizeNumber(value.failureBackoffMs),
    hasAuthKey: normalizeBoolean(value.hasAuthKey),
    hasWeatherPayload: normalizeBoolean(value.hasWeatherPayload),
    intervalMs: normalizeNumber(value.intervalMs),
    lastBlockedReason: normalizeString(value.lastBlockedReason),
    lastCompletedAt: normalizeString(value.lastCompletedAt),
    lastEventAt: normalizeString(value.lastEventAt),
    lastHandledAt: normalizeString(value.lastHandledAt),
    lastOutcome: normalizeString(value.lastOutcome),
    lastReason: normalizeString(value.lastReason),
    lastRequestedAt: normalizeString(value.lastRequestedAt),
    lastSuccessfulAt: normalizeString(value.lastSuccessfulAt),
    nextAllowedAt: normalizeString(value.nextAllowedAt),
    nextAllowedReason: normalizeString(value.nextAllowedReason),
    pendingAgeMs: normalizeNumber(value.pendingAgeMs),
    pendingCreatedAt: normalizeString(value.pendingCreatedAt),
    pendingEntryDate: normalizeString(value.pendingEntryDate),
    pendingReason: normalizeString(value.pendingReason),
    pendingRequestId: normalizeString(value.pendingRequestId),
    pendingTtlMs: normalizeNumber(value.pendingTtlMs),
    retryAfterMs: normalizeNumber(value.retryAfterMs),
  };
}

function normalizeDirectWatchDecryptedPacket(value: unknown): DirectWatchDecryptedPacket {
  if (!isRecord(value)) {
    return {};
  }

  return {
    activityChunkNumber: normalizeNumber(value.activityChunkNumber),
    activityChunkPayloadBytes: normalizeNumber(value.activityChunkPayloadBytes),
    activityChunkTotal: normalizeNumber(value.activityChunkTotal),
    activityFile: isRecord(value.activityFile) ? normalizeDirectWatchActivityFile(value.activityFile) : null,
    activityFileCount: normalizeNumber(value.activityFileCount),
    activityFileCrcValid: normalizeBoolean(value.activityFileCrcValid),
    activityFileIdsHex: normalizeString(value.activityFileIdsHex),
    activityFileKind: normalizeString(value.activityFileKind),
    activityFilePadding: normalizeNumber(value.activityFilePadding),
    activityFileParsed: normalizeNullableBoolean(value.activityFileParsed),
    activityFilePayloadBytes: normalizeNumber(value.activityFilePayloadBytes),
    activityFileRawHex: normalizeString(value.activityFileRawHex),
    activityFiles: Array.isArray(value.activityFiles)
      ? value.activityFiles.map(normalizeDirectWatchActivityFile)
      : [],
    activitySamples: Array.isArray(value.activitySamples)
      ? value.activitySamples.map(normalizeDirectWatchActivitySample)
      : [],
    activityCalories: normalizeNumber(value.activityCalories),
    activityHeartRateAvg: normalizeNumber(value.activityHeartRateAvg),
    activityHeartRateMax: normalizeNumber(value.activityHeartRateMax),
    activityHeartRateMin: normalizeNumber(value.activityHeartRateMin),
    activityHeartRateResting: normalizeNumber(value.activityHeartRateResting),
    activitySampleCount: normalizeNumber(value.activitySampleCount),
    activitySpo2Avg: normalizeNumber(value.activitySpo2Avg),
    activitySpo2Max: normalizeNumber(value.activitySpo2Max),
    activitySpo2Min: normalizeNumber(value.activitySpo2Min),
    activitySteps: normalizeNumber(value.activitySteps),
    activityStressAvg: normalizeNumber(value.activityStressAvg),
    activityStressMax: normalizeNumber(value.activityStressMax),
    activityStressMin: normalizeNumber(value.activityStressMin),
    activityTrainingLoadDay: normalizeNumber(value.activityTrainingLoadDay),
    activityTrainingLoadWeek: normalizeNumber(value.activityTrainingLoadWeek),
    activityVitality: normalizeNumber(value.activityVitality),
    activityWorkoutAltitudeAvgMeters: normalizeNumber(value.activityWorkoutAltitudeAvgMeters),
    activityWorkoutAltitudeMaxMeters: normalizeNumber(value.activityWorkoutAltitudeMaxMeters),
    activityWorkoutAltitudeMinMeters: normalizeNumber(value.activityWorkoutAltitudeMinMeters),
    activityWorkoutCadenceAvg: normalizeNumber(value.activityWorkoutCadenceAvg),
    activityWorkoutCadenceMax: normalizeNumber(value.activityWorkoutCadenceMax),
    activityWorkoutDistanceMeters: normalizeNumber(value.activityWorkoutDistanceMeters),
    activityWorkoutDurationMinutes: normalizeNumber(value.activityWorkoutDurationMinutes),
    activityWorkoutElevationGainMeters: normalizeNumber(value.activityWorkoutElevationGainMeters),
    activityWorkoutElevationLossMeters: normalizeNumber(value.activityWorkoutElevationLossMeters),
    activityWorkoutEndTime: normalizeString(value.activityWorkoutEndTime),
    activityWorkoutHeartRateZoneAerobicSeconds: normalizeNumber(value.activityWorkoutHeartRateZoneAerobicSeconds),
    activityWorkoutHeartRateZoneAnaerobicSeconds: normalizeNumber(value.activityWorkoutHeartRateZoneAnaerobicSeconds),
    activityWorkoutHeartRateZoneExtremeSeconds: normalizeNumber(value.activityWorkoutHeartRateZoneExtremeSeconds),
    activityWorkoutHeartRateZoneFatBurnSeconds: normalizeNumber(value.activityWorkoutHeartRateZoneFatBurnSeconds),
    activityWorkoutHeartRateZoneWarmUpSeconds: normalizeNumber(value.activityWorkoutHeartRateZoneWarmUpSeconds),
    activityWorkoutJumpRateAvg: normalizeNumber(value.activityWorkoutJumpRateAvg),
    activityWorkoutJumpRateMax: normalizeNumber(value.activityWorkoutJumpRateMax),
    activityWorkoutJumps: normalizeNumber(value.activityWorkoutJumps),
    activityWorkoutLaps: normalizeNumber(value.activityWorkoutLaps),
    activityWorkoutLoad: normalizeNumber(value.activityWorkoutLoad),
    activityWorkoutPaceAvgSecondsPerKm: normalizeNumber(value.activityWorkoutPaceAvgSecondsPerKm),
    activityWorkoutPaceMaxSecondsPerKm: normalizeNumber(value.activityWorkoutPaceMaxSecondsPerKm),
    activityWorkoutPaceMinSecondsPerKm: normalizeNumber(value.activityWorkoutPaceMinSecondsPerKm),
    activityWorkoutRecoveryTimeHours: normalizeNumber(value.activityWorkoutRecoveryTimeHours),
    activityWorkoutGpsSampleCount: normalizeNumber(value.activityWorkoutGpsSampleCount),
    activityWorkoutGpsSamples: Array.isArray(value.activityWorkoutGpsSamples)
      ? value.activityWorkoutGpsSamples.map(normalizeDirectWatchWorkoutGpsSample)
      : [],
    activityWorkoutSpeedAvgKmh: normalizeNumber(value.activityWorkoutSpeedAvgKmh),
    activityWorkoutSpeedMaxKmh: normalizeNumber(value.activityWorkoutSpeedMaxKmh),
    activityWorkoutStartTime: normalizeString(value.activityWorkoutStartTime),
    activityWorkoutSteps: normalizeNumber(value.activityWorkoutSteps),
    activityWorkoutStepLengthAvgCm: normalizeNumber(value.activityWorkoutStepLengthAvgCm),
    activityWorkoutStepRateAvg: normalizeNumber(value.activityWorkoutStepRateAvg),
    activityWorkoutStepRateMax: normalizeNumber(value.activityWorkoutStepRateMax),
    activityWorkoutStrokeRateAvg: normalizeNumber(value.activityWorkoutStrokeRateAvg),
    activityWorkoutStrokes: normalizeNumber(value.activityWorkoutStrokes),
    activityWorkoutSwimStyle: normalizeNumber(value.activityWorkoutSwimStyle),
    activityWorkoutSwolfAvg: normalizeNumber(value.activityWorkoutSwolfAvg),
    activityWorkoutTrainingEffectAerobic: normalizeNumber(value.activityWorkoutTrainingEffectAerobic),
    activityWorkoutTrainingEffectAnaerobic: normalizeNumber(value.activityWorkoutTrainingEffectAnaerobic),
    activityWorkoutType: normalizeString(value.activityWorkoutType),
    activityWorkoutTypeCode: normalizeNumber(value.activityWorkoutTypeCode),
    activityWorkoutVitalityGain: normalizeNumber(value.activityWorkoutVitalityGain),
    activityWorkoutVo2Max: normalizeNumber(value.activityWorkoutVo2Max),
    batteryLevel: normalizeNumber(value.batteryLevel),
    batteryState: normalizeNumber(value.batteryState),
    byteLength: normalizeNumber(value.byteLength),
    calories: normalizeNumber(value.calories),
    channel: normalizeString(value.channel),
    commandStatus: normalizeNumber(value.commandStatus),
    commandSubtype: normalizeNumber(value.commandSubtype),
    commandType: normalizeNumber(value.commandType),
    deviceModel: normalizeString(value.deviceModel),
    firmware: normalizeString(value.firmware),
    heartRate: normalizeNumber(value.heartRate),
    heartRateDisabled: normalizeBoolean(value.heartRateDisabled),
    heartRateInterval: normalizeNumber(value.heartRateInterval),
    isCharging: normalizeBoolean(value.isCharging),
    isUserAsleep: normalizeBoolean(value.isUserAsleep),
    isWorn: normalizeBoolean(value.isWorn),
    label: normalizeString(value.label),
    rawHex: normalizeString(value.rawHex),
    sequenceNumber: normalizeNumber(value.sequenceNumber),
    serialNumber: normalizeString(value.serialNumber),
    sleepAwakeMinutes: normalizeNumber(value.sleepAwakeMinutes),
    sleepDeepMinutes: normalizeNumber(value.sleepDeepMinutes),
    sleepDurationMinutes: normalizeNumber(value.sleepDurationMinutes),
    sleepEndTime: normalizeString(value.sleepEndTime),
    sleepIsAwake: normalizeNullableBoolean(value.sleepIsAwake),
    sleepLightMinutes: normalizeNumber(value.sleepLightMinutes),
    sleepRemMinutes: normalizeNumber(value.sleepRemMinutes),
    sleepScore: normalizeNumber(value.sleepScore),
    sleepStageCount: normalizeNumber(value.sleepStageCount),
    sleepStartTime: normalizeString(value.sleepStartTime),
    steps: normalizeNumber(value.steps),
  };
}

function normalizeDirectWatchActivitySample(value: unknown): DirectWatchActivitySample {
  if (!isRecord(value)) {
    return {};
  }

  return {
    heartRate: normalizeNumber(value.heartRate),
    sampleTime: normalizeString(value.sampleTime),
    spo2: normalizeNumber(value.spo2),
    steps: normalizeNumber(value.steps),
    stress: normalizeNumber(value.stress),
  };
}

function normalizeDirectWatchWorkoutGpsSample(value: unknown): DirectWatchWorkoutGpsSample {
  if (!isRecord(value)) {
    return {};
  }

  return {
    distanceMeters: normalizeNumber(value.distanceMeters),
    hdop: normalizeNumber(value.hdop),
    latitude: normalizeNumber(value.latitude),
    longitude: normalizeNumber(value.longitude),
    sampleTime: normalizeString(value.sampleTime),
    speedMetersPerSecond: normalizeNumber(value.speedMetersPerSecond),
  };
}

function normalizeDirectWatchActivityFileProbeRequest(value: unknown): DirectWatchActivityFileProbeRequest {
  if (!isRecord(value)) {
    return {};
  }

  return {
    activityFile: isRecord(value.activityFile) ? normalizeDirectWatchActivityFile(value.activityFile) : null,
    chunkNumber: normalizeNumber(value.chunkNumber),
    chunkTotal: normalizeNumber(value.chunkTotal),
    crcValid: normalizeNullableBoolean(value.crcValid),
    detailType: normalizeNumber(value.detailType),
    durationMs: normalizeNumber(value.durationMs),
    error: normalizeString(value.error),
    idHex: normalizeString(value.idHex),
    kind: normalizeString(value.kind),
    payloadBytes: normalizeNumber(value.payloadBytes),
    parsed: normalizeNullableBoolean(value.parsed),
    sequenceNumber: normalizeNumber(value.sequenceNumber),
    status: normalizeString(value.status),
    subtype: normalizeNumber(value.subtype),
    timestamp: normalizeString(value.timestamp),
    type: normalizeNumber(value.type),
    version: normalizeNumber(value.version),
  };
}

function normalizeDirectWatchActivityFile(value: unknown): DirectWatchActivityFile {
  if (!isRecord(value)) {
    return {};
  }

  return {
    detailType: normalizeNumber(value.detailType),
    idHex: normalizeString(value.idHex),
    kind: normalizeString(value.kind),
    subtype: normalizeNumber(value.subtype),
    timestamp: normalizeString(value.timestamp),
    timezone: normalizeNumber(value.timezone),
    type: normalizeNumber(value.type),
    version: normalizeNumber(value.version),
  };
}

function normalizeDirectWatchSubscribedCharacteristic(value: unknown): DirectWatchSubscribedCharacteristic {
  if (!isRecord(value)) {
    return { uuid: "" };
  }

  return {
    error: normalizeString(value.error),
    name: normalizeString(value.name),
    properties: Array.isArray(value.properties)
      ? value.properties.map((property) => normalizeString(property)).filter((property): property is string => Boolean(property))
      : [],
    serviceUuid: normalizeString(value.serviceUuid),
    status: normalizeString(value.status),
    uuid: normalizeString(value.uuid) ?? "",
  };
}

function normalizeDirectWatchSessionPacket(value: unknown): DirectWatchSessionPacket {
  if (!isRecord(value)) {
    return {};
  }

  return {
    byteLength: normalizeNumber(value.byteLength),
    characteristicUuid: normalizeString(value.characteristicUuid),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    name: normalizeString(value.name),
    packetIndex: normalizeNumber(value.packetIndex),
    rawHex: normalizeString(value.rawHex),
    receivedAt: normalizeString(value.receivedAt),
    serviceUuid: normalizeString(value.serviceUuid),
  };
}

function normalizeDirectWatchService(value: unknown): DirectWatchService {
  if (!isRecord(value)) {
    return { uuid: "" };
  }

  return {
    characteristics: Array.isArray(value.characteristics)
      ? value.characteristics.map(normalizeDirectWatchCharacteristic)
      : [],
    name: normalizeString(value.name),
    uuid: normalizeString(value.uuid) ?? "",
  };
}

function normalizeDirectWatchCharacteristic(value: unknown): DirectWatchCharacteristic {
  if (!isRecord(value)) {
    return { uuid: "" };
  }

  return {
    name: normalizeString(value.name),
    properties: Array.isArray(value.properties)
      ? value.properties.map((property) => normalizeString(property)).filter((property): property is string => Boolean(property))
      : [],
    uuid: normalizeString(value.uuid) ?? "",
  };
}

function normalizeDirectWatchStandardReading(value: unknown): DirectWatchStandardReading {
  if (!isRecord(value)) {
    return { uuid: "" };
  }

  return {
    error: normalizeString(value.error),
    kind: normalizeStandardReadingKind(value.kind),
    name: normalizeString(value.name),
    numericValue: normalizeNumber(value.numericValue),
    rawHex: normalizeString(value.rawHex),
    serviceUuid: normalizeString(value.serviceUuid),
    status: normalizeString(value.status),
    textValue: normalizeString(value.textValue),
    uuid: normalizeString(value.uuid) ?? "",
  };
}

function normalizePayloadPreview(value: unknown): DirectWatchPayloadPreview {
  if (!isRecord(value)) {
    return {};
  }

  return {
    byteLength: normalizeNumber(value.byteLength),
    companyId: normalizeNumber(value.companyId),
    previewHex: normalizeString(value.previewHex),
    uuid: normalizeString(value.uuid),
  };
}

interface DirectWatchMinuteAggregate {
  heartRateAvg: number | null;
  heartRateMax: number | null;
  heartRateMin: number | null;
  sampleCount: number;
  spo2Avg: number | null;
  spo2Max: number | null;
  spo2Min: number | null;
  spo2SampleCount: number;
  steps: number | null;
  stressAvg: number | null;
  stressMax: number | null;
  stressMin: number | null;
}

function hasDirectWatchActivityFile(
  packet: DirectWatchDecryptedPacket,
): packet is DirectWatchDecryptedPacket & { activityFile: DirectWatchActivityFile } {
  return Boolean(packet.activityFile?.timestamp);
}

function getDirectWatchActivityEntryDate(file: DirectWatchActivityFile | null | undefined) {
  return getDirectWatchTimestampEntryDate(file?.timestamp, file);
}

function getDirectWatchSleepEntryDate(packet: DirectWatchDecryptedPacket) {
  if (packet.activityFile?.subtype !== 8 && packet.activityFile?.subtype !== 3) {
    return null;
  }

  return getDirectWatchTimestampEntryDate(packet.sleepEndTime, packet.activityFile) ??
    getDirectWatchTimestampEntryDate(packet.sleepStartTime, packet.activityFile) ??
    getDirectWatchActivityEntryDate(packet.activityFile);
}

function hasDirectWatchSampleForEntryDate(packet: DirectWatchDecryptedPacket, entryDate: string) {
  return packet.activitySamples?.some((sample) =>
    getDirectWatchSampleEntryDate(sample, packet.activityFile) === entryDate,
  ) ?? false;
}

function getDirectWatchSampleEntryDate(
  sample: DirectWatchActivitySample,
  file: DirectWatchActivityFile | null | undefined,
) {
  return getDirectWatchTimestampEntryDate(sample.sampleTime, file);
}

function getDirectWatchTimestampEntryDate(
  timestamp: string | null | undefined,
  file: DirectWatchActivityFile | null | undefined,
) {
  if (!timestamp) {
    return null;
  }

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const timezoneOffsetMinutes = typeof file?.timezone === "number" ? file.timezone * 15 : 0;
  return formatLocalDateValue(new Date(parsedDate.getTime() + timezoneOffsetMinutes * 60_000));
}

function mergeDirectWatchPackets(
  left: DirectWatchDecryptedPacket[],
  right: DirectWatchDecryptedPacket[],
) {
  const result = [...left];
  for (const packet of right) {
    if (!result.includes(packet)) {
      result.push(packet);
    }
  }
  return result;
}

function formatLocalDateValue(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const date = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function pickLatestDirectWatchPacket(
  packets: DirectWatchDecryptedPacket[],
  predicate: (packet: DirectWatchDecryptedPacket) => boolean,
) {
  return packets
    .filter(predicate)
    .sort((left, right) =>
      Number(Boolean(right.activityFileCrcValid)) - Number(Boolean(left.activityFileCrcValid)) ||
      getDirectWatchTimestampMs(right.activityFile) - getDirectWatchTimestampMs(left.activityFile),
    )[0] ?? null;
}

function getDirectWatchTimestampMs(file: DirectWatchActivityFile | null | undefined) {
  if (!file?.timestamp) {
    return 0;
  }

  const parsedDate = new Date(file.timestamp);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function aggregateDirectWatchMinuteDetails(
  packets: DirectWatchDecryptedPacket[],
  entryDate?: string,
): DirectWatchMinuteAggregate {
  const samples = entryDate
    ? collectDirectWatchSamplesForEntryDate(packets, entryDate)
    : [];

  if (samples.length) {
    const heartRateValues = samples
      .map((sample) => sample.heartRate)
      .filter(isMeaningfulDirectWatchNumber);
    const spo2Values = samples
      .map((sample) => sample.spo2)
      .filter(isMeaningfulDirectWatchNumber);
    const stressValues = samples
      .map((sample) => sample.stress)
      .filter((value): value is number =>
        typeof value === "number" && Number.isFinite(value) && value >= 0,
      );

    return {
      heartRateAvg: averageDirectWatchNumber(heartRateValues),
      heartRateMax: maxDirectWatchNumber(heartRateValues),
      heartRateMin: minDirectWatchNumber(heartRateValues),
      sampleCount: samples.length,
      spo2Avg: averageDirectWatchNumber(spo2Values),
      spo2Max: maxDirectWatchNumber(spo2Values),
      spo2Min: minDirectWatchNumber(spo2Values),
      spo2SampleCount: spo2Values.length,
      steps: sumDirectWatchNumbers(samples.map((sample) => sample.steps)),
      stressAvg: averageDirectWatchNumber(stressValues),
      stressMax: maxDirectWatchNumber(stressValues),
      stressMin: minDirectWatchNumber(stressValues),
    };
  }

  const sampleCount = packets.reduce((sum, packet) => sum + Math.max(0, packet.activitySampleCount ?? 0), 0);
  const steps = sumDirectWatchNumbers(packets.map((packet) => packet.activitySteps));

  return {
    heartRateAvg: weightedAverageDirectWatchValue(
      packets.map((packet) => ({
        value: packet.activityHeartRateAvg,
        weight: packet.activitySampleCount,
      })),
    ),
    heartRateMax: maxDirectWatchNumber(packets.map((packet) => packet.activityHeartRateMax)),
    heartRateMin: minDirectWatchNumber(packets.map((packet) => packet.activityHeartRateMin)),
    sampleCount,
    spo2Avg: weightedAverageDirectWatchValue(
      packets.map((packet) => ({
        value: packet.activitySpo2Avg,
        weight: packet.activitySampleCount,
      })),
    ),
    spo2Max: maxDirectWatchNumber(packets.map((packet) => packet.activitySpo2Max ?? packet.activitySpo2Avg)),
    spo2Min: minDirectWatchNumber(packets.map((packet) => packet.activitySpo2Min ?? packet.activitySpo2Avg)),
    spo2SampleCount: packets.reduce((sum, packet) =>
      sum + (typeof packet.activitySpo2Avg === "number" ? Math.max(1, packet.activitySampleCount ?? 1) : 0), 0),
    steps,
    stressAvg: weightedAverageDirectWatchValue(
      packets.map((packet) => ({
        value: packet.activityStressAvg,
        weight: packet.activitySampleCount,
      })),
    ),
    stressMax: maxDirectWatchNumber(packets.map((packet) => packet.activityStressMax ?? packet.activityStressAvg)),
    stressMin: minDirectWatchNumber(packets.map((packet) => packet.activityStressMin ?? packet.activityStressAvg)),
  };
}

function collectDirectWatchSamplesForEntryDate(
  packets: DirectWatchDecryptedPacket[],
  entryDate: string,
) {
  const samples: DirectWatchActivitySample[] = [];

  packets.forEach((packet) => {
    getDirectWatchWorkoutActivitySamples(packet).forEach((sample) => {
      if (getDirectWatchSampleEntryDate(sample, packet.activityFile) === entryDate) {
        samples.push(sample);
      }
    });
  });

  return samples;
}

function buildDirectWatchHeartRateSummary(
  dailySummary: DirectWatchDecryptedPacket | null,
  details: DirectWatchMinuteAggregate,
): DeviceHealthHeartRateSummary | null {
  const heartRate: DeviceHealthHeartRateSummary = {
    averageBpm: dailySummary?.activityHeartRateAvg ?? details.heartRateAvg,
    hrvRmssdMs: null,
    maxBpm: dailySummary?.activityHeartRateMax ?? details.heartRateMax,
    minBpm: dailySummary?.activityHeartRateMin ?? details.heartRateMin,
    restingBpm: dailySummary?.activityHeartRateResting ??
      dailySummary?.activityHeartRateMin ??
      details.heartRateMin ??
      dailySummary?.activityHeartRateAvg ??
      details.heartRateAvg,
  };

  return hasDirectWatchHeartRateData(heartRate) ? heartRate : null;
}

function buildDirectWatchOxygenSummary(
  dailySummary: DirectWatchDecryptedPacket | null,
  details: DirectWatchMinuteAggregate,
): DeviceHealthOxygenSaturationSummary | null {
  const sampleCount = details.spo2SampleCount > 0
    ? details.spo2SampleCount
    : dailySummary?.activitySpo2Avg !== null && dailySummary?.activitySpo2Avg !== undefined
      ? 1
      : 0;
  const oxygenSaturation: DeviceHealthOxygenSaturationSummary = {
    averagePercent: dailySummary?.activitySpo2Avg ?? details.spo2Avg,
    latestPercent: dailySummary?.activitySpo2Avg ?? details.spo2Avg,
    maxPercent: dailySummary?.activitySpo2Max ?? details.spo2Max,
    minPercent: dailySummary?.activitySpo2Min ?? details.spo2Min,
    sampleCount,
  };

  return hasDirectWatchOxygenData(oxygenSaturation) ? oxygenSaturation : null;
}

function buildDirectWatchSleepSummary(packets: DirectWatchDecryptedPacket[]): DeviceHealthSleepSummary | null {
  const sleepPacket = packets
    .filter((packet) =>
      (packet.activityFile?.subtype === 8 || packet.activityFile?.subtype === 3) &&
      Boolean(packet.sleepDurationMinutes || packet.sleepStartTime || packet.sleepEndTime)
    )
    .sort((left, right) =>
      Number(Boolean(right.activityFileCrcValid)) - Number(Boolean(left.activityFileCrcValid)) ||
      (normalizeSleepMetric(right.sleepDurationMinutes) ?? -1) - (normalizeSleepMetric(left.sleepDurationMinutes) ?? -1) ||
      getDirectWatchTimestampMs(right.activityFile) - getDirectWatchTimestampMs(left.activityFile)
    )[0] ?? null;

  if (!sleepPacket) {
    return null;
  }

  const sleep: DeviceHealthSleepSummary = normalizeDirectWatchSleepSummary({
    awakeMinutes: normalizeSleepMetric(sleepPacket.sleepAwakeMinutes),
    deepMinutes: normalizeSleepMetric(sleepPacket.sleepDeepMinutes),
    durationMinutes: normalizeSleepMetric(sleepPacket.sleepDurationMinutes),
    endTime: normalizeIsoString(sleepPacket.sleepEndTime),
    lightMinutes: normalizeSleepMetric(sleepPacket.sleepLightMinutes),
    remMinutes: normalizeSleepMetric(sleepPacket.sleepRemMinutes),
    score: normalizeSleepMetric(sleepPacket.sleepScore),
    startTime: normalizeIsoString(sleepPacket.sleepStartTime),
  });

  return hasDirectWatchSleepData(sleep) ? sleep : null;
}

function buildDirectWatchSamples(
  packets: DirectWatchDecryptedPacket[],
  entryDate?: string,
): DeviceHealthSamplePayload[] {
  const samples = new Map<string, DeviceHealthSamplePayload>();

  packets.forEach((packet) => {
    packet.activitySamples?.forEach((sample) => {
      if (entryDate && getDirectWatchSampleEntryDate(sample, packet.activityFile) !== entryDate) {
        return;
      }

      const sampledAt = normalizeIsoString(sample.sampleTime);
      if (!sampledAt) {
        return;
      }

      addDirectWatchSample(samples, {
        metric: "heart_rate",
        sampledAt,
        value: sample.heartRate,
        rawPayload: {
          source: "direct-watch-activity-file",
          fileId: packet.activityFile?.idHex ?? null,
          steps: sample.steps ?? null,
        },
      });
      addDirectWatchSample(samples, {
        metric: "oxygen_saturation",
        sampledAt,
        value: sample.spo2,
        rawPayload: {
          source: "direct-watch-activity-file",
          fileId: packet.activityFile?.idHex ?? null,
        },
      });
      addDirectWatchSample(samples, {
        metric: "stress",
        sampledAt,
        value: sample.stress,
        rawPayload: {
          source: "direct-watch-activity-file",
          fileId: packet.activityFile?.idHex ?? null,
        },
      });
    });
  });

  return Array.from(samples.values()).sort((left, right) =>
    left.metric.localeCompare(right.metric) || left.sampledAt.localeCompare(right.sampledAt),
  );
}

function addDirectWatchSample(
  samples: Map<string, DeviceHealthSamplePayload>,
  sample: Omit<DeviceHealthSamplePayload, "value"> & { value?: number | null },
) {
  if (sample.value === null || sample.value === undefined || !Number.isFinite(sample.value)) {
    return;
  }

  samples.set(`${sample.metric}:${sample.sampledAt}`, {
    ...sample,
    value: sample.value,
  });
}

function buildDirectWatchDeviceWorkouts(
  entryDate: string,
  probe: DirectWatchClassicProbe,
  activityPackets: DirectWatchDecryptedPacket[],
): DeviceWorkoutsSyncPayload {
  const workoutPacketGroups = new Map<string, DirectWatchDecryptedPacket[]>();

  activityPackets
    .filter((packet) => packet.activityFile?.type === 1)
    .forEach((packet) => {
      const groupKey = getDirectWatchWorkoutGroupKey(packet);
      if (!groupKey) {
        return;
      }

      const group = workoutPacketGroups.get(groupKey) ?? [];
      group.push(packet);
      workoutPacketGroups.set(groupKey, group);
    });

  const workouts = Array.from(workoutPacketGroups.values())
    .map((packets) => buildDirectWatchDeviceWorkout(entryDate, probe, packets, activityPackets))
    .filter((workout): workout is DeviceWorkoutPayload => Boolean(workout))
    .sort((left, right) => left.startTime.localeCompare(right.startTime));

  return {
    entryDate,
    provider: "direct-watch",
    workouts,
  };
}

function getDirectWatchWorkoutGroupKey(packet: DirectWatchDecryptedPacket) {
  const fileGroupKey = getDirectWatchWorkoutFileGroupKey(packet.activityFile);
  if (fileGroupKey) {
    return fileGroupKey;
  }

  const summaryStart = normalizeIsoString(packet.activityWorkoutStartTime);
  if (summaryStart) {
    return `workout:summary:${summaryStart}`;
  }

  const fileTimestamp = normalizeIsoString(packet.activityFile?.timestamp);
  if (fileTimestamp) {
    return `workout:file:${fileTimestamp}`;
  }

  return packet.activityFile?.idHex ?? packet.rawHex ?? "";
}

function getDirectWatchWorkoutFileGroupKey(file: DirectWatchActivityFile | null | undefined) {
  if (!file || file.type !== 1) {
    return null;
  }

  const idHex = normalizeString(file.idHex)?.toUpperCase() ?? null;
  const baseFileId = idHex && idHex.length >= 10 ? idHex.slice(0, 10) : null;
  const timestamp = normalizeIsoString(file.timestamp);
  const identity = baseFileId ?? timestamp;
  if (!identity) {
    return null;
  }

  return [
    "workout-file",
    file.type ?? "",
    file.subtype ?? "",
    identity,
  ].join(":");
}

function buildDirectWatchDeviceWorkout(
  entryDate: string,
  probe: DirectWatchClassicProbe,
  packets: DirectWatchDecryptedPacket[],
  activityPackets: DirectWatchDecryptedPacket[],
): DeviceWorkoutPayload | null {
  const files = packets
    .map((packet) => packet.activityFile)
    .filter((file): file is DirectWatchActivityFile => Boolean(file));
  const sourceFile = files.find((file) => normalizeIsoString(file.timestamp)) ?? files[0];
  const fileStart = normalizeIsoString(sourceFile?.timestamp);
  const summaryPacket = packets.find((packet) =>
    Boolean(
      packet.activityWorkoutStartTime ||
        packet.activityWorkoutDurationMinutes ||
        packet.activityWorkoutDistanceMeters ||
        packet.activityWorkoutSteps ||
        packet.activityWorkoutType,
    ),
  ) ?? packets[0];
  const summaryStart = normalizeIsoString(summaryPacket?.activityWorkoutStartTime);
  const summaryEnd = normalizeIsoString(summaryPacket?.activityWorkoutEndTime);
  const directSamples = buildDirectWatchWorkoutSamples(packets);
  const directSampleTimes = directSamples
    .map((sample) => new Date(sample.sampleTime).getTime())
    .filter((time) => Number.isFinite(time));
  const startMs = summaryStart
    ? new Date(summaryStart).getTime()
    : directSampleTimes.length
    ? Math.min(...directSampleTimes)
    : fileStart
      ? new Date(fileStart).getTime()
      : Number.NaN;

  if (!Number.isFinite(startMs)) {
    return null;
  }

  const latestDirectSampleMs = directSampleTimes.length ? Math.max(...directSampleTimes) : Number.NaN;
  const sampleCount = maxDirectWatchNumber(packets.map((packet) => packet.activitySampleCount));
  const inferredDuration = Number.isFinite(latestDirectSampleMs) && latestDirectSampleMs > startMs
    ? Math.max(1, Math.round((latestDirectSampleMs - startMs) / 60000))
    : sampleCount && sampleCount > 1
      ? sampleCount
      : null;
  const durationMinutes = summaryPacket?.activityWorkoutDurationMinutes ?? inferredDuration;
  const endMs = summaryEnd
    ? new Date(summaryEnd).getTime()
    : Number.isFinite(latestDirectSampleMs) && latestDirectSampleMs > startMs
    ? latestDirectSampleMs
    : startMs + Math.max(1, durationMinutes ?? 1) * 60000;
  const samples = mergeDirectWatchWorkoutSamples(
    directSamples,
    buildDirectWatchWorkoutSamplesForWindow(activityPackets, startMs, endMs),
  );
  const heartRates = samples
    .map((sample) => sample.heartRateBpm)
    .filter(isMeaningfulDirectWatchNumber);
  const oxygenValues = samples
    .map((sample) => sample.oxygenSaturationPercent)
    .filter(isMeaningfulDirectWatchNumber);
  const sampleDistanceMeters = maxDirectWatchNumber(samples.map((sample) => sample.distanceMeters));
  const distanceMeters = summaryPacket?.activityWorkoutDistanceMeters ?? sampleDistanceMeters;
  const summaryHeartRates = [
    normalizeWorkoutHeartRate(summaryPacket?.activityHeartRateAvg),
    normalizeWorkoutHeartRate(summaryPacket?.activityHeartRateMin),
    normalizeWorkoutHeartRate(summaryPacket?.activityHeartRateMax),
  ].filter(isMeaningfulDirectWatchNumber);
  const activeCalories = summaryPacket?.activityCalories ?? sumDirectWatchNumbers(packets.map((packet) => packet.activityCalories));
  const steps = summaryPacket?.activityWorkoutSteps ?? summaryPacket?.activitySteps ?? null;
  const averagePaceSecondsPerKm = summaryPacket?.activityWorkoutPaceAvgSecondsPerKm ??
    deriveDirectWatchWorkoutPaceSecondsPerKm(distanceMeters, durationMinutes);
  const averageSpeedKmh = summaryPacket?.activityWorkoutSpeedAvgKmh ??
    deriveDirectWatchWorkoutSpeedKmh(distanceMeters, durationMinutes);
  const zoneSeconds = {
    aerobic: summaryPacket?.activityWorkoutHeartRateZoneAerobicSeconds ?? null,
    anaerobic: summaryPacket?.activityWorkoutHeartRateZoneAnaerobicSeconds ?? null,
    extreme: summaryPacket?.activityWorkoutHeartRateZoneExtremeSeconds ?? null,
    fatBurn: summaryPacket?.activityWorkoutHeartRateZoneFatBurnSeconds ?? null,
    warmUp: summaryPacket?.activityWorkoutHeartRateZoneWarmUpSeconds ?? null,
  };
  const workoutType = summaryPacket?.activityWorkoutType ?? getDirectWatchWorkoutTypeLabel(sourceFile?.subtype) ?? "workout";
  const workoutProfile = getDeviceWorkoutProfile(workoutType);
  const missingMetrics = getMissingDeviceWorkoutMetrics(workoutType, {
    calories: activeCalories !== null,
    distance: distanceMeters !== null && distanceMeters !== undefined,
    duration: durationMinutes !== null,
    heartRate: summaryHeartRates.length > 0 || heartRates.length > 0,
    steps: steps !== null,
  });
  const sourceWorkoutGroupId = files
    .map((file) => getDirectWatchWorkoutFileGroupKey(file))
    .find((item): item is string => Boolean(item));
  const sourceWorkoutId = sourceWorkoutGroupId
    ? `direct-watch:${sourceWorkoutGroupId}`
    : [
        "direct-watch",
        entryDate,
        new Date(startMs).toISOString(),
      ].join(":");

  return {
    activeCalories,
    averageHeartRateBpm: normalizeWorkoutHeartRate(summaryPacket?.activityHeartRateAvg) ?? averageDirectWatchNumber(heartRates),
    distanceMeters: distanceMeters ?? null,
    durationMinutes,
    endTime: new Date(endMs).toISOString(),
    entryDate,
    maxHeartRateBpm: normalizeWorkoutHeartRate(summaryPacket?.activityHeartRateMax) ?? maxDirectWatchNumber(heartRates),
    minHeartRateBpm: normalizeWorkoutHeartRate(summaryPacket?.activityHeartRateMin) ?? minDirectWatchNumber(heartRates),
    provider: "direct-watch",
    rawPayload: {
      dataOrigin: "PERFORM Sync",
      files: files.map((file) => ({
        detailType: file.detailType ?? null,
        idHex: file.idHex ?? null,
        kind: file.kind ?? null,
        subtype: file.subtype ?? null,
        timestamp: file.timestamp ?? null,
        type: file.type ?? null,
        version: file.version ?? null,
      })),
      packetCount: packets.length,
      gpsTrackPointCount: sumDirectWatchNumbers(packets.map((packet) => packet.activityWorkoutGpsSampleCount)),
      sampleCount: samples.length,
      dataCompleteness: missingMetrics.length === 0 ? "complete" : "partial",
      missingMetrics,
      workoutProfile: {
        id: workoutProfile.id,
        optionalMetrics: workoutProfile.optionalMetrics,
        requiredMetrics: workoutProfile.requiredMetrics,
      },
      source: "direct-watch-workout-file",
      sourceWorkoutGroupId,
      sourceFileKind: summaryPacket?.activityFile?.kind ?? null,
      activityFileProbeRequests: getDirectWatchWorkoutProbeRequests(probe, sourceWorkoutGroupId),
      spo2Average: averageDirectWatchNumber(oxygenValues),
      steps,
      summaryHeartRateSamples: summaryHeartRates,
      workoutSummary: {
        altitudeAvgMeters: summaryPacket?.activityWorkoutAltitudeAvgMeters ?? null,
        altitudeMaxMeters: summaryPacket?.activityWorkoutAltitudeMaxMeters ?? null,
        altitudeMinMeters: summaryPacket?.activityWorkoutAltitudeMinMeters ?? null,
        cadenceAvg: summaryPacket?.activityWorkoutCadenceAvg ?? null,
        cadenceMax: summaryPacket?.activityWorkoutCadenceMax ?? null,
        distanceMeters: distanceMeters ?? null,
        durationMinutes: summaryPacket?.activityWorkoutDurationMinutes ?? null,
        elevationGainMeters: summaryPacket?.activityWorkoutElevationGainMeters ?? null,
        elevationLossMeters: summaryPacket?.activityWorkoutElevationLossMeters ?? null,
        endTime: summaryEnd ?? null,
        heartRateZonesSeconds: zoneSeconds,
        jumpRateAvg: summaryPacket?.activityWorkoutJumpRateAvg ?? null,
        jumpRateMax: summaryPacket?.activityWorkoutJumpRateMax ?? null,
        jumps: summaryPacket?.activityWorkoutJumps ?? null,
        laps: summaryPacket?.activityWorkoutLaps ?? null,
        paceAvgSecondsPerKm: averagePaceSecondsPerKm,
        paceMaxSecondsPerKm: summaryPacket?.activityWorkoutPaceMaxSecondsPerKm ?? null,
        paceMinSecondsPerKm: summaryPacket?.activityWorkoutPaceMinSecondsPerKm ?? null,
        recoveryTimeHours: summaryPacket?.activityWorkoutRecoveryTimeHours ?? null,
        speedAvgKmh: averageSpeedKmh,
        speedMaxKmh: summaryPacket?.activityWorkoutSpeedMaxKmh ?? null,
        startTime: summaryStart ?? null,
        stepLengthAvgCm: summaryPacket?.activityWorkoutStepLengthAvgCm ?? null,
        stepRateAvg: summaryPacket?.activityWorkoutStepRateAvg ?? null,
        stepRateMax: summaryPacket?.activityWorkoutStepRateMax ?? null,
        strokeRateAvg: summaryPacket?.activityWorkoutStrokeRateAvg ?? null,
        strokes: summaryPacket?.activityWorkoutStrokes ?? null,
        swolfAvg: summaryPacket?.activityWorkoutSwolfAvg ?? null,
        swimStyle: summaryPacket?.activityWorkoutSwimStyle ?? null,
        trainingEffectAerobic: summaryPacket?.activityWorkoutTrainingEffectAerobic ?? null,
        trainingEffectAnaerobic: summaryPacket?.activityWorkoutTrainingEffectAnaerobic ?? null,
        type: workoutType,
        typeCode: summaryPacket?.activityWorkoutTypeCode ?? null,
        vo2Max: summaryPacket?.activityWorkoutVo2Max ?? null,
        workoutLoad: summaryPacket?.activityWorkoutLoad ?? null,
        vitalityGain: summaryPacket?.activityWorkoutVitalityGain ?? null,
      },
    },
    samples,
    sourceDevice: probe.deviceName || "Redmi Watch / PERFORM Sync",
    sourceWorkoutId,
    startTime: new Date(startMs).toISOString(),
    syncedAt: new Date().toISOString(),
    workoutType,
  };
}

function getDirectWatchWorkoutProbeRequests(
  probe: DirectWatchClassicProbe,
  sourceWorkoutGroupId: string | null | undefined,
) {
  if (!sourceWorkoutGroupId) {
    return [];
  }

  return (probe.activityFileProbeRequests ?? [])
    .filter((request) => getDirectWatchWorkoutFileGroupKey(request.activityFile) === sourceWorkoutGroupId)
    .map((request) => ({
      crcValid: request.crcValid ?? null,
      detailType: request.activityFile?.detailType ?? request.detailType ?? null,
      error: request.error ?? null,
      idHex: request.idHex ?? request.activityFile?.idHex ?? null,
      kind: request.kind ?? request.activityFile?.kind ?? null,
      parsed: request.parsed ?? null,
      payloadBytes: request.payloadBytes ?? null,
      status: request.status ?? null,
      subtype: request.activityFile?.subtype ?? request.subtype ?? null,
      timestamp: request.activityFile?.timestamp ?? request.timestamp ?? null,
      type: request.activityFile?.type ?? request.type ?? null,
      version: request.activityFile?.version ?? request.version ?? null,
    }));
}

function getDirectWatchWorkoutTypeLabel(subtype: number | null | undefined) {
  switch (subtype) {
    case 1:
      return "outdoor-run";
    case 2:
      return "outdoor-walk";
    case 3:
      return "treadmill";
    case 6:
      return "outdoor-cycling";
    case 7:
      return "indoor-cycling";
    case 8:
      return "freestyle";
    case 9:
      return "pool-swim";
    case 11:
      return "elliptical";
    case 13:
      return "rowing";
    case 14:
      return "jump-rope";
    case 16:
      return "hiit";
    case 22:
      return "walking";
    case 23:
      return "cycling";
    default:
      return typeof subtype === "number" ? `workout-${subtype}` : null;
  }
}

function buildDirectWatchWorkoutSamples(packets: DirectWatchDecryptedPacket[]): DeviceWorkoutSamplePayload[] {
  const samples = new Map<string, DeviceWorkoutSamplePayload>();

  packets.forEach((packet) => {
    packet.activityWorkoutGpsSamples?.forEach((sample) => {
      const sampleTime = normalizeIsoString(sample.sampleTime);
      if (!sampleTime) {
        return;
      }

      const speedMetersPerSecond = normalizeWorkoutSpeed(sample.speedMetersPerSecond);
      const distanceMeters = normalizeWorkoutDistance(sample.distanceMeters);
      const existing = samples.get(sampleTime);
      samples.set(sampleTime, {
        distanceMeters: existing?.distanceMeters ?? distanceMeters,
        heartRateBpm: existing?.heartRateBpm ?? null,
        oxygenSaturationPercent: existing?.oxygenSaturationPercent ?? null,
        paceSecondsPerKm: existing?.paceSecondsPerKm ?? (
          speedMetersPerSecond && speedMetersPerSecond > 0 ? Math.round(1000 / speedMetersPerSecond) : null
        ),
        rawPayload: {
          ...(existing?.rawPayload ?? {}),
          fileId: packet.activityFile?.idHex ?? existing?.rawPayload?.fileId ?? null,
          gps: {
            hdop: sample.hdop ?? null,
            latitude: sample.latitude ?? null,
            longitude: sample.longitude ?? null,
          },
          source: "direct-watch-gps-track",
        },
        sampleTime,
        speedMetersPerSecond: existing?.speedMetersPerSecond ?? speedMetersPerSecond,
      });
    });

    packet.activitySamples?.forEach((sample) => {
      const sampleTime = normalizeIsoString(sample.sampleTime);
      if (!sampleTime) {
        return;
      }

      const heartRateBpm = normalizeWorkoutHeartRate(sample.heartRate);
      const oxygenSaturationPercent = normalizeWorkoutOxygen(sample.spo2);

      if (heartRateBpm === null && oxygenSaturationPercent === null) {
        return;
      }

      const existing = samples.get(sampleTime);
      samples.set(sampleTime, {
        distanceMeters: existing?.distanceMeters ?? null,
        heartRateBpm,
        oxygenSaturationPercent,
        paceSecondsPerKm: existing?.paceSecondsPerKm ?? null,
        rawPayload: {
          ...(existing?.rawPayload ?? {}),
          fileId: packet.activityFile?.idHex ?? null,
          source: "direct-watch-workout-file",
          steps: sample.steps ?? null,
          stress: sample.stress ?? null,
        },
        sampleTime,
        speedMetersPerSecond: existing?.speedMetersPerSecond ?? null,
      });
    });
  });

  return Array.from(samples.values()).sort((left, right) => left.sampleTime.localeCompare(right.sampleTime));
}

function getDirectWatchWorkoutActivitySamples(packet: DirectWatchDecryptedPacket): DirectWatchActivitySample[] {
  if (packet.activitySamples?.length) {
    return packet.activitySamples;
  }

  return parseDirectWatchFreestyleV3WorkoutSamples(packet);
}

function parseDirectWatchFreestyleV3WorkoutSamples(packet: DirectWatchDecryptedPacket): DirectWatchActivitySample[] {
  const file = packet.activityFile;
  if (
    file?.type !== 1 ||
    file.subtype !== 8 ||
    file.detailType !== 0 ||
    file.version !== 3
  ) {
    return [];
  }

  const startTime = normalizeIsoString(file.timestamp);
  const rawHex = normalizeString(packet.activityFileRawHex);
  if (!startTime || !rawHex) {
    return [];
  }

  const bytes = directWatchHexToBytes(rawHex);
  const dataEnd = packet.activityFileCrcValid !== false && bytes.length >= 4 ? bytes.length - 4 : bytes.length;
  const recordSize = 4;
  const recordStart = findDirectWatchFreestyleV3RecordStart(bytes, dataEnd);
  const startMs = new Date(startTime).getTime();
  if (recordStart === null || !Number.isFinite(startMs)) {
    return [];
  }

  const samples: DirectWatchActivitySample[] = [];
  let recordIndex = 0;
  for (let offset = recordStart; offset + recordSize <= dataEnd; offset += recordSize) {
    const heartRate = normalizeWorkoutHeartRate(bytes[offset]);
    if (heartRate !== null) {
      samples.push({
        heartRate,
        sampleTime: new Date(startMs + recordIndex * 1000).toISOString(),
        spo2: null,
        steps: null,
        stress: null,
      });
    }
    recordIndex += 1;
  }

  return samples.length >= 10 ? samples : [];
}

function findDirectWatchFreestyleV3RecordStart(bytes: number[], dataEnd: number) {
  const recordSize = 4;
  let bestStart: number | null = null;
  let bestValidCount = 0;

  for (let recordStart = 52; recordStart <= 64; recordStart += 1) {
    if (recordStart + recordSize > dataEnd) {
      continue;
    }

    let totalCount = 0;
    let validHeartRateCount = 0;
    let validTrailingByteCount = 0;
    for (let offset = recordStart; offset + recordSize <= dataEnd; offset += recordSize) {
      const heartRate = bytes[offset] ?? 0;
      const second = bytes[offset + 1] ?? 0;
      const third = bytes[offset + 2] ?? 0;
      const fourth = bytes[offset + 3] ?? 0;
      if (normalizeWorkoutHeartRate(heartRate) !== null) {
        validHeartRateCount += 1;
      }
      if (second >= 0 && second <= 3 && third === 0 && fourth === 0) {
        validTrailingByteCount += 1;
      }
      totalCount += 1;
    }

    if (
      totalCount >= 10 &&
      validHeartRateCount >= Math.max(10, Math.floor(totalCount * 0.85)) &&
      validTrailingByteCount >= Math.max(10, Math.floor(totalCount * 0.85)) &&
      validHeartRateCount > bestValidCount
    ) {
      bestStart = recordStart;
      bestValidCount = validHeartRateCount;
    }
  }

  return bestStart;
}

function directWatchHexToBytes(rawHex: string) {
  const cleanHex = rawHex.replace(/[^a-f0-9]/gi, "");
  if (cleanHex.length < 2 || cleanHex.length % 2 !== 0) {
    return [];
  }

  const bytes: number[] = [];
  for (let index = 0; index < cleanHex.length; index += 2) {
    const value = Number.parseInt(cleanHex.slice(index, index + 2), 16);
    if (!Number.isFinite(value)) {
      return [];
    }
    bytes.push(value);
  }
  return bytes;
}

function buildDirectWatchWorkoutSamplesForWindow(
  packets: DirectWatchDecryptedPacket[],
  startMs: number,
  endMs: number,
) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  return buildDirectWatchWorkoutSamples(
    packets.filter((packet) =>
      packet.activityFile?.type === 0 &&
      packet.activityFile.subtype === 0 &&
      packet.activityFile.detailType === 0 &&
      getDirectWatchWorkoutActivitySamples(packet).some((sample) => {
        const sampleMs = sample.sampleTime ? new Date(sample.sampleTime).getTime() : Number.NaN;
        return Number.isFinite(sampleMs) && sampleMs >= startMs && sampleMs <= endMs;
      })
    ),
  ).filter((sample) => {
    const sampleMs = new Date(sample.sampleTime).getTime();
    return Number.isFinite(sampleMs) && sampleMs >= startMs && sampleMs <= endMs;
  });
}

function mergeDirectWatchWorkoutSamples(
  primarySamples: DeviceWorkoutSamplePayload[],
  fallbackSamples: DeviceWorkoutSamplePayload[],
) {
  if (!fallbackSamples.length) {
    return primarySamples;
  }

  const samples = new Map<string, DeviceWorkoutSamplePayload>();
  primarySamples.forEach((sample) => samples.set(sample.sampleTime, sample));
  fallbackSamples.forEach((sample) => {
    if (!samples.has(sample.sampleTime)) {
      samples.set(sample.sampleTime, {
        ...sample,
        rawPayload: {
          ...(sample.rawPayload ?? {}),
          source: "direct-watch-day-file-workout-window",
        },
      });
    }
  });
  return Array.from(samples.values()).sort((left, right) => left.sampleTime.localeCompare(right.sampleTime));
}

function buildDirectWatchWorkoutSummary(workouts: DeviceWorkoutPayload[]): DeviceHealthWorkoutSummary | null {
  if (!workouts.length) {
    return null;
  }

  return {
    activeCalories: sumDirectWatchNumbers(workouts.map((workout) => workout.activeCalories)),
    averageHeartRateBpm: weightedAverageDirectWatchValue(workouts.map((workout) => ({
      value: workout.averageHeartRateBpm,
      weight: workout.samples.length || workout.durationMinutes,
    }))),
    count: workouts.length,
    maxHeartRateBpm: maxDirectWatchNumber(workouts.map((workout) => workout.maxHeartRateBpm)),
    totalDistanceMeters: sumDirectWatchNumbers(workouts.map((workout) => workout.distanceMeters)),
    totalDurationMinutes: sumDirectWatchNumbers(workouts.map((workout) => workout.durationMinutes)),
  };
}

function averageDirectWatchNumber(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function normalizeWorkoutHeartRate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 254 ? value : null;
}

function normalizeWorkoutOxygen(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 100 ? value : null;
}

function normalizeWorkoutSpeed(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 20 ? value : null;
}

function normalizeWorkoutDistance(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 500_000 ? value : null;
}

function deriveDirectWatchWorkoutSpeedKmh(
  distanceMeters: number | null | undefined,
  durationMinutes: number | null | undefined,
) {
  if (
    typeof distanceMeters !== "number" ||
    typeof durationMinutes !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationMinutes) ||
    distanceMeters <= 0 ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const speedKmh = distanceMeters / 1000 / (durationMinutes / 60);
  return speedKmh > 0 && speedKmh <= 200 ? speedKmh : null;
}

function deriveDirectWatchWorkoutPaceSecondsPerKm(
  distanceMeters: number | null | undefined,
  durationMinutes: number | null | undefined,
) {
  if (
    typeof distanceMeters !== "number" ||
    typeof durationMinutes !== "number" ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationMinutes) ||
    distanceMeters <= 0 ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const paceSeconds = Math.round((durationMinutes * 60) / (distanceMeters / 1000));
  return paceSeconds >= 60 && paceSeconds <= 7200 ? paceSeconds : null;
}

function buildDirectWatchRawPayload(
  probe: DirectWatchClassicProbe,
  dayPackets: DirectWatchDecryptedPacket[],
  dailySummary: DirectWatchDecryptedPacket | null,
  details: DirectWatchMinuteAggregate,
  workouts: DeviceWorkoutPayload[],
): Record<string, unknown> {
  return {
    activityFileProbeCompletedCount: probe.activityFileProbeCompletedCount ?? 0,
    activityFileProbeCount: probe.activityFileProbeCount ?? 0,
    activityFileProbeFailedCount: probe.activityFileProbeFailedCount ?? 0,
    authKeyStatus: probe.authKeyStatus ?? null,
    dataOrigin: "PERFORM Sync",
    fileCount: dayPackets.length,
    workoutFileCount: workouts.length,
    activityFileProbeRequests: (probe.activityFileProbeRequests ?? []).slice(0, 48).map((request) => ({
      crcValid: request.crcValid ?? null,
      detailType: request.activityFile?.detailType ?? request.detailType ?? null,
      error: request.error ?? null,
      idHex: request.idHex ?? request.activityFile?.idHex ?? null,
      kind: request.kind ?? request.activityFile?.kind ?? null,
      parsed: request.parsed ?? null,
      payloadBytes: request.payloadBytes ?? null,
      status: request.status ?? null,
      subtype: request.activityFile?.subtype ?? request.subtype ?? null,
      timestamp: request.activityFile?.timestamp ?? request.timestamp ?? null,
      type: request.activityFile?.type ?? request.type ?? null,
      version: request.activityFile?.version ?? request.version ?? null,
    })),
    restingHeartRateSource: getDirectWatchRestingHeartRateSource(dailySummary, details),
    calories: dailySummary?.activityCalories ?? null,
    steps: dailySummary?.activitySteps ?? null,
    minuteSteps: details.steps,
    stepsSource: dailySummary?.activitySteps !== null && dailySummary?.activitySteps !== undefined
      ? "daily-summary"
      : details.steps !== null
        ? "minute-details-partial"
        : null,
    stressAvg: dailySummary?.activityStressAvg ?? details.stressAvg,
    stressMin: dailySummary?.activityStressMin ?? details.stressMin,
    stressMax: dailySummary?.activityStressMax ?? details.stressMax,
    trainingLoadDay: dailySummary?.activityTrainingLoadDay ?? null,
    trainingLoadWeek: dailySummary?.activityTrainingLoadWeek ?? null,
    vitality: dailySummary?.activityVitality ?? null,
    minuteSampleCount: details.sampleCount,
    sleepStageCount: maxDirectWatchNumber(dayPackets.map((packet) => packet.sleepStageCount)),
    sleepIsAwake: dayPackets.find((packet) => typeof packet.sleepIsAwake === "boolean")?.sleepIsAwake ?? null,
    files: dayPackets.slice(0, 16).map((packet) => ({
      crcValid: packet.activityFileCrcValid ?? null,
      detailType: packet.activityFile?.detailType ?? null,
      idHex: packet.activityFile?.idHex ?? null,
      kind: packet.activityFileKind ?? packet.activityFile?.kind ?? null,
      parsed: packet.activityFileParsed ?? null,
      payloadBytes: packet.activityFilePayloadBytes ?? null,
      sampleCount: packet.activitySampleCount ?? null,
      sleepDurationMinutes: packet.sleepDurationMinutes ?? null,
      sleepStageCount: packet.sleepStageCount ?? null,
      subtype: packet.activityFile?.subtype ?? null,
      timestamp: packet.activityFile?.timestamp ?? null,
      type: packet.activityFile?.type ?? null,
      version: packet.activityFile?.version ?? null,
    })),
  };
}

function collectDirectWatchActivityFiles(probe: DirectWatchClassicProbe) {
  const files = new Map<string, DirectWatchActivityFile>();

  probe.decryptedPackets?.forEach((packet) => {
    packet.activityFiles?.forEach((file) => {
      addDirectWatchInventoryFile(files, file);
    });

    if (packet.activityFile) {
      addDirectWatchInventoryFile(files, packet.activityFile);
    }
  });

  return Array.from(files.values()).sort((left, right) =>
    String(right.timestamp ?? "").localeCompare(String(left.timestamp ?? "")) ||
    String(left.idHex ?? "").localeCompare(String(right.idHex ?? "")),
  );
}

function addDirectWatchInventoryFile(files: Map<string, DirectWatchActivityFile>, file: DirectWatchActivityFile) {
  const key = file.idHex || `${file.timestamp ?? ""}:${file.type ?? ""}:${file.subtype ?? ""}:${file.detailType ?? ""}`;
  if (key.trim()) {
    files.set(key, file);
  }
}

function collectDirectWatchInventoryEntryDates(files: DirectWatchActivityFile[]) {
  const dates = new Set<string>();

  files.forEach((file) => {
    const entryDate = getDirectWatchActivityEntryDate(file);
    if (!entryDate) {
      return;
    }

    dates.add(entryDate);

    if (file.subtype === 8 || file.subtype === 3) {
      dates.add(addLocalDateDays(entryDate, 1));
    }
  });

  return Array.from(dates).sort((left, right) => right.localeCompare(left));
}

function addLocalDateDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDateValue(date);
}

function getDirectWatchRestingHeartRateSource(
  dailySummary: DirectWatchDecryptedPacket | null,
  details: DirectWatchMinuteAggregate,
) {
  if (dailySummary?.activityHeartRateResting !== null && dailySummary?.activityHeartRateResting !== undefined) {
    return "direct-watch-resting";
  }
  if (
    dailySummary?.activityHeartRateMin !== null && dailySummary?.activityHeartRateMin !== undefined ||
    details.heartRateMin !== null
  ) {
    return "estimated-from-min-heart-rate";
  }
  if (
    dailySummary?.activityHeartRateAvg !== null && dailySummary?.activityHeartRateAvg !== undefined ||
    details.heartRateAvg !== null
  ) {
    return "estimated-from-average-heart-rate";
  }
  return null;
}

function hasDirectWatchHeartRateData(value: DeviceHealthHeartRateSummary) {
  return [
    value.averageBpm,
    value.hrvRmssdMs,
    value.maxBpm,
    value.minBpm,
    value.restingBpm,
  ].some(isMeaningfulDirectWatchNumber);
}

function hasDirectWatchOxygenData(value: DeviceHealthOxygenSaturationSummary) {
  return value.sampleCount > 0 ||
    [
      value.averagePercent,
      value.latestPercent,
      value.maxPercent,
      value.minPercent,
    ].some(isMeaningfulDirectWatchNumber);
}

function hasDirectWatchSleepData(value: DeviceHealthSleepSummary) {
  return Boolean(
    value.startTime ||
      value.endTime ||
      [
        value.awakeMinutes,
        value.deepMinutes,
        value.durationMinutes,
        value.lightMinutes,
        value.remMinutes,
        value.score,
      ].some(isMeaningfulDirectWatchNumber),
  );
}

function normalizeDirectWatchSleepSummary(value: DeviceHealthSleepSummary): DeviceHealthSleepSummary {
  const stageTotal = sumDirectWatchSleepStages(value);
  const windowDuration = getDirectWatchSleepWindowDurationMinutes(value);
  const durationCandidates = [value.durationMinutes, stageTotal, windowDuration]
    .filter(isMeaningfulDirectWatchNumber);
  const bestDuration = durationCandidates.length ? Math.max(...durationCandidates) : value.durationMinutes ?? null;

  return {
    ...value,
    durationMinutes: bestDuration,
  };
}

function sumDirectWatchSleepStages(value: DeviceHealthSleepSummary) {
  const stages = [
    value.awakeMinutes,
    value.deepMinutes,
    value.lightMinutes,
    value.remMinutes,
  ].filter(isMeaningfulDirectWatchNumber);
  return stages.length ? stages.reduce((total, item) => total + item, 0) : null;
}

function getDirectWatchSleepWindowDurationMinutes(value: DeviceHealthSleepSummary) {
  if (!value.startTime || !value.endTime) {
    return null;
  }

  const start = new Date(value.startTime).getTime();
  const end = new Date(value.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return Math.round((end - start) / 60000);
}

function weightedAverageDirectWatchValue(values: Array<{ value?: number | null; weight?: number | null }>) {
  let total = 0;
  let weightTotal = 0;

  for (const item of values) {
    if (typeof item.value !== "number" || !Number.isFinite(item.value)) {
      continue;
    }

    const weight = typeof item.weight === "number" && Number.isFinite(item.weight) && item.weight > 0
      ? item.weight
      : 1;
    total += item.value * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? Math.round(total / weightTotal) : null;
}

function sumDirectWatchNumbers(values: Array<number | null | undefined>) {
  let total = 0;
  let hasValue = false;

  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

function minDirectWatchNumber(values: Array<number | null | undefined>) {
  const numericValues = values.filter(isMeaningfulDirectWatchNumber);
  return numericValues.length ? Math.min(...numericValues) : null;
}

function maxDirectWatchNumber(values: Array<number | null | undefined>) {
  const numericValues = values.filter(isMeaningfulDirectWatchNumber);
  return numericValues.length ? Math.max(...numericValues) : null;
}

function isMeaningfulDirectWatchNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeSleepMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeIsoString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeBluetoothState(value: unknown) {
  const normalized = normalizeString(value);
  return normalized === "bonded" ||
    normalized === "bonding" ||
    normalized === "not-bonded" ||
    normalized === "unknown"
    ? normalized
    : null;
}

function normalizeDeviceType(value: unknown) {
  const normalized = normalizeString(value);
  return normalized === "classic" ||
    normalized === "dual" ||
    normalized === "le" ||
    normalized === "unknown"
    ? normalized
    : null;
}

function normalizeStandardReadingKind(value: unknown) {
  const normalized = normalizeString(value);
  return normalized === "battery" ||
    normalized === "manufacturer" ||
    normalized === "model" ||
    normalized === "serial" ||
    normalized === "firmware" ||
    normalized === "hardware" ||
    normalized === "software" ||
    normalized === "body-sensor" ||
    normalized === "unknown"
    ? normalized
    : null;
}
