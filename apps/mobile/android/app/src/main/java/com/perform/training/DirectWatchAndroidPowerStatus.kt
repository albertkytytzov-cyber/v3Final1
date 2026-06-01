package com.perform.training

import android.app.ActivityManager
import android.app.AlarmManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import com.getcapacitor.JSObject

object DirectWatchAndroidPowerStatus {
    fun status(context: Context): JSObject {
        val appContext = context.applicationContext
        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        val powerManager = appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val activityManager = appContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val manufacturer = Build.MANUFACTURER.orEmpty()
        val model = Build.MODEL.orEmpty()
        val ignoringBatteryOptimizations = powerManager?.isIgnoringBatteryOptimizations(appContext.packageName)
        val powerSaveMode = powerManager?.isPowerSaveMode
        val backgroundRestricted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            activityManager?.isBackgroundRestricted
        } else {
            null
        }
        val canScheduleExactAlarms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager?.canScheduleExactAlarms()
        } else {
            true
        }

        val normalizedManufacturer = manufacturer.lowercase()
        val isAggressiveBatteryVendor = listOf("xiaomi", "redmi", "poco").any { normalizedManufacturer.contains(it) }

        return JSObject().apply {
            put("androidSdk", Build.VERSION.SDK_INT)
            put("backgroundRestricted", backgroundRestricted)
            put("canScheduleExactAlarms", canScheduleExactAlarms)
            put("exactAlarmRequired", false)
            put("ignoringBatteryOptimizations", ignoringBatteryOptimizations)
            put("isAggressiveBatteryVendor", isAggressiveBatteryVendor)
            put("manufacturer", manufacturer)
            put("model", model)
            put("packageName", appContext.packageName)
            put("powerSaveMode", powerSaveMode)
            put(
                "needsBatteryUnrestricted",
                isAggressiveBatteryVendor && ignoringBatteryOptimizations == false,
            )
        }
    }
}
