package com.perform.training

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DirectWatchSyncReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val result = if (intent?.action == DirectWatchSyncAlarmScheduler.ACTION_SERVICE_TIMER) {
            DirectWatchSyncCoordinator.requestSync(
                context = context,
                reason = DirectWatchSyncCoordinator.REASON_SERVICE_TIMER,
            )
        } else {
            DirectWatchSyncCoordinator.handleBroadcast(context, intent)
        }
        val reason = result.optString("reason", "").takeIf { it.isNotBlank() }
            ?: result.optString("lastReason", "").takeIf { it.isNotBlank() }
            ?: intent?.action
            ?: DirectWatchSyncCoordinator.REASON_SERVICE_START
        val serviceRunning = DirectWatchForegroundService.status(context).optBoolean("running", false)
        val hasConfig = DirectWatchSyncCoordinator.nativeSyncConfig(context) != null
        val shouldStartSync = hasConfig && (
            result.optBoolean("requested", false) ||
                !serviceRunning ||
                intent?.action == DirectWatchSyncAlarmScheduler.ACTION_SERVICE_TIMER
            )

        if (shouldStartSync) {
            DirectWatchForegroundService.startNativeSync(context.applicationContext, reason)
            return
        }

        if (hasConfig) {
            val retryAfterMs = result.optLong("retryAfterMs", 10 * 60 * 1000L)
                .coerceAtLeast(30_000L)
                .coerceAtMost(10 * 60 * 1000L)
            DirectWatchSyncAlarmScheduler.schedule(context, retryAfterMs)
        } else {
            DirectWatchSyncAlarmScheduler.cancel(context)
        }
    }
}
