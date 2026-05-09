package com.perform.training

import android.content.Intent
import android.content.pm.PackageManager
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException
import kotlin.math.max
import kotlin.reflect.KClass
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissionContract = PermissionController.createRequestPermissionResultContract()

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val sdkStatus = HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE)
        val hasMiFitness = isPackageInstalled(MI_FITNESS_PACKAGE)
        val response = JSObject()
        response.put("available", sdkStatus == HealthConnectClient.SDK_AVAILABLE)
        response.put("hasMiFitness", hasMiFitness)
        response.put("sdkStatus", sdkStatus)
        response.put(
            "reason",
            when (sdkStatus) {
                HealthConnectClient.SDK_AVAILABLE -> JSONObject.NULL
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                    "Нужно установить или обновить Health Connect."
                else -> "Health Connect недоступен на этом устройстве."
            },
        )
        call.resolve(response)
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect недоступен на этом устройстве.")
            return
        }

        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = withContext(Dispatchers.IO) {
                    client.permissionController.getGrantedPermissions()
                }

                if (granted.containsAll(permissions)) {
                    val response = JSObject()
                    response.put("granted", true)
                    response.put("reason", JSONObject.NULL)
                    call.resolve(response)
                    return@launch
                }

                val intent: Intent = permissionContract.createIntent(context, permissions)
                startActivityForResult(call, intent, "handleAuthorizationResult")
            } catch (error: Exception) {
                call.reject("Не удалось запросить доступ Health Connect: ${safeMessage(error)}", error)
            }
        }
    }

    @ActivityCallback
    private fun handleAuthorizationResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) {
            return
        }

        try {
            val granted = permissionContract.parseResult(result.resultCode, result.data)
            val response = JSObject()
            response.put("granted", granted.containsAll(permissions))
            response.put(
                "reason",
                if (granted.containsAll(permissions)) {
                    JSONObject.NULL
                } else {
                    "Health Connect не выдал все разрешения на чтение сна, пульса и тренировок."
                },
            )
            call.resolve(response)
        } catch (error: Exception) {
            call.reject("Ошибка авторизации Health Connect: ${safeMessage(error)}", error)
        }
    }

    @PluginMethod
    fun readDailySummary(call: PluginCall) {
        val entryDate = call.getString("entryDate")
        if (entryDate.isNullOrBlank()) {
            call.reject("entryDate is required")
            return
        }

        val dayRange = try {
            parseDayRange(entryDate)
        } catch (error: DateTimeParseException) {
            call.reject("entryDate must use YYYY-MM-DD format", error)
            return
        }

        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = withContext(Dispatchers.IO) {
                    client.permissionController.getGrantedPermissions()
                }

                if (!granted.containsAll(permissions)) {
                    call.reject("Нет разрешения Health Connect на чтение сна, пульса и тренировок.")
                    return@launch
                }

                val summary = withContext(Dispatchers.IO) {
                    readMiFitnessDailySummary(client, dayRange)
                }
                call.resolve(summary)
            } catch (error: Exception) {
                call.reject("Не удалось прочитать Mi Fitness через Health Connect: ${safeMessage(error)}", error)
            }
        }
    }

    private suspend fun readMiFitnessDailySummary(
        client: HealthConnectClient,
        dayRange: DayRange,
    ): JSObject {
        val range = TimeRangeFilter.between(dayRange.start, dayRange.end)
        val sleepRecords = readAllRecords(client, SleepSessionRecord::class, range)
        val restingHeartRateRecords = readAllRecords(client, RestingHeartRateRecord::class, range)
        val heartRateRecords = readAllRecords(client, HeartRateRecord::class, range)
        val exerciseRecords = readAllRecords(client, ExerciseSessionRecord::class, range)
        val distanceRecords = readAllRecords(client, DistanceRecord::class, range)
        val totalCaloriesRecords = readAllRecords(client, TotalCaloriesBurnedRecord::class, range)
        val activeCaloriesRecords = readAllRecords(client, ActiveCaloriesBurnedRecord::class, range)

        val result = JSObject()
        val rawPayload = JSObject()

        result.put("entryDate", dayRange.entryDate)
        result.put("provider", PROVIDER)
        result.put(
            "sourceDevice",
            if (isPackageInstalled(MI_FITNESS_PACKAGE)) "Mi Fitness / Health Connect" else "Health Connect",
        )
        putNullable(result, "sleep", buildSleepSummary(sleepRecords, dayRange))
        putNullable(result, "heartRate", buildHeartRateSummary(restingHeartRateRecords, heartRateRecords))
        putNullable(
            result,
            "workout",
            buildWorkoutSummary(exerciseRecords, distanceRecords, totalCaloriesRecords, activeCaloriesRecords, heartRateRecords),
        )
        result.put("syncedAt", Instant.now().toString())

        rawPayload.put("dataOrigin", MI_FITNESS_PACKAGE)
        rawPayload.put("hasMiFitness", isPackageInstalled(MI_FITNESS_PACKAGE))
        rawPayload.put("sleepRecordCount", sleepRecords.size)
        rawPayload.put("restingHeartRateRecordCount", restingHeartRateRecords.size)
        rawPayload.put("heartRateRecordCount", heartRateRecords.size)
        rawPayload.put("exerciseRecordCount", exerciseRecords.size)
        rawPayload.put("distanceRecordCount", distanceRecords.size)
        rawPayload.put("totalCaloriesRecordCount", totalCaloriesRecords.size)
        rawPayload.put("activeCaloriesRecordCount", activeCaloriesRecords.size)
        result.put("rawPayload", rawPayload)

        return result
    }

    private suspend fun <T : Record> readAllRecords(
        client: HealthConnectClient,
        recordType: KClass<T>,
        range: TimeRangeFilter,
    ): List<T> {
        val records = mutableListOf<T>()
        var pageToken: String? = null

        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = recordType,
                    timeRangeFilter = range,
                    dataOriginFilter = setOf(miFitnessOrigin),
                    pageToken = pageToken,
                ),
            )
            records.addAll(response.records)
            pageToken = response.pageToken
        } while (!pageToken.isNullOrBlank())

        return records
    }

    private fun buildSleepSummary(records: List<SleepSessionRecord>, dayRange: DayRange): JSObject? {
        if (records.isEmpty()) {
            return null
        }

        val sleep = JSObject()
        var totalMinutes = 0.0
        var lightMinutes = 0.0
        var deepMinutes = 0.0
        var remMinutes = 0.0
        var awakeMinutes = 0.0
        var startTime: Instant? = null
        var endTime: Instant? = null

        for (record in records) {
            totalMinutes += minutesBetween(record.startTime, record.endTime, dayRange)
            startTime = minInstant(startTime, record.startTime)
            endTime = maxInstant(endTime, record.endTime)

            for (stage in record.stages) {
                val minutes = minutesBetween(stage.startTime, stage.endTime, dayRange)
                when (stage.stage) {
                    SleepSessionRecord.STAGE_TYPE_LIGHT -> lightMinutes += minutes
                    SleepSessionRecord.STAGE_TYPE_DEEP -> deepMinutes += minutes
                    SleepSessionRecord.STAGE_TYPE_REM -> remMinutes += minutes
                    SleepSessionRecord.STAGE_TYPE_AWAKE,
                    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
                    SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> awakeMinutes += minutes
                }
            }
        }

        putNullableNumber(sleep, "durationMinutes", totalMinutes.takeIf { it > 0 })
        putNullableNumber(sleep, "lightMinutes", lightMinutes.takeIf { it > 0 })
        putNullableNumber(sleep, "deepMinutes", deepMinutes.takeIf { it > 0 })
        putNullableNumber(sleep, "remMinutes", remMinutes.takeIf { it > 0 })
        putNullableNumber(sleep, "awakeMinutes", awakeMinutes.takeIf { it > 0 })
        putNullable(sleep, "score", null)
        putNullable(sleep, "startTime", startTime?.toString())
        putNullable(sleep, "endTime", endTime?.toString())

        return sleep
    }

    private fun buildHeartRateSummary(
        restingRecords: List<RestingHeartRateRecord>,
        heartRateRecords: List<HeartRateRecord>,
    ): JSObject? {
        val values = heartRateRecords.flatMap { record ->
            record.samples.map { sample -> sample.beatsPerMinute.toDouble() }
        }
        val restingValues = restingRecords.map { record -> record.beatsPerMinute.toDouble() }

        if (values.isEmpty() && restingValues.isEmpty()) {
            return null
        }

        val heartRate = JSObject()
        putNullableNumber(heartRate, "restingBpm", average(restingValues))
        putNullableNumber(heartRate, "averageBpm", average(values))
        putNullableNumber(heartRate, "minBpm", values.minOrNull())
        putNullableNumber(heartRate, "maxBpm", values.maxOrNull())
        putNullable(heartRate, "hrvRmssdMs", null)

        return heartRate
    }

    private fun buildWorkoutSummary(
        exerciseRecords: List<ExerciseSessionRecord>,
        distanceRecords: List<DistanceRecord>,
        totalCaloriesRecords: List<TotalCaloriesBurnedRecord>,
        activeCaloriesRecords: List<ActiveCaloriesBurnedRecord>,
        heartRateRecords: List<HeartRateRecord>,
    ): JSObject? {
        val workoutCount = exerciseRecords.size
        val totalDurationMinutes = exerciseRecords.sumOf { record ->
            Duration.between(record.startTime, record.endTime).toMillis().coerceAtLeast(0).toDouble() / MILLIS_PER_MINUTE
        }
        val totalDistanceMeters = distanceRecords.sumOf { record -> record.distance.inMeters }
        val activeCalories = activeCaloriesRecords.sumOf { record -> record.energy.inKilocalories }
            .takeIf { it > 0 }
            ?: totalCaloriesRecords.sumOf { record -> record.energy.inKilocalories }
        val values = heartRateRecords.flatMap { record ->
            record.samples.map { sample -> sample.beatsPerMinute.toDouble() }
        }

        if (workoutCount == 0 && totalDurationMinutes <= 0 && totalDistanceMeters <= 0 && activeCalories <= 0) {
            return null
        }

        val workout = JSObject()
        workout.put("count", workoutCount)
        putNullableNumber(workout, "totalDurationMinutes", totalDurationMinutes.takeIf { it > 0 })
        putNullableNumber(workout, "totalDistanceMeters", totalDistanceMeters.takeIf { it > 0 })
        putNullableNumber(workout, "activeCalories", activeCalories.takeIf { it > 0 })
        putNullableNumber(workout, "averageHeartRateBpm", average(values))
        putNullableNumber(workout, "maxHeartRateBpm", values.maxOrNull())

        return workout
    }

    private fun parseDayRange(entryDate: String): DayRange {
        val localDate = LocalDate.parse(entryDate)
        val zoneId = ZoneId.systemDefault()
        val start = localDate.atStartOfDay(zoneId).toInstant()
        val end = localDate.plusDays(1).atStartOfDay(zoneId).toInstant()
        return DayRange(entryDate, start, end)
    }

    private fun minutesBetween(start: Instant, end: Instant, dayRange: DayRange): Double {
        val clampedStart = maxInstant(dayRange.start, start) ?: start
        val clampedEnd = minInstant(dayRange.end, end) ?: end

        return max(0.0, Duration.between(clampedStart, clampedEnd).toMillis().toDouble() / MILLIS_PER_MINUTE)
    }

    private fun average(values: List<Double>) = if (values.isEmpty()) null else values.sum() / values.size

    private fun minInstant(left: Instant?, right: Instant?) = when {
        left == null -> right
        right == null -> left
        left <= right -> left
        else -> right
    }

    private fun maxInstant(left: Instant?, right: Instant?) = when {
        left == null -> right
        right == null -> left
        left >= right -> left
        else -> right
    }

    private fun isPackageInstalled(packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }

    private fun putNullable(objectValue: JSObject, key: String, value: Any?) {
        objectValue.put(key, value ?: JSONObject.NULL)
    }

    private fun putNullableNumber(objectValue: JSObject, key: String, value: Double?) {
        objectValue.put(key, value ?: JSONObject.NULL)
    }

    private fun safeMessage(error: Exception) = error.message ?: error.javaClass.simpleName

    private data class DayRange(
        val entryDate: String,
        val start: Instant,
        val end: Instant,
    )

    companion object {
        private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
        private const val MI_FITNESS_PACKAGE = "com.xiaomi.wearable"
        private const val PROVIDER = "health-connect"
        private const val MILLIS_PER_MINUTE = 60000.0
        private val miFitnessOrigin = DataOrigin(MI_FITNESS_PACKAGE)
        private val permissions = setOf(
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        )
    }
}
