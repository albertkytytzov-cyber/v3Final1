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
  id: string;
  name?: string | null;
  rssi?: number | null;
  isLikelyWatch?: boolean;
}

export interface DirectWatchCharacteristic {
  uuid: string;
  name?: string | null;
  properties?: string[];
}

export interface DirectWatchService {
  uuid: string;
  name?: string | null;
  characteristics?: DirectWatchCharacteristic[];
}

export interface DirectWatchInspection {
  deviceId: string;
  deviceName?: string | null;
  hasBatteryService?: boolean;
  hasDeviceInfoService?: boolean;
  hasHeartRateService?: boolean;
  inspectedAt?: string | null;
  serviceCount?: number;
  services?: DirectWatchService[];
}

export interface DirectWatchScanResult {
  devices: DirectWatchDevice[];
  scannedAt?: string | null;
}

interface DirectWatchPlugin {
  inspectDevice?: (input: { deviceId: string }) => Promise<DirectWatchInspection>;
  isAvailable?: () => Promise<DirectWatchAvailability>;
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

function getDirectWatchPlugin() {
  return (globalThis as CapacitorWithDirectWatch).Capacitor?.Plugins?.DirectWatch ?? null;
}

function normalizeDirectWatchDevice(value: unknown): DirectWatchDevice {
  if (!isRecord(value)) {
    return { id: "" };
  }

  return {
    id: normalizeString(value.id) ?? "",
    isLikelyWatch: typeof value.isLikelyWatch === "boolean" ? value.isLikelyWatch : false,
    name: normalizeString(value.name),
    rssi: normalizeNumber(value.rssi),
  };
}

function normalizeDirectWatchInspection(value: unknown): DirectWatchInspection {
  if (!isRecord(value)) {
    return { deviceId: "" };
  }

  return {
    deviceId: normalizeString(value.deviceId) ?? "",
    deviceName: normalizeString(value.deviceName),
    hasBatteryService: normalizeBoolean(value.hasBatteryService),
    hasDeviceInfoService: normalizeBoolean(value.hasDeviceInfoService),
    hasHeartRateService: normalizeBoolean(value.hasHeartRateService),
    inspectedAt: normalizeString(value.inspectedAt),
    serviceCount: normalizeNumber(value.serviceCount) ?? 0,
    services: Array.isArray(value.services)
      ? value.services.map(normalizeDirectWatchService)
      : [],
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
