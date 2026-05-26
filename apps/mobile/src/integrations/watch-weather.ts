import type { DirectWatchLocalConfig } from "../storage/local-store.js";

export interface DirectWatchWeatherPayload {
  cityName: string;
  altitude?: number | null;
  current?: DirectWatchWeatherCurrent | null;
  daily?: DirectWatchWeatherDaily[];
  hourly?: DirectWatchWeatherHourly[];
  isCurrentLocation?: boolean;
  latitude?: number;
  locationKey: string;
  locationName: string;
  longitude?: number;
  publicationTimestamp: string;
}

export interface DirectWatchWeatherCurrent {
  aqi?: number | null;
  aqiLabel?: string | null;
  conditionCode: number;
  humidity?: number | null;
  pressureHpa?: number | null;
  temperatureC: number;
  uvIndex?: number | null;
  windDirection?: number | null;
  windSpeedBeaufort?: number | null;
}

export interface DirectWatchWeatherDaily {
  aqi?: number | null;
  aqiLabel?: string | null;
  conditionCode: number;
  sunrise?: string | null;
  sunset?: string | null;
  temperatureMaxC: number;
  temperatureMinC: number;
  uvIndex?: number | null;
}

export interface DirectWatchWeatherHourly {
  aqi?: number | null;
  aqiLabel?: string | null;
  conditionCode: number;
  temperatureC: number;
  uvIndex?: number | null;
  windDirection?: number | null;
  windSpeedBeaufort?: number | null;
}

export interface DirectWatchWeatherLocation {
  city: string;
  country?: string | null;
  latitude: number;
  longitude: number;
}

const DEFAULT_WEATHER_LOCATION: DirectWatchWeatherLocation = {
  city: "Chisinau",
  country: "Moldova",
  latitude: 47.0105,
  longitude: 28.8638,
};
const DEFAULT_WEATHER_LOCATION_KEY = "accu:242405";

export function getDirectWatchWeatherLocation(config: DirectWatchLocalConfig): DirectWatchWeatherLocation {
  const latitude = config.weatherLatitude;
  const longitude = config.weatherLongitude;
  const hasStoredCoordinates = latitude !== null &&
    longitude !== null &&
    !(latitude === 0 && longitude === 0);

  if (!hasStoredCoordinates) {
    return DEFAULT_WEATHER_LOCATION;
  }

  return {
    city: config.weatherCity || DEFAULT_WEATHER_LOCATION.city,
    country: null,
    latitude,
    longitude,
  };
}

export async function resolveDirectWatchWeatherLocation(query: string): Promise<DirectWatchWeatherLocation> {
  const trimmed = query.trim();
  if (!trimmed) {
    return DEFAULT_WEATHER_LOCATION;
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "ru");
  url.searchParams.set("format", "json");

  const response = await fetchWithTimeout(url, 5_000);
  if (!response.ok) {
    throw new Error("Не удалось найти город для погоды.");
  }

  const data = await response.json() as {
    results?: Array<{
      admin1?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      name?: string;
    }>;
  };
  const result = data.results?.[0];
  const latitude = normalizeNumber(result?.latitude);
  const longitude = normalizeNumber(result?.longitude);
  if (!result || latitude === null || longitude === null) {
    throw new Error("Город для погоды не найден.");
  }

  return {
    city: [result.name, result.admin1].filter(Boolean).join(", "),
    country: result.country ?? null,
    latitude,
    longitude,
  };
}

export async function fetchDirectWatchWeatherPayload(
  config: DirectWatchLocalConfig,
): Promise<DirectWatchWeatherPayload> {
  const location = getDirectWatchWeatherLocation(config);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", [
    "temperature_2m",
    "relative_humidity_2m",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "pressure_msl",
  ].join(","));
  url.searchParams.set("hourly", [
    "temperature_2m",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
  ].join(","));
  url.searchParams.set("daily", [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "sunrise",
    "sunset",
  ].join(","));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const [response, airQuality] = await Promise.all([
    fetchWithTimeout(url, 5_000),
    fetchDirectWatchAirQualityPayload(location).catch(() => null),
  ]);
  if (!response.ok) {
    throw new Error("Погодный сервис не ответил.");
  }

  const data = await response.json() as OpenMeteoForecastResponse;
  return {
    altitude: 0,
    cityName: location.city,
    current: buildCurrentWeather(data, airQuality),
    daily: buildDailyWeather(data, airQuality),
    hourly: buildHourlyWeather(data, airQuality),
    isCurrentLocation: true,
    latitude: location.latitude,
    locationKey: buildDirectWatchLocationKey(location),
    locationName: location.city,
    longitude: location.longitude,
    publicationTimestamp: formatDirectWatchPublicationTimestamp(data.current?.time),
  };
}

