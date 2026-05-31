package com.perform.training

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.Intent
import com.getcapacitor.JSObject
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet

object DirectWatchSyncCoordinator {
    fun interface Listener {
        fun onDirectWatchSyncRequested(request: JSObject)
    }

    data class NativeSyncConfig(
        val deviceId: String,
        val deviceName: String?,
        val authKeyHex: String,
        val weatherPayloadJson: String?,
        val enabled: Boolean,
    )

    private const val PREFS_NAME = "perform.direct_watch_sync_coordinator"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_DEVICE_ID = "deviceId"
    private const val KEY_DEVICE_NAME = "deviceName"
    private const val KEY_AUTH_KEY_HEX = "authKeyHex"
    private const val KEY_WEATHER_PAYLOAD_JSON = "weatherPayloadJson"
    private const val KEY_PENDING_REQUEST_ID = "pendingRequestId"
    private const val KEY_PENDING_REASON = "pendingReason"
    private const val KEY_PENDING_ENTRY_DATE = "pendingEntryDate"
    private const val KEY_PENDING_CREATED_AT = "pendingCreatedAt"
    private const val KEY_LAST_REQUESTED_AT = "lastRequestedAt"
    private const val KEY_LAST_HANDLED_AT = "lastHandledAt"
    private const val KEY_LAST_COMPLETED_AT = "lastCompletedAt"
    private const val KEY_LAST_SUCCESSFUL_AT = "lastSuccessfulAt"
    private const val KEY_LAST_REASON = "lastReason"
    private const val KEY_LAST_OUTCOME = "lastOutcome"
    private const val KEY_LAST_BLOCKED_REASON = "lastBlockedReason"
    private const val KEY_LAST_EVENT_AT = "lastEventAt"

    private const val QUICK_THROTTLE_MS = 2_500L
    private const val FAILURE_BACKOFF_MS = 5 * 60 * 1000L
    private const val AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000L
    private const val PENDING_REQUEST_TTL_MS = 10 * 60 * 1000L

    const val REASON_APP_VISIBLE = "app-visible"
    const val REASON_BLUETOOTH_RECONNECT = "bluetooth-reconnect"
    const val REASON_BLUETOOTH_ON = "bluetooth-on"
    const val REASON_BOOT = "boot"
    const val REASON_PACKAGE_REPLACED = "package-replaced"
    const val REASON_SERVICE_START = "service-start"
    const val REASON_SERVICE_TIMER = "service-timer"
    const val REASON_USER_PRESENT = "user-present"

    private val listeners = CopyOnWriteArraySet<Listener>()

    fun addListener(context: Context, listener: Listener) {
        listeners.add(listener)
        val appContext = context.applicationContext
        val prefs = prefs(appContext)
        if (isPendingStale(prefs, System.currentTimeMillis())) {
            clearPending(prefs)
            return
        }
        pendingRequest(appContext)?.let { listener.onDirectWatchSyncRequested(it) }
    }

    fun removeListener(listener: Listener) {
        listeners.remove(listener)
    }

    fun configure(
        context: Context,
        deviceId: String?,
        deviceName: String?,
        authKeyHex: String?,
        weatherPayloadJson: String? = null,
        enabled: Boolean = true,
    ): JSObject {
        val normalizedDeviceId = deviceId?.trim()?.takeIf { it.isNotBlank() }
        val normalizedAuthKey = authKeyHex?.trim()?.lowercase()?.takeIf { it.matches(Regex("^[0-9a-f]{32}$")) }
        val editor = prefs(context).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putString(KEY_DEVICE_ID, normalizedDeviceId)
            .putString(KEY_DEVICE_NAME, deviceName?.trim()?.takeIf { it.isNotBlank() })
            .putString(KEY_AUTH_KEY_HEX, normalizedAuthKey)
            .putString(KEY_LAST_EVENT_AT, Instant.now().toString())

        val normalizedWeatherPayload = weatherPayloadJson?.trim()?.takeIf { it.isNotBlank() }
        if (normalizedWeatherPayload != null) {
            editor.putString(KEY_WEATHER_PAYLOAD_JSON, normalizedWeatherPayload)
        }
        if (!enabled || normalizedDeviceId == null || normalizedAuthKey == null) {
            editor.putString(KEY_WEATHER_PAYLOAD_JSON, null)
        }
        editor.apply()

        if (enabled && normalizedDeviceId != null && normalizedAuthKey != null) {
            DirectWatchSyncAlarmScheduler.schedule(context, 30_000L)
        } else {
            DirectWatchSyncAlarmScheduler.cancel(context)
        }

        return status(context)
    }

