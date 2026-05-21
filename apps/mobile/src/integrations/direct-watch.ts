import type {
  DeviceHealthDailySummaryPayload,
  DeviceHealthHeartRateSummary,
  DeviceHealthOxygenSaturationSummary,
  DeviceHealthSleepSummary,
} from "../types/models.js";
import type { DirectWatchWeatherPayload } from "./watch-weather.js";

const DIRECT_WATCH_TIME_OFFSET_MINUTES = -90;

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
  activityFilePayloadBytes?: number | null;
  activityFiles?: DirectWatchActivityFile[];
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
  activityFileProbeCount?: number | null;
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
  sentPostAuthProbe?: boolean;
  sentSessionConfig?: boolean;
  sentVersionRequest?: boolean;
  versionHex?: string | null;
  watchHmacHex?: string | null;
  watchNonceHex?: string | null;
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
  bridgeUntil?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  message?: string | null;
  running?: boolean;
  updatedAt?: string | null;
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
    eventName: "directWatchPacket" | "directWatchSession",
    listenerFunc: (event: unknown) => void,
  ) => Promise<DirectWatchListenerHandle> | DirectWatchListenerHandle;
  getSessionStatus?: () => Promise<DirectWatchSessionStatus>;
  inspectDevice?: (input: { deviceId: string }) => Promise<DirectWatchInspection>;
  isAvailable?: () => Promise<DirectWatchAvailability>;
  pairDevice?: (input: { deviceId: string }) => Promise<DirectWatchPairingResult>;
  probeClassicSession?: (input: { authKeyHex?: string; authStep1?: boolean; deviceId: string; postAuthProbe?: boolean }) => Promise<DirectWatchClassicProbe>;
  requestAuthorization?: () => Promise<DirectWatchPermissionResult>;
  scanDevices?: (input?: { durationMs?: number }) => Promise<DirectWatchScanResult>;
  startSession?: (input: { deviceId: string }) => Promise<DirectWatchSessionStatus>;
  stopSession?: () => Promise<DirectWatchSessionStatus>;
  getSyncServiceStatus?: () => Promise<DirectWatchSyncServiceStatus>;
  stopSyncService?: () => Promise<DirectWatchSyncServiceStatus>;
  syncService?: (input: {
    authKeyHex: string;
    deviceId: string;
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

export async function stopDirectWatchSyncService(): Promise<DirectWatchSyncServiceStatus> {
  const plugin = getDirectWatchPlugin();

  if (!plugin?.stopSyncService) {
    throw new Error("Служебный режим часов доступен только в Android-сборке PERFORM.");
  }

  const status = await plugin.stopSyncService();
  return normalizeDirectWatchSyncServiceStatus(status);
}

export async function probeDirectWatchClassicSession(
  deviceId: string,
  authStep1 = false,
  authKeyHex?: string,
  postAuthProbe = false,
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

  const probe = await plugin.probeClassicSession({ authKeyHex, authStep1, deviceId, postAuthProbe });
  return normalizeDirectWatchClassicProbe(probe);
}

export async function syncDirectWatchService(
  deviceId: string,
  authKeyHex: string,
  weather?: DirectWatchWeatherPayload | null,
  keepAliveMs?: number,
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
  const probe = await probeDirectWatchClassicSession(deviceId, true, authKeyHex, true);

  if (probe.authKeyStatus !== "valid" || !probe.sentActivityFileProbe) {
    throw new Error(probe.authKeyError || probe.error || "PERFORM Sync не смог авторизоваться на часах.");
  }

  const packets = (probe.decryptedPackets ?? []).filter(hasDirectWatchActivityFile);
  const activityPackets = packets.filter((packet) =>
    getDirectWatchActivityEntryDate(packet.activityFile) === entryDate,
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
  const minuteDetails = activityPackets.filter((packet) =>
    packet.activityFile?.type === 0 &&
    packet.activityFile.subtype === 0 &&
    packet.activityFile.detailType === 0,
  );
  const detailAggregate = aggregateDirectWatchMinuteDetails(minuteDetails);
  const heartRate = buildDirectWatchHeartRateSummary(dailySummary, detailAggregate);
  const oxygenSaturation = buildDirectWatchOxygenSummary(dailySummary, detailAggregate);
  const sleep = buildDirectWatchSleepSummary(sleepPackets);

  if (!sleep && !heartRate && !oxygenSaturation && !dailySummary) {
    throw new Error("PERFORM Sync прочитал день, но пока не нашёл сон, пульс, SpO2 или итоговые показатели.");
  }

  return {
    entryDate,
    provider: "direct-watch",
    sourceDevice: probe.deviceName || "Redmi Watch / PERFORM Sync",
    sleep,
    heartRate,
    oxygenSaturation,
    workout: null,
    rawPayload: buildDirectWatchRawPayload(probe, dayPackets, dailySummary, detailAggregate),
    syncedAt: new Date().toISOString(),
  };
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
    activityFileProbeCount: normalizeNumber(value.activityFileProbeCount),
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

function normalizeDirectWatchSyncServiceStatus(value: unknown): DirectWatchSyncServiceStatus {
  if (!isRecord(value)) {
    return { running: false };
  }

  return {
    bridgeUntil: normalizeString(value.bridgeUntil),
    deviceId: normalizeString(value.deviceId),
    deviceName: normalizeString(value.deviceName),
    message: normalizeString(value.message),
    running: Boolean(value.running),
    updatedAt: normalizeString(value.updatedAt),
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
    activityFilePayloadBytes: normalizeNumber(value.activityFilePayloadBytes),
    activityFiles: Array.isArray(value.activityFiles)
      ? value.activityFiles.map(normalizeDirectWatchActivityFile)
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

function aggregateDirectWatchMinuteDetails(packets: DirectWatchDecryptedPacket[]): DirectWatchMinuteAggregate {
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

function buildDirectWatchHeartRateSummary(
  dailySummary: DirectWatchDecryptedPacket | null,
  details: DirectWatchMinuteAggregate,
): DeviceHealthHeartRateSummary | null {
  const heartRate: DeviceHealthHeartRateSummary = {
    averageBpm: dailySummary?.activityHeartRateAvg ?? details.heartRateAvg,
    hrvRmssdMs: null,
    maxBpm: dailySummary?.activityHeartRateMax ?? details.heartRateMax,
    minBpm: dailySummary?.activityHeartRateMin ?? details.heartRateMin,
    restingBpm: dailySummary?.activityHeartRateResting ?? null,
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
  const sleepPacket = pickLatestDirectWatchPacket(packets, (packet) =>
    (packet.activityFile?.subtype === 8 || packet.activityFile?.subtype === 3) &&
    Boolean(packet.sleepDurationMinutes || packet.sleepStartTime || packet.sleepEndTime),
  );

  if (!sleepPacket) {
    return null;
  }

  const sleep: DeviceHealthSleepSummary = {
    awakeMinutes: normalizeSleepMetric(sleepPacket.sleepAwakeMinutes),
    deepMinutes: normalizeSleepMetric(sleepPacket.sleepDeepMinutes),
    durationMinutes: normalizeSleepMetric(sleepPacket.sleepDurationMinutes),
    endTime: normalizeIsoString(sleepPacket.sleepEndTime),
    lightMinutes: normalizeSleepMetric(sleepPacket.sleepLightMinutes),
    remMinutes: normalizeSleepMetric(sleepPacket.sleepRemMinutes),
    score: normalizeSleepMetric(sleepPacket.sleepScore),
    startTime: normalizeIsoString(sleepPacket.sleepStartTime),
  };

  return hasDirectWatchSleepData(sleep) ? sleep : null;
}

function buildDirectWatchRawPayload(
  probe: DirectWatchClassicProbe,
  dayPackets: DirectWatchDecryptedPacket[],
  dailySummary: DirectWatchDecryptedPacket | null,
  details: DirectWatchMinuteAggregate,
): Record<string, unknown> {
  return {
    activityFileProbeCount: probe.activityFileProbeCount ?? 0,
    authKeyStatus: probe.authKeyStatus ?? null,
    dataOrigin: "PERFORM Sync",
    fileCount: dayPackets.length,
    calories: dailySummary?.activityCalories ?? null,
    steps: dailySummary?.activitySteps ?? details.steps,
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
