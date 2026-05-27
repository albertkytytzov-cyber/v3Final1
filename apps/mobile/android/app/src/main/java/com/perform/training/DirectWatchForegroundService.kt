package com.perform.training

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class DirectWatchForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val syncReceiver: BroadcastReceiver = DirectWatchSyncReceiver()
    private val periodicSyncRunnable = object : Runnable {
        override fun run() {
            DirectWatchSyncCoordinator.requestSync(
                applicationContext,
                DirectWatchSyncCoordinator.REASON_SERVICE_TIMER,
            )
            handler.postDelayed(this, DIRECT_WATCH_NATIVE_SYNC_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel()
        registerSyncReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                saveState(
                    running = false,
                    deviceId = null,
                    deviceName = null,
                    bridgeUntil = null,
                    message = "Сервис часов остановлен.",
                )
                stopForegroundCompat()
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val deviceId = intent?.getStringExtra(EXTRA_DEVICE_ID)
                val deviceName = intent?.getStringExtra(EXTRA_DEVICE_NAME)
                val bridgeUntil = intent?.getStringExtra(EXTRA_BRIDGE_UNTIL)
                val message = "PERFORM Sync держит Bluetooth-канал часов."
                saveState(
                    running = true,
                    deviceId = deviceId,
                    deviceName = deviceName,
                    bridgeUntil = bridgeUntil,
                    message = message,
                )
                startForegroundCompat(buildNotification(deviceName, bridgeUntil))
                startNativeSyncTimer()
                DirectWatchSyncCoordinator.requestSync(
                    applicationContext,
                    DirectWatchSyncCoordinator.REASON_SERVICE_START,
                )
                return START_STICKY
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopNativeSyncTimer()
        unregisterSyncReceiver()
        super.onDestroy()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "PERFORM Sync",
            NotificationManager.IMPORTANCE_LOW,
        )
        channel.description = "Служебное подключение часов для времени, погоды и показателей."
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(deviceName: String?, bridgeUntil: String?): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = Intent(this, DirectWatchForegroundService::class.java).setAction(ACTION_STOP)
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = "PERFORM Sync"
        val text = listOfNotNull(
            deviceName?.takeIf { it.isNotBlank() } ?: "Часы подключены",
            bridgeUntil?.let { "активно до ${formatBridgeUntil(it)}" },
        ).joinToString(" · ")

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setShowWhen(false)
            .addAction(Notification.Action.Builder(R.mipmap.ic_launcher, "Остановить", stopPendingIntent).build())
            .build()
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
            )
            return
        }

        @Suppress("DEPRECATION")
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun registerSyncReceiver() {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_USER_PRESENT)
            addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
            addAction(BluetoothAdapter.ACTION_CONNECTION_STATE_CHANGED)
            addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(syncReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                registerReceiver(syncReceiver, filter)
            }
        } catch (_: RuntimeException) {
            // The service may be restarted while Android is still unwinding the old receiver.
        }
    }

    private fun unregisterSyncReceiver() {
        try {
            unregisterReceiver(syncReceiver)
        } catch (_: RuntimeException) {
            // Receiver may already be gone if Android stopped the service abruptly.
        }
    }

    private fun startNativeSyncTimer() {
        handler.removeCallbacks(periodicSyncRunnable)
        handler.postDelayed(periodicSyncRunnable, DIRECT_WATCH_NATIVE_SYNC_INTERVAL_MS)
    }

    private fun stopNativeSyncTimer() {
        handler.removeCallbacks(periodicSyncRunnable)
    }

    private fun saveState(
        running: Boolean,
        deviceId: String?,
        deviceName: String?,
        bridgeUntil: String?,
        message: String?,
    ) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_RUNNING, running)
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_DEVICE_NAME, deviceName)
            .putString(KEY_BRIDGE_UNTIL, bridgeUntil)
            .putString(KEY_MESSAGE, message)
            .putString(KEY_UPDATED_AT, Instant.now().toString())
            .apply()
    }

    companion object {
        private const val ACTION_START = "com.perform.training.DirectWatchForegroundService.START"
        private const val ACTION_STOP = "com.perform.training.DirectWatchForegroundService.STOP"
        private const val CHANNEL_ID = "perform_sync_watch"
        private const val NOTIFICATION_ID = 5301
        private const val PREFS_NAME = "perform.direct_watch_foreground_service"
        private const val EXTRA_DEVICE_ID = "deviceId"
        private const val EXTRA_DEVICE_NAME = "deviceName"
        private const val EXTRA_BRIDGE_UNTIL = "bridgeUntil"
        private const val KEY_RUNNING = "running"
        private const val KEY_DEVICE_ID = "deviceId"
        private const val KEY_DEVICE_NAME = "deviceName"
        private const val KEY_BRIDGE_UNTIL = "bridgeUntil"
        private const val KEY_MESSAGE = "message"
        private const val KEY_UPDATED_AT = "updatedAt"
        private const val DIRECT_WATCH_NATIVE_SYNC_INTERVAL_MS = 30 * 60 * 1000L

        fun start(
            context: Context,
            deviceId: String?,
            deviceName: String?,
            durationMs: Long,
        ) {
            val bridgeUntil = Instant.now().plusMillis(durationMs).toString()
            val intent = Intent(context, DirectWatchForegroundService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_DEVICE_ID, deviceId)
                .putExtra(EXTRA_DEVICE_NAME, deviceName)
                .putExtra(EXTRA_BRIDGE_UNTIL, bridgeUntil)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_RUNNING, false)
                .putString(KEY_MESSAGE, "Сервис часов остановлен.")
                .putString(KEY_UPDATED_AT, Instant.now().toString())
                .apply()

            val intent = Intent(context, DirectWatchForegroundService::class.java)
            try {
                context.stopService(intent)
            } catch (_: RuntimeException) {
                // The service may already be stopped.
            }
        }

        fun status(context: Context): JSObject {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val bridgeUntil = prefs.getString(KEY_BRIDGE_UNTIL, null)
            val expired = isExpired(bridgeUntil)
            val running = prefs.getBoolean(KEY_RUNNING, false) && !expired
            val activeBridgeUntil = if (expired) null else bridgeUntil
            if (expired) {
                prefs.edit()
                    .putBoolean(KEY_RUNNING, false)
                    .putString(KEY_BRIDGE_UNTIL, null)
                    .putString(KEY_MESSAGE, "Сервис часов остановлен.")
                    .putString(KEY_UPDATED_AT, Instant.now().toString())
                    .apply()
            }
            val response = JSObject()
            response.put("running", running)
            response.put("deviceId", prefs.getString(KEY_DEVICE_ID, null))
            response.put("deviceName", prefs.getString(KEY_DEVICE_NAME, null))
            response.put("bridgeUntil", activeBridgeUntil)
            response.put("message", prefs.getString(KEY_MESSAGE, null))
            response.put("updatedAt", prefs.getString(KEY_UPDATED_AT, null))
            return response
        }

        private fun isExpired(bridgeUntil: String?): Boolean {
            if (bridgeUntil.isNullOrBlank()) {
                return false
            }

            return try {
                Instant.parse(bridgeUntil).isBefore(Instant.now())
            } catch (_: Exception) {
                false
            }
        }

        private fun formatBridgeUntil(value: String): String {
            return try {
                DateTimeFormatter.ofPattern("HH:mm")
                    .withZone(ZoneId.systemDefault())
                    .format(Instant.parse(value))
            } catch (_: Exception) {
                value
            }
        }
    }
}