    fun status(context: Context): JSObject {
        val prefs = prefs(context)
        val nowMs = System.currentTimeMillis()
        val pendingCreatedMs = parseInstantMs(prefs.getString(KEY_PENDING_CREATED_AT, null))
        val gate = nextGate(prefs, nowMs)
        val response = JSObject()
        response.put("enabled", prefs.getBoolean(KEY_ENABLED, false))
        response.put("configured", isConfigured(context))
        response.put("deviceId", prefs.getString(KEY_DEVICE_ID, null))
        response.put("deviceName", prefs.getString(KEY_DEVICE_NAME, null))
        response.put("hasAuthKey", !prefs.getString(KEY_AUTH_KEY_HEX, null).isNullOrBlank())
        response.put("hasWeatherPayload", !prefs.getString(KEY_WEATHER_PAYLOAD_JSON, null).isNullOrBlank())
        response.put("pendingRequestId", prefs.getString(KEY_PENDING_REQUEST_ID, null))
        response.put("pendingReason", prefs.getString(KEY_PENDING_REASON, null))
        response.put("pendingEntryDate", prefs.getString(KEY_PENDING_ENTRY_DATE, null))
        response.put("pendingCreatedAt", prefs.getString(KEY_PENDING_CREATED_AT, null))
        response.put("lastRequestedAt", prefs.getString(KEY_LAST_REQUESTED_AT, null))
        response.put("lastHandledAt", prefs.getString(KEY_LAST_HANDLED_AT, null))
        response.put("lastCompletedAt", prefs.getString(KEY_LAST_COMPLETED_AT, null))
        response.put("lastSuccessfulAt", prefs.getString(KEY_LAST_SUCCESSFUL_AT, null))
        response.put("lastReason", prefs.getString(KEY_LAST_REASON, null))
        response.put("lastOutcome", prefs.getString(KEY_LAST_OUTCOME, null))
        response.put("lastBlockedReason", prefs.getString(KEY_LAST_BLOCKED_REASON, null))
        response.put("lastEventAt", prefs.getString(KEY_LAST_EVENT_AT, null))
        response.put("intervalMs", AUTO_SYNC_INTERVAL_MS)
        response.put("failureBackoffMs", FAILURE_BACKOFF_MS)
        response.put("pendingTtlMs", PENDING_REQUEST_TTL_MS)
        response.put("pendingAgeMs", pendingCreatedMs?.let { (nowMs - it).coerceAtLeast(0) })
        response.put("nextAllowedAt", gate.nextAllowedAtMs?.let { Instant.ofEpochMilli(it).toString() })
        response.put("nextAllowedReason", gate.reason)
        response.put("retryAfterMs", gate.nextAllowedAtMs?.let { (it - nowMs).coerceAtLeast(0) } ?: 0)
        return response
    }

    fun nativeSyncConfig(context: Context): NativeSyncConfig? {
        val prefs = prefs(context)
        if (!prefs.getBoolean(KEY_ENABLED, false)) {
            return null
        }
        val deviceId = prefs.getString(KEY_DEVICE_ID, null)?.trim()?.takeIf { it.isNotBlank() }
            ?: return null
        val authKeyHex = prefs.getString(KEY_AUTH_KEY_HEX, null)?.trim()?.takeIf { it.isNotBlank() }
            ?: return null
        return NativeSyncConfig(
            deviceId = deviceId,
            deviceName = prefs.getString(KEY_DEVICE_NAME, null),
            authKeyHex = authKeyHex,
            weatherPayloadJson = prefs.getString(KEY_WEATHER_PAYLOAD_JSON, null),
            enabled = true,
        )
    }

