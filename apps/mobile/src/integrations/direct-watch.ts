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
  inspectDevice?: (input: { deviceId: string }) => Promise<DirectWatchInspection>;
  isAvailable?: () => Promise<DirectWatchAvailability>;
  pairDevice?: (input: { deviceId: string }) => Promise<DirectWatchPairingResult>;
  requestAuthorization?: () => Promise<DirectWatchPermissionResult>;
  scanDevices?: (input?: { durationMs?: number }) => Promise<DirectWatchScanResult>;
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