export function buildDirectWatchWeatherLocationPayload(
  config: DirectWatchLocalConfig,
): DirectWatchWeatherPayload {
  const location = getDirectWatchWeatherLocation(config);
  return {
    altitude: 0,
    cityName: location.city,
    current: null,
    daily: [],
    hourly: [],
    isCurrentLocation: true,
    latitude: location.latitude,
    locationKey: buildDirectWatchLocationKey(location),
    locationName: location.city,
    longitude: location.longitude,
    publicationTimestamp: formatDirectWatchPublicationTimestamp(),
  };
}

function formatDirectWatchPublicationTimestamp(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const offsetMinutes = -safeDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainderMinutes = absoluteOffset % 60;

  return [
    safeDate.getFullYear(),
    pad2(safeDate.getMonth() + 1),
    pad2(safeDate.getDate()),
  ].join("-") +
    `T${pad2(safeDate.getHours())}:${pad2(safeDate.getMinutes())}:${pad2(safeDate.getSeconds())}` +
    `${sign}${pad2(offsetHours)}:${pad2(offsetRemainderMinutes)}`;
}

function formatDirectWatchOptionalTimestamp(value?: string | null) {
  return value ? formatDirectWatchPublicationTimestamp(value) : "";
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function buildDirectWatchLocationKey(location: DirectWatchWeatherLocation) {
  if (
    location.city === DEFAULT_WEATHER_LOCATION.city &&
    location.latitude === DEFAULT_WEATHER_LOCATION.latitude &&
    location.longitude === DEFAULT_WEATHER_LOCATION.longitude
  ) {
    return DEFAULT_WEATHER_LOCATION_KEY;
  }

  return `accu:${Math.abs(javaStringHashCode(location.city)) % 1_000_000}`;
}

function javaStringHashCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

async function fetchDirectWatchAirQualityPayload(
  location: DirectWatchWeatherLocation,
): Promise<OpenMeteoAirQualityResponse> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", ["european_aqi", "uv_index"].join(","));
  url.searchParams.set("hourly", ["european_aqi", "uv_index"].join(","));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const response = await fetchWithTimeout(url, 5_000);
  if (!response.ok) {
    throw new Error("Погодный сервис качества воздуха не ответил.");
  }

  return response.json() as Promise<OpenMeteoAirQualityResponse>;
}

function buildCurrentWeather(
  data: OpenMeteoForecastResponse,
  airQuality: OpenMeteoAirQualityResponse | null,
): DirectWatchWeatherCurrent | null {
  const current = data.current;
  const temperatureC = normalizeNumber(current?.temperature_2m);
  if (!current || temperatureC === null) {
    return null;
  }

  const aqi = normalizeInteger(airQuality?.current?.european_aqi);
  const uvIndex = normalizeInteger(airQuality?.current?.uv_index);
  return {
    aqi,
    aqiLabel: formatEuropeanAqiLabel(aqi),
    conditionCode: mapOpenMeteoCodeToXiaomi(current.weather_code),
    humidity: normalizeInteger(current.relative_humidity_2m),
    pressureHpa: normalizeNumber(current.pressure_msl),
    temperatureC: Math.round(temperatureC),
    uvIndex,
    windDirection: normalizeInteger(current.wind_direction_10m),
    windSpeedBeaufort: kmhToBeaufort(current.wind_speed_10m),
  };
}

function buildDailyWeather(
  data: OpenMeteoForecastResponse,
  airQuality: OpenMeteoAirQualityResponse | null,
): DirectWatchWeatherDaily[] {
  const daily = data.daily;
  if (!daily?.time?.length) {
    return [];
  }

  const dailyAqi = aggregateHourlyDailyMax(airQuality, "european_aqi");
  const dailyUv = aggregateHourlyDailyMax(airQuality, "uv_index");

  return daily.time.map((date, index) => {
    const aqi = normalizeInteger(dailyAqi.get(date));
    return {
      aqi,
      aqiLabel: formatEuropeanAqiLabel(aqi),
      conditionCode: mapOpenMeteoCodeToXiaomi(daily.weather_code?.[index]),
      sunrise: formatDirectWatchOptionalTimestamp(daily.sunrise?.[index]),
      sunset: formatDirectWatchOptionalTimestamp(daily.sunset?.[index]),
      temperatureMaxC: Math.round(daily.temperature_2m_max?.[index] ?? 0),
      temperatureMinC: Math.round(daily.temperature_2m_min?.[index] ?? 0),
      uvIndex: normalizeInteger(dailyUv.get(date)),
    };
  });
}