    fun updateWeatherPayload(context: Context, weatherPayloadJson: String?): JSObject {
        val normalizedWeatherPayload = weatherPayloadJson?.trim()?.takeIf { it.isNotBlank() }
            ?: return status(context)
        prefs(context).edit()
            .putString(KEY_WEATHER_PAYLOAD_JSON, normalizedWeatherPayload)
            .putString(KEY_LAST_EVENT_AT, Instant.now().toString())
            .apply()
        return status(context)
    }

    fun markHandled(context: Context, requestId: String?, outcome: String?): JSObject {
        val prefs = prefs(context)
        val activeRequestId = prefs.getString(KEY_PENDING_REQUEST_ID, null)
        val shouldClear = requestId.isNullOrBlank() || activeRequestId == null || activeRequestId == requestId
        val normalizedOutcome = normalizeOutcome(outcome, "handled")
        val now = Instant.now().toString()
        val editor = prefs.edit()
            .putString(KEY_LAST_HANDLED_AT, now)
            .putString(KEY_LAST_COMPLETED_AT, now)
            .putString(KEY_LAST_OUTCOME, normalizedOutcome)
            .putString(KEY_LAST_BLOCKED_REASON, null)

        if (isSuccessfulOutcome(normalizedOutcome)) {
            editor.putString(KEY_LAST_SUCCESSFUL_AT, now)
        }

        if (shouldClear) {
            editor
                .putString(KEY_PENDING_REQUEST_ID, null)
                .putString(KEY_PENDING_REASON, null)
                .putString(KEY_PENDING_ENTRY_DATE, null)
                .putString(KEY_PENDING_CREATED_AT, null)
        }

        editor.apply()
        return status(context)
    }

    fun markCompleted(context: Context, outcome: String?): JSObject {
        val normalizedOutcome = normalizeOutcome(outcome, "completed")
        val now = Instant.now().toString()
        val editor = prefs(context).edit()
            .putString(KEY_LAST_COMPLETED_AT, now)
            .putString(KEY_LAST_OUTCOME, normalizedOutcome)
            .putString(KEY_LAST_BLOCKED_REASON, null)

        if (isSuccessfulOutcome(normalizedOutcome)) {
            editor.putString(KEY_LAST_SUCCESSFUL_AT, now)
        }

        editor.apply()
        return status(context)
    }

    fun noteSyncStarted(context: Context, reason: String): JSObject {
        val now = Instant.now().toString()
        prefs(context).edit()
            .putString(KEY_LAST_REQUESTED_AT, now)
            .putString(KEY_LAST_HANDLED_AT, now)
            .putString(KEY_LAST_REASON, reason)
            .putString(KEY_LAST_OUTCOME, "started")
            .putString(KEY_LAST_BLOCKED_REASON, null)
            .apply()
        return status(context)
    }

