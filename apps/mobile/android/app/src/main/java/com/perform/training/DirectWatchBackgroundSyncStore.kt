package com.perform.training

import android.content.Context
import android.util.Log
import com.getcapacitor.JSObject
import java.io.File
import java.time.Instant

object DirectWatchBackgroundSyncStore {
    private const val TAG = "DirectWatchBgSync"
    private const val DIR_NAME = "direct_watch_background_sync"
    private const val LATEST_FILE_NAME = "latest.json"
    private const val PREFS_NAME = "perform.direct_watch_background_sync"
    private const val KEY_AVAILABLE = "available"
    private const val KEY_DEVICE_ID = "deviceId"
    private const val KEY_ENTRY_DATE = "entryDate"
    private const val KEY_REASON = "reason"
    private const val KEY_UPDATED_AT = "updatedAt"
    private const val KEY_MESSAGE = "message"
    private const val KEY_DATA_UPDATED_AT = "dataUpdatedAt"
    private const val KEY_SERVICE_UPDATED_AT = "serviceUpdatedAt"
    private const val KEY_TIME_UPDATED_AT = "timeUpdatedAt"
    private const val KEY_WEATHER_UPDATED_AT = "weatherUpdatedAt"
    private const val KEY_SERVICE_MESSAGE = "serviceMessage"

    fun saveLatest(
        context: Context,
        result: JSObject,
        deviceId: String?,
        entryDate: String?,
        reason: String,
    ): JSObject {
        val appContext = context.applicationContext
        val savedAt = Instant.now().toString()
        val copy = JSObject(result.toString())
        copy.put("backgroundAvailable", true)
        copy.put("backgroundDeviceId", deviceId)
        copy.put("backgroundEntryDate", entryDate)
        copy.put("backgroundReason", reason)
        copy.put("backgroundSavedAt", savedAt)

        return try {
            latestFile(appContext).writeText(copy.toString())
            val editor = prefs(appContext).edit()
                .putBoolean(KEY_AVAILABLE, true)
                .putString(KEY_DEVICE_ID, deviceId)
                .putString(KEY_ENTRY_DATE, entryDate)
                .putString(KEY_REASON, reason)
                .putString(KEY_UPDATED_AT, savedAt)
                .putString(KEY_DATA_UPDATED_AT, savedAt)
                .putString(KEY_MESSAGE, "Фоновая синхронизация часов сохранена.")
            putServiceSyncState(editor, result, savedAt)
            editor.apply()
            status(appContext)
        } catch (error: Exception) {
            Log.w(TAG, "failed to save background watch sync: ${error.message}")
            prefs(appContext).edit()
                .putBoolean(KEY_AVAILABLE, false)
                .putString(KEY_DEVICE_ID, deviceId)
                .putString(KEY_ENTRY_DATE, entryDate)
                .putString(KEY_REASON, reason)
                .putString(KEY_UPDATED_AT, savedAt)
                .putString(KEY_MESSAGE, "Не удалось сохранить фоновую синхронизацию: ${error.message}")
                .apply()
            status(appContext)
        }
    }

    fun readLatest(context: Context): JSObject? {
        val file = latestFile(context.applicationContext)
        if (!file.exists()) {
            return null
        }

        return try {
            val result = JSObject(file.readText())
            normalizeAuthenticatedBackgroundResult(result)
            result
        } catch (error: Exception) {
            Log.w(TAG, "failed to read background watch sync: ${error.message}")
            null
        }
    }

    fun clearLatest(context: Context): JSObject {
        val appContext = context.applicationContext
        try {
            latestFile(appContext).delete()
        } catch (_: Exception) {
            // Best effort cleanup.
        }
        prefs(appContext).edit()
            .putBoolean(KEY_AVAILABLE, false)
            .putString(KEY_MESSAGE, "Фоновая синхронизация обработана.")
            .putString(KEY_UPDATED_AT, Instant.now().toString())
            .apply()
        return status(appContext)
    }