function buildHourlyWeather(
  data: OpenMeteoForecastResponse,
  airQuality: OpenMeteoAirQualityResponse | null,
): DirectWatchWeatherHourly[] {
  const hourly = data.hourly;
  if (!hourly?.time?.length) {
    return [];
  }

  const now = Date.now();
  const firstFutureIndex = hourly.time.findIndex((value) => new Date(value).getTime() >= now - 60 * 60 * 1000);
  const start = firstFutureIndex >= 0 ? firstFutureIndex : 0;
  return hourly.time.slice(start, start + 24).map((_, offset) => {
    const index = start + offset;
    const airIndex = airQuality?.hourly?.time?.indexOf(hourly.time?.[index] ?? "") ?? -1;
    const aqi = airIndex >= 0 ? normalizeInteger(airQuality?.hourly?.european_aqi?.[airIndex]) : null;
    return {
      aqi,
      aqiLabel: formatEuropeanAqiLabel(aqi),
      conditionCode: mapOpenMeteoCodeToXiaomi(hourly.weather_code?.[index]),
      temperatureC: Math.round(hourly.temperature_2m?.[index] ?? 0),
      uvIndex: airIndex >= 0 ? normalizeInteger(airQuality?.hourly?.uv_index?.[airIndex]) : null,
      windDirection: normalizeInteger(hourly.wind_direction_10m?.[index]),
      windSpeedBeaufort: kmhToBeaufort(hourly.wind_speed_10m?.[index]),
    };
  });
}

function aggregateHourlyDailyMax(
  data: OpenMeteoAirQualityResponse | null,
  key: "european_aqi" | "uv_index",
) {
  const result = new Map<string, number>();
  const times = data?.hourly?.time ?? [];
  const values = data?.hourly?.[key] ?? [];

  times.forEach((time, index) => {
    const date = time.split("T")[0];
    const value = normalizeNumber(values[index]);
    if (!date || value === null) {
      return;
    }
    const previous = result.get(date);
    if (previous === undefined || value > previous) {
      result.set(date, value);
    }
  });

  return result;
}

function formatEuropeanAqiLabel(value: number | null) {
  if (value === null) return "Нет данных";
  if (value <= 20) return "Хорошо";
  if (value <= 40) return "Норма";
  if (value <= 60) return "Средне";
  if (value <= 80) return "Плохо";
  if (value <= 100) return "Очень плохо";
  return "Опасно";
}

function mapOpenMeteoCodeToXiaomi(code: unknown) {
  const value = Number(code);
  if (value === 0) return 0;
  if (value === 1 || value === 2) return 1;
  if (value === 3) return 2;
  if (value === 45 || value === 48) return 18;
  if (value === 51 || value === 53 || value === 56 || value === 61) return 7;
  if (value === 55 || value === 63) return 8;
  if (value === 57 || value === 66 || value === 67) return 19;
  if (value === 65) return 10;
  if (value === 71) return 14;
  if (value === 73 || value === 77) return 15;
  if (value === 75) return 16;
  if (value === 80) return 3;
  if (value === 81) return 8;
  if (value === 82) return 9;
  if (value === 85) return 13;
  if (value === 86) return 16;
  if (value === 95) return 4;
  if (value === 96 || value === 99) return 5;
  return 0;
}

function kmhToBeaufort(value: unknown) {
  const speed = normalizeNumber(value);
  if (speed === null) return null;
  if (speed < 1) return 0;
  if (speed < 6) return 1;
  if (speed < 12) return 2;
  if (speed < 20) return 3;
  if (speed < 29) return 4;
  if (speed < 39) return 5;
  if (speed < 50) return 6;
  if (speed < 62) return 7;
  if (speed < 75) return 8;
  if (speed < 89) return 9;
  if (speed < 103) return 10;
  if (speed < 118) return 11;
  return 12;
}

function normalizeInteger(value: unknown) {
  const numberValue = normalizeNumber(value);
  return numberValue === null ? null : Math.round(numberValue);
}

function normalizeNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function fetchWithTimeout(url: URL, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: number | null = null;
  try {
    return await Promise.race([
      fetch(url, { signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = window.setTimeout(() => {
          controller.abort();
          reject(new Error("погодный сервис не ответил за 5 секунд"));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("погодный сервис не ответил за 5 секунд");
    }
    throw error;
  } finally {
    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
  }
}

interface OpenMeteoForecastResponse {
  current?: {
    pressure_msl?: number;
    relative_humidity_2m?: number;
    temperature_2m?: number;
    time?: string;
    weather_code?: number;
    wind_direction_10m?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    time?: string[];
    weather_code?: number[];
  };
  hourly?: {
    temperature_2m?: number[];
    time?: string[];
    weather_code?: number[];
    wind_direction_10m?: number[];
    wind_speed_10m?: number[];
  };
}

interface OpenMeteoAirQualityResponse {
  current?: {
    european_aqi?: number;
    uv_index?: number;
  };
  hourly?: {
    european_aqi?: number[];
    time?: string[];
    uv_index?: number[];
  };
}