    fun requestSync(
        context: Context,
        reason: String,
        force: Boolean = false,
        sourceDeviceId: String? = null,
    ): JSObject {
        val appContext = context.applicationContext
        val prefs = prefs(appContext)
        val nowMs = System.currentTimeMillis()
        val now = Instant.ofEpochMilli(nowMs).toString()
        val normalizedReason = reason.trim().takeIf { it.isNotBlank() } ?: "unknown"
        val configuredDeviceId = prefs.getString(KEY_DEVICE_ID, null)

        fun blocked(blockedReason: String): JSObject {
            prefs.edit()
                .putString(KEY_LAST_BLOCKED_REASON, blockedReason)
                .putString(KEY_LAST_EVENT_AT, now)
                .apply()
            val response = status(appContext)
            response.put("requested", false)
            response.put("reason", normalizedReason)
            response.put("blockedReason", blockedReason)
            return response
        }

        if (!prefs.getBoolean(KEY_ENABLED, false)) {
            return blocked("disabled")
        }

        if (!isConfigured(appContext)) {
            return blocked("missing-config")
        }

        if (!force) {
            pendingRequest(appContext)?.let { pending ->
                if (!isPendingStale(prefs, nowMs)) {
                    prefs.edit()
                        .putString(KEY_LAST_EVENT_AT, now)
                        .putString(KEY_LAST_BLOCKED_REASON, null)
                        .apply()
                    notifyListeners(pending)
                    pending.put("pending", true)
                    return pending
                }

                clearPending(prefs)
            }
        }

        if (
            !sourceDeviceId.isNullOrBlank() &&
            !configuredDeviceId.isNullOrBlank() &&
            !sourceDeviceId.equals(configuredDeviceId, ignoreCase = true)
        ) {
            return blocked("other-device")
        }

        val lastRequestedMs = parseInstantMs(prefs.getString(KEY_LAST_REQUESTED_AT, null))
        if (!force && lastRequestedMs != null) {
            val elapsed = nowMs - lastRequestedMs
            if (elapsed in 0 until QUICK_THROTTLE_MS) {
                return blocked("quick-throttle")
            }
        }

        if (!force) {
            val gate = nextGate(prefs, nowMs)
            if (gate.reason != null) {
                return blocked(gate.reason)
            }
        }

        val requestId = UUID.randomUUID().toString()
        val entryDate = LocalDate.now().toString()
        prefs.edit()
            .putString(KEY_PENDING_REQUEST_ID, requestId)
            .putString(KEY_PENDING_REASON, normalizedReason)
            .putString(KEY_PENDING_ENTRY_DATE, entryDate)
            .putString(KEY_PENDING_CREATED_AT, now)
            .putString(KEY_LAST_REQUESTED_AT, now)
            .putString(KEY_LAST_REASON, normalizedReason)
            .putString(KEY_LAST_BLOCKED_REASON, null)
            .putString(KEY_LAST_EVENT_AT, now)
            .apply()

        val request = buildRequest(
            context = appContext,
            requestId = requestId,
            reason = normalizedReason,
            entryDate = entryDate,
            createdAt = now,
            force = force,
        )
        notifyListeners(request)
        return request
    }