    fun recordMessage(
        context: Context,
        deviceId: String?,
        entryDate: String?,
        reason: String,
        message: String,
        available: Boolean = false,
    ): JSObject {
        prefs(context.applicationContext).edit()
            .putBoolean(KEY_AVAILABLE, available)
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_ENTRY_DATE, entryDate)
            .putString(KEY_REASON, reason)
            .putString(KEY_UPDATED_AT, Instant.now().toString())
            .putString(KEY_MESSAGE, message)
            .apply()
        return status(context.applicationContext)
    }

    fun recordServiceSync(
        context: Context,
        result: JSObject,
        deviceId: String?,
        entryDate: String?,
        reason: String,
        message: String = "Время и погода отправлены на часы.",
    ): JSObject {
        val appContext = context.applicationContext
        val savedAt = Instant.now().toString()
        val editor = prefs(appContext).edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_ENTRY_DATE, entryDate)
            .putString(KEY_REASON, reason)
            .putString(KEY_UPDATED_AT, savedAt)
            .putString(KEY_SERVICE_UPDATED_AT, savedAt)
            .putString(KEY_SERVICE_MESSAGE, message)
        putServiceSyncState(editor, result, savedAt)
        editor.apply()
        return status(appContext)
    }

    fun status(context: Context): JSObject {
        val appContext = context.applicationContext
        val prefs = prefs(appContext)
        val response = JSObject()
        response.put("available", prefs.getBoolean(KEY_AVAILABLE, false) && latestFile(appContext).exists())
        response.put("deviceId", prefs.getString(KEY_DEVICE_ID, null))
        response.put("entryDate", prefs.getString(KEY_ENTRY_DATE, null))
        response.put("reason", prefs.getString(KEY_REASON, null))
        response.put("updatedAt", prefs.getString(KEY_UPDATED_AT, null))
        response.put("dataUpdatedAt", prefs.getString(KEY_DATA_UPDATED_AT, null))
        response.put("serviceUpdatedAt", prefs.getString(KEY_SERVICE_UPDATED_AT, null))
        response.put("timeUpdatedAt", prefs.getString(KEY_TIME_UPDATED_AT, null))
        response.put("weatherUpdatedAt", prefs.getString(KEY_WEATHER_UPDATED_AT, null))
        response.put("message", prefs.getString(KEY_MESSAGE, null))
        response.put("serviceMessage", prefs.getString(KEY_SERVICE_MESSAGE, null))
        return response
    }

    private fun putServiceSyncState(
        editor: android.content.SharedPreferences.Editor,
        result: JSObject,
        savedAt: String,
    ) {
        val sentTime = sentTime(result)
        val sentWeather = sentWeather(result)
        if (sentTime) {
            editor.putString(KEY_TIME_UPDATED_AT, savedAt)
        }
        if (sentWeather) {
            editor.putString(KEY_WEATHER_UPDATED_AT, savedAt)
        }
        if (sentService(result)) {
            val message = when {
                sentTime && sentWeather -> "Время и погода отправлены на часы."
                sentWeather -> "Погода отправлена на часы."
                sentTime -> "Время отправлено на часы."
                else -> "Служебная синхронизация часов выполнена."
            }
            editor.putString(KEY_SERVICE_UPDATED_AT, savedAt)
            editor.putString(KEY_SERVICE_MESSAGE, message)
        }
    }

    private fun sentService(result: JSObject): Boolean {
        return sentTime(result) || sentWeather(result) || result.optBoolean("sentPhoneLocation", false)
    }

    private fun sentTime(result: JSObject): Boolean {
        return result.optBoolean("sentTime", false) || serviceCommands(result).any { it == "time" || it == "time-refresh" }
    }

    private fun sentWeather(result: JSObject): Boolean {
        return result.optBoolean("sentWeatherCurrent", false) ||
            result.optBoolean("sentWeatherDaily", false) ||
            result.optBoolean("sentWeatherHourly", false) ||
            serviceCommands(result).any {
                it == "weather-current" ||
                    it == "weather-daily" ||
                    it == "weather-hourly" ||
                    it == "weather-current-refresh" ||
                    it == "weather-daily-refresh" ||
                    it == "weather-hourly-refresh"
            }
    }

    private fun serviceCommands(result: JSObject): List<String> {
        val commands = result.optJSONArray("serviceCommands") ?: return emptyList()
        return (0 until commands.length()).mapNotNull { index ->
            commands.optString(index, "").takeIf { it.isNotBlank() }
        }
    }

    private fun latestFile(context: Context): File {
        val dir = File(context.filesDir, DIR_NAME)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return File(dir, LATEST_FILE_NAME)
    }

    private fun normalizeAuthenticatedBackgroundResult(result: JSObject) {
        if (
            result.optBoolean("backgroundSync", false) &&
            result.optBoolean("sentAuthStep2", false) &&
            result.optString("authKeyStatus", "") != "valid"
        ) {
            result.put("authKeyStatus", "valid")
            result.put("authStage", "authenticated")
        }
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
