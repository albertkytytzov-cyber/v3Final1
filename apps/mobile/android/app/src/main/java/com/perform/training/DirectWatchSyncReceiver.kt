package com.perform.training

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DirectWatchSyncReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val result = DirectWatchSyncCoordinator.handleBroadcast(context, intent)
        val reason = result.optString("reason", "").takeIf { it.isNotBlank() }
            ?: result.optString("lastReason", "").takeIf { it.isNotBlank() }
            ?: intent?.action
            ?: DirectWatchSyncCoordinator.REASON_SERVICE_START
        val serviceRunning = DirectWatchForegroundService.status(context).optBoolean("running", false)
        if (!serviceRunning && DirectWatchSyncCoordinator.nativeSyncConfig(context) != null) {
            DirectWatchForegroundService.startNativeSync(context.applicationContext, reason)
        }
    }
}