    fun handleBroadcast(context: Context, intent: Intent?): JSObject {
        val action = intent?.action ?: return status(context)
        val sourceDeviceId = bluetoothDeviceAddress(intent)
        val reason = when (action) {
            Intent.ACTION_BOOT_COMPLETED -> REASON_BOOT
            Intent.ACTION_MY_PACKAGE_REPLACED -> REASON_PACKAGE_REPLACED
            Intent.ACTION_USER_PRESENT -> REASON_USER_PRESENT
            BluetoothAdapter.ACTION_STATE_CHANGED -> {
                val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1)
                if (state == BluetoothAdapter.STATE_ON) REASON_BLUETOOTH_ON else return status(context)
            }
            BluetoothDevice.ACTION_ACL_CONNECTED,
            BluetoothAdapter.ACTION_CONNECTION_STATE_CHANGED -> REASON_BLUETOOTH_RECONNECT
            else -> action
        }
        return requestSync(context, reason, sourceDeviceId = sourceDeviceId)
    }

    private fun notifyListeners(request: JSObject) {
        listeners.forEach { listener ->
            listener.onDirectWatchSyncRequested(request)
        }
    }

    private fun pendingRequest(context: Context): JSObject? {
        val prefs = prefs(context)
        val requestId = prefs.getString(KEY_PENDING_REQUEST_ID, null) ?: return null
        val reason = prefs.getString(KEY_PENDING_REASON, null) ?: return null
        val entryDate = prefs.getString(KEY_PENDING_ENTRY_DATE, null) ?: LocalDate.now().toString()
        val createdAt = prefs.getString(KEY_PENDING_CREATED_AT, null) ?: Instant.now().toString()
        return buildRequest(context, requestId, reason, entryDate, createdAt, force = false)
    }

    private fun isPendingStale(prefs: android.content.SharedPreferences, nowMs: Long): Boolean {
        val createdMs = parseInstantMs(prefs.getString(KEY_PENDING_CREATED_AT, null)) ?: return false
        return nowMs - createdMs >= PENDING_REQUEST_TTL_MS
    }

    private fun clearPending(prefs: android.content.SharedPreferences) {
        prefs.edit()
            .putString(KEY_PENDING_REQUEST_ID, null)
            .putString(KEY_PENDING_REASON, null)
            .putString(KEY_PENDING_ENTRY_DATE, null)
            .putString(KEY_PENDING_CREATED_AT, null)
            .apply()
    }

    private fun nextGate(prefs: android.content.SharedPreferences, nowMs: Long): SyncGate {
        val lastOutcome = prefs.getString(KEY_LAST_OUTCOME, null)
        val lastSuccessfulMs = parseInstantMs(prefs.getString(KEY_LAST_SUCCESSFUL_AT, null))
            ?: parseInstantMs(prefs.getString(KEY_LAST_COMPLETED_AT, null))
                ?.takeIf { isSuccessfulOutcome(lastOutcome) }
        if (lastSuccessfulMs != null) {
            val nextAllowedAt = lastSuccessfulMs + AUTO_SYNC_INTERVAL_MS
            if (nowMs < nextAllowedAt) {
                return SyncGate("interval", nextAllowedAt)
            }
        }

        val lastHandledMs = parseInstantMs(prefs.getString(KEY_LAST_HANDLED_AT, null))
        if (
            lastHandledMs != null &&
            normalizeOutcome(lastOutcome, "") == "started"
        ) {
            val nextAllowedAt = lastHandledMs + FAILURE_BACKOFF_MS
            if (nowMs < nextAllowedAt) {
                return SyncGate("sync-in-progress", nextAllowedAt)
            }
        }

        val lastCompletedMs = parseInstantMs(prefs.getString(KEY_LAST_COMPLETED_AT, null))
        if (
            lastCompletedMs != null &&
            !isSuccessfulOutcome(lastOutcome)
        ) {
            val nextAllowedAt = lastCompletedMs + FAILURE_BACKOFF_MS
            if (nowMs < nextAllowedAt) {
                return SyncGate("failure-backoff", nextAllowedAt)
            }
        }

        return SyncGate(null, null)
    }

    private fun buildRequest(
        context: Context,
        requestId: String,
        reason: String,
        entryDate: String,
        createdAt: String,
        force: Boolean,
    ): JSObject {
        val prefs = prefs(context)
        val request = JSObject()
        request.put("requested", true)
        request.put("id", requestId)
        request.put("reason", reason)
        request.put("entryDate", entryDate)
        request.put("createdAt", createdAt)
        request.put("deviceId", prefs.getString(KEY_DEVICE_ID, null))
        request.put("deviceName", prefs.getString(KEY_DEVICE_NAME, null))
        request.put("force", force)
        request.put("source", "native")
        return request
    }

    private fun isConfigured(context: Context): Boolean {
        val prefs = prefs(context)
        return prefs.getBoolean(KEY_ENABLED, false) &&
            !prefs.getString(KEY_DEVICE_ID, null).isNullOrBlank() &&
            !prefs.getString(KEY_AUTH_KEY_HEX, null).isNullOrBlank()
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun parseInstantMs(value: String?): Long? {
        if (value.isNullOrBlank()) {
            return null
        }
        return try {
            Instant.parse(value).toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    private fun normalizeOutcome(outcome: String?, fallback: String): String {
        return outcome?.trim()?.lowercase()?.takeIf { it.isNotBlank() } ?: fallback
    }

    private fun isSuccessfulOutcome(outcome: String?): Boolean {
        return when (normalizeOutcome(outcome, "")) {
            "completed", "service-synced", "success", "synced" -> true
            else -> false
        }
    }

    private fun bluetoothDeviceAddress(intent: Intent): String? {
        return try {
            val device = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            }
            device?.address
        } catch (_: SecurityException) {
            null
        }
    }

    private data class SyncGate(
        val reason: String?,
        val nextAllowedAtMs: Long?,
    )
}
