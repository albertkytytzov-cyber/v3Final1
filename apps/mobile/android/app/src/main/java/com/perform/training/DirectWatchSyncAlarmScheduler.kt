package com.perform.training

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log

object DirectWatchSyncAlarmScheduler {
    const val ACTION_SERVICE_TIMER = "com.perform.training.DirectWatchSyncReceiver.SERVICE_TIMER"
    private const val REQUEST_CODE_SERVICE_TIMER = 5302
    private const val TAG = "DirectWatchAlarm"

    fun schedule(context: Context, delayMs: Long) {
        val appContext = context.applicationContext
        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return
        val pendingIntent = pendingIntent(appContext)
        val normalizedDelayMs = delayMs.coerceAtLeast(30_000L)
        val triggerAtMs = SystemClock.elapsedRealtime() + normalizedDelayMs

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerAtMs,
                    pendingIntent,
                )
            } else {
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    triggerAtMs,
                    pendingIntent,
                )
            }
            Log.i(TAG, "scheduled watch sync alarm in ${normalizedDelayMs}ms")
        } catch (error: SecurityException) {
            Log.w(TAG, "failed to schedule watch sync alarm: ${error.message}")
        }
    }

    fun cancel(context: Context) {
        val appContext = context.applicationContext
        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return
        alarmManager.cancel(pendingIntent(appContext))
        Log.i(TAG, "cancelled watch sync alarm")
    }

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, DirectWatchSyncReceiver::class.java)
            .setAction(ACTION_SERVICE_TIMER)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE_SERVICE_TIMER,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
