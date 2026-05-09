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
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
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
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissionContract = PermissionController.createRequestPermissionResultContract()

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val sdkStatus = HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE)
        val installedKnownSources = installedKnownHealthSourcePackages()
        val response = JSObject()
        response.put("available", sdkStatus == HealthConnectClient.SDK_AVAILABLE)
        response.put("hasMiFitness", installedKnownSources.contains(MI_FITNESS_PACKAGE))
        response.put("hasKnownHealthSource", installedKnownSources.isNotEmpty())
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

                if (granted.containsAll(requiredPermissions)) {
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
            response.put("granted", granted.containsAll(requiredPermissions))
            response.put(
                "reason",
                if (granted.containsAll(requiredPermissions)) {
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

                if (!granted.containsAll(requiredPermissions)) {
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

    @PluginMethod
    fun readDailyWorkouts(call: PluginCall) {
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

                if (!granted.containsAll(requiredWorkoutPermissions)) {
                    call.reject("РќРµС‚ СЂР°Р·СЂРµС€РµРЅРёСЏ Health Connect РЅР° С‡С‚РµРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРѕРє.")
                    return@launch
                }

                val workouts = withContext(Dispatchers.IO) {
                    readMiFitnessDailyWorkouts(client, dayRange, granted)
                }
                call.resolve(workouts)
            } catch (error: Exception) {
                call.reject("РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ С‚СЂРµРЅРёСЂРѕРІРєРё Health Connect: ${safeMessage(error)}", error)
            }
        }
    }

    private suspend fun readMiFitnessDailySummary(
        client: HealthConnectClient,
        dayRange: DayRange,
    ): JSObject {
        val range = TimeRangeFilter.between(dayRange.start, dayRange.end)
        val sleepRange = TimeRangeFilter.between(dayRange.sleepLookupStart, dayRange.end)
        val sleepRecords = filterSleepRecordsForDay(
            readAllRecords(client, SleepSessionRecord::class, sleepRange),
            dayRange,
        )
        val restingHeartRateRecords = readAllRecords(client, RestingHeartRateRecord::class, range)
        val heartRateRecords = readAllRecords(client, HeartRateRecord::class, range)
        val sleepHeartRateRecords = readAllRecords(client, HeartRateRecord::class, sleepRange)
        val exerciseRecords = readAllRecords(client, ExerciseSessionRecord::class, range)
        val distanceRecords = readAllRecords(client, DistanceRecord::class, range)
        val totalCaloriesRecords = readAllRecords(client, TotalCaloriesBurnedRecord::class, range)
        val activeCaloriesRecords = readAllRecords(client, ActiveCaloriesBurnedRecord::class, range)
        val allSleepRecords = filterSleepRecordsForDay(
            readAllRecords(client, SleepSessionRecord::class, sleepRange, emptySet()),
            dayRange,
        )
        val allRestingHeartRateRecords = readAllRecords(client, RestingHeartRateRecord::class, range, emptySet())
        val allHeartRateRecords = readAllRecords(client, HeartRateRecord::class, range, emptySet())
        val allExerciseRecords = readAllRecords(client, ExerciseSessionRecord::class, range, emptySet())
        val allDistanceRecords = readAllRecords(client, DistanceRecord::class, range, emptySet())
        val allTotalCaloriesRecords = readAllRecords(client, TotalCaloriesBurnedRecord::class, range, emptySet())
        val allActiveCaloriesRecords = readAllRecords(client, ActiveCaloriesBurnedRecord::class, range, emptySet())
        val installedKnownSources = installedKnownHealthSourcePackages()

        val result = JSObject()
        val rawPayload = JSObject()

        result.put("entryDate", dayRange.entryDate)
        result.put("provider", PROVIDER)
        result.put(
            "sourceDevice",
            if (installedKnownSources.isNotEmpty()) "Xiaomi / Health Connect" else "Health Connect",
        )
        val heartRateSummary = buildHeartRateSummary(
            restingHeartRateRecords,
            heartRateRecords,
            sleepHeartRateRecords,
            sleepRecords,
        )

        putNullable(result, "sleep", buildSleepSummary(sleepRecords))
        putNullable(result, "heartRate", heartRateSummary.summary)
        putNullable(
            result,
            "workout",
            buildWorkoutSummary(exerciseRecords, distanceRecords, totalCaloriesRecords, activeCaloriesRecords, heartRateRecords),
        )
        result.put("syncedAt", Instant.now().toString())

        rawPayload.put(
            "dataOrigin",
            recordOrigins(
                sleepRecords +
                    restingHeartRateRecords +
                    heartRateRecords +
                    exerciseRecords +
                    distanceRecords +
                    totalCaloriesRecords +
                    activeCaloriesRecords,
            ).ifBlank { XIAOMI_HEALTH_SOURCE_PACKAGES.joinToString(", ") },
        )
        rawPayload.put("hasMiFitness", installedKnownSources.contains(MI_FITNESS_PACKAGE))
        rawPayload.put("hasKnownHealthSource", installedKnownSources.isNotEmpty())
        rawPayload.put("knownHealthSourcesInstalled", installedKnownSources.joinToString(", "))
        rawPayload.put("sleepLookupStart", dayRange.sleepLookupStart.toString())
        rawPayload.put("sleepLookupEnd", dayRange.end.toString())
        rawPayload.put("sleepRecordCount", sleepRecords.size)
        rawPayload.put("restingHeartRateRecordCount", restingHeartRateRecords.size)
        rawPayload.put("heartRateRecordCount", heartRateRecords.size)
        rawPayload.put("sleepHeartRateRecordCount", sleepHeartRateRecords.size)
        rawPayload.put("sleepHeartRateSampleCount", heartRateSummary.sleepSampleCount)
        rawPayload.put("restingHeartRateSource", heartRateSummary.restingSource)
        putNullable(rawPayload, "restingHeartRateWindowStart", heartRateSummary.restingWindowStart?.toString())
        putNullable(rawPayload, "restingHeartRateWindowEnd", heartRateSummary.restingWindowEnd?.toString())
        putNullableNumber(rawPayload, "estimatedRestingHeartRate", heartRateSummary.estimatedRestingBpm)
        rawPayload.put("exerciseRecordCount", exerciseRecords.size)
        rawPayload.put("distanceRecordCount", distanceRecords.size)
        rawPayload.put("totalCaloriesRecordCount", totalCaloriesRecords.size)
        rawPayload.put("activeCaloriesRecordCount", activeCaloriesRecords.size)
        rawPayload.put("allSleepRecordCount", allSleepRecords.size)
        rawPayload.put("allRestingHeartRateRecordCount", allRestingHeartRateRecords.size)
        rawPayload.put("allHeartRateRecordCount", allHeartRateRecords.size)
        rawPayload.put("allExerciseRecordCount", allExerciseRecords.size)
        rawPayload.put("allDistanceRecordCount", allDistanceRecords.size)
        rawPayload.put("allTotalCaloriesRecordCount", allTotalCaloriesRecords.size)
        rawPayload.put("allActiveCaloriesRecordCount", allActiveCaloriesRecords.size)
        rawPayload.put("sleepDataOrigins", recordOrigins(allSleepRecords))
        rawPayload.put("restingHeartRateDataOrigins", recordOrigins(allRestingHeartRateRecords))
        rawPayload.put("heartRateDataOrigins", recordOrigins(allHeartRateRecords))
        rawPayload.put("exerciseDataOrigins", recordOrigins(allExerciseRecords))
        rawPayload.put(
            "allDataOrigins",
            recordOrigins(
                allSleepRecords +
                    allRestingHeartRateRecords +
                    allHeartRateRecords +
                    allExerciseRecords +
                    allDistanceRecords +
                    allTotalCaloriesRecords +
                    allActiveCaloriesRecords,
            ),
        )
        result.put("rawPayload", rawPayload)

        return result
    }

    private suspend fun readMiFitnessDailyWorkouts(
        client: HealthConnectClient,
        dayRange: DayRange,
        grantedPermissions: Set<String>,
    ): JSObject {
        val range = TimeRangeFilter.between(dayRange.start, dayRange.end)
        val exerciseRecords = readAllRecords(client, ExerciseSessionRecord::class, range)
        val heartRateRecords = readAllRecords(client, HeartRateRecord::class, range)
        val distanceRecords = readAllRecords(client, DistanceRecord::class, range)
        val activeCaloriesRecords = readAllRecords(client, ActiveCaloriesBurnedRecord::class, range)
        val totalCaloriesRecords = readAllRecords(client, TotalCaloriesBurnedRecord::class, range)
        val speedRecords = if (grantedPermissions.contains(HealthPermission.getReadPermission(SpeedRecord::class))) {
            readAllRecords(client, SpeedRecord::class, range)
        } else {
            emptyList()
        }
        val oxygenSaturationRecords = if (grantedPermissions.contains(HealthPermission.getReadPermission(OxygenSaturationRecord::class))) {
            readAllRecords(client, OxygenSaturationRecord::class, range)
        } else {
            emptyList()
        }
        val installedKnownSources = installedKnownHealthSourcePackages()
        val workouts = JSONArray()

        for (record in exerciseRecords.sortedBy { exercise -> exercise.startTime }) {
            workouts.put(
                buildDeviceWorkout(
                    record,
                    heartRateRecords,
                    distanceRecords,
                    activeCaloriesRecords,
                    totalCaloriesRecords,
                    speedRecords,
                    oxygenSaturationRecords,
                    dayRange,
                    installedKnownSources,
                ),
            )
        }

        val result = JSObject()
        result.put("entryDate", dayRange.entryDate)
        result.put("provider", PROVIDER)
        result.put("workouts", workouts)

        return result
    }

    private fun buildDeviceWorkout(
        exerciseRecord: ExerciseSessionRecord,
        heartRateRecords: List<HeartRateRecord>,
        distanceRecords: List<DistanceRecord>,
        activeCaloriesRecords: List<ActiveCaloriesBurnedRecord>,
        totalCaloriesRecords: List<TotalCaloriesBurnedRecord>,
        speedRecords: List<SpeedRecord>,
        oxygenSaturationRecords: List<OxygenSaturationRecord>,
        dayRange: DayRange,
        installedKnownSources: List<String>,
    ): JSObject {
        val startTime = exerciseRecord.startTime
        val endTime = exerciseRecord.endTime
        val workoutHeartRateSamples = collectHeartRateSamples(heartRateRecords)
            .filter { sample -> sample.time >= startTime && sample.time <= endTime }
        val heartRateValues = workoutHeartRateSamples.map { sample -> sample.bpm }
        val workoutDistanceRecords = distanceRecords
            .filter { record -> overlaps(record.startTime, record.endTime, startTime, endTime) }
            .sortedBy { record -> record.endTime }
        val workoutActiveCalories = activeCaloriesRecords
            .filter { record -> overlaps(record.startTime, record.endTime, startTime, endTime) }
            .sumOf { record -> record.energy.inKilocalories }
        val workoutTotalCalories = totalCaloriesRecords
            .filter { record -> overlaps(record.startTime, record.endTime, startTime, endTime) }
            .sumOf { record -> record.energy.inKilocalories }
        val distanceMeters = workoutDistanceRecords.sumOf { record -> record.distance.inMeters }
        val rawPayload = JSObject()
        rawPayload.put("exerciseType", exerciseRecord.exerciseType)
        rawPayload.put("dataOrigin", exerciseRecord.metadata.dataOrigin.packageName)
        rawPayload.put("sampleCount", workoutHeartRateSamples.size)

        val workout = JSObject()
        workout.put("entryDate", dayRange.entryDate)
        workout.put("provider", PROVIDER)
        workout.put(
            "sourceDevice",
            if (installedKnownSources.isNotEmpty()) "Xiaomi / Health Connect" else "Health Connect",
        )
        workout.put(
            "sourceWorkoutId",
            buildSourceWorkoutId(exerciseRecord),
        )
        workout.put("workoutType", exerciseRecord.title?.takeIf { title -> title.isNotBlank() } ?: "exercise-${exerciseRecord.exerciseType}")
        workout.put("startTime", startTime.toString())
        workout.put("endTime", endTime.toString())
        putNullableNumber(workout, "durationMinutes", minutesBetween(startTime, endTime).takeIf { it > 0 })
        putNullableNumber(workout, "distanceMeters", distanceMeters.takeIf { it > 0 })
        putNullableNumber(
            workout,
            "activeCalories",
            workoutActiveCalories.takeIf { it > 0 } ?: workoutTotalCalories.takeIf { it > 0 },
        )
        putNullableNumber(workout, "averageHeartRateBpm", average(heartRateValues))
        putNullableNumber(workout, "maxHeartRateBpm", heartRateValues.maxOrNull())
        putNullableNumber(workout, "minHeartRateBpm", heartRateValues.minOrNull())
        workout.put(
            "samples",
            buildDeviceWorkoutSamples(
                workoutHeartRateSamples,
                workoutDistanceRecords,
                speedRecords.filter { record -> overlaps(record.startTime, record.endTime, startTime, endTime) },
                oxygenSaturationRecords.filter { record -> record.time >= startTime && record.time <= endTime },
                startTime,
                endTime,
            ),
        )
        workout.put("rawPayload", rawPayload)
        workout.put("syncedAt", Instant.now().toString())

        return workout
    }

    private fun buildDeviceWorkoutSamples(
        heartRateSamples: List<HeartRateSample>,
        distanceRecords: List<DistanceRecord>,
        speedRecords: List<SpeedRecord>,
        oxygenSaturationRecords: List<OxygenSaturationRecord>,
        workoutStart: Instant,
        workoutEnd: Instant,
    ): JSONArray {
        val samplesByTime = linkedMapOf<Instant, JSObject>()

        fun sampleAt(time: Instant): JSObject {
            val sample = samplesByTime.getOrPut(time) {
                val next = JSObject()
                next.put("sampleTime", time.toString())
                putNullable(next, "heartRateBpm", null)
                putNullable(next, "distanceMeters", null)
                putNullable(next, "speedMetersPerSecond", null)
                putNullable(next, "paceSecondsPerKm", null)
                putNullable(next, "oxygenSaturationPercent", null)
                next
            }
            return sample
        }

        for (sample in heartRateSamples) {
            putNullableNumber(sampleAt(sample.time), "heartRateBpm", sample.bpm)
        }

        var cumulativeDistanceMeters = 0.0
        for (record in distanceRecords.sortedBy { distance -> distance.endTime }) {
            cumulativeDistanceMeters += record.distance.inMeters
            val sampleTime = clampInstant(record.endTime, workoutStart, workoutEnd)
            putNullableNumber(sampleAt(sampleTime), "distanceMeters", cumulativeDistanceMeters.takeIf { it > 0 })
        }

        for (record in speedRecords) {
            for (sample in record.samples) {
                if (sample.time < workoutStart || sample.time > workoutEnd) {
                    continue
                }
                val speedMetersPerSecond = sample.speed.inMetersPerSecond
                putNullableNumber(sampleAt(sample.time), "speedMetersPerSecond", speedMetersPerSecond)
                putNullableNumber(
                    sampleAt(sample.time),
                    "paceSecondsPerKm",
                    if (speedMetersPerSecond > 0) 1000.0 / speedMetersPerSecond else null,
                )
            }
        }

        for (record in oxygenSaturationRecords) {
            putNullableNumber(sampleAt(record.time), "oxygenSaturationPercent", record.percentage.value)
        }

        val samples = JSONArray()
        downsampleWorkoutSamples(samplesByTime.toSortedMap().values.toList()).forEach { sample -> samples.put(sample) }
        return samples
    }

    private fun downsampleWorkoutSamples(samples: List<JSObject>): List<JSObject> {
        if (samples.size <= MAX_WORKOUT_SAMPLES) {
            return samples
        }

        val selectedIndexes = sortedSetOf(0, samples.lastIndex)
        val bucketCount = max(1, (MAX_WORKOUT_SAMPLES - 2) / 2)

        for (bucketIndex in 0 until bucketCount) {
            val start = (bucketIndex * samples.size) / bucketCount
            val end = minOf(samples.size, ((bucketIndex + 1) * samples.size) / bucketCount)
            if (start >= end) {
                continue
            }

            var minHeartRateIndex: Int? = null
            var maxHeartRateIndex: Int? = null

            for (index in start until end) {
                val heartRate = getNullableDouble(samples[index], "heartRateBpm") ?: continue
                val minIndex = minHeartRateIndex
                val maxIndex = maxHeartRateIndex
                if (minIndex == null || heartRate < (getNullableDouble(samples[minIndex], "heartRateBpm") ?: heartRate)) {
                    minHeartRateIndex = index
                }
                if (maxIndex == null || heartRate > (getNullableDouble(samples[maxIndex], "heartRateBpm") ?: heartRate)) {
                    maxHeartRateIndex = index
                }
            }

            if (minHeartRateIndex == null || maxHeartRateIndex == null) {
                selectedIndexes.add(start)
                selectedIndexes.add(end - 1)
            } else {
                selectedIndexes.add(minHeartRateIndex)
                selectedIndexes.add(maxHeartRateIndex)
            }
        }

        return selectedIndexes.take(MAX_WORKOUT_SAMPLES).map { index -> samples[index] }
    }

    private fun getNullableDouble(sample: JSObject, key: String): Double? {
        val value = sample.opt(key)
        if (value == null || value == JSONObject.NULL) {
            return null
        }

        return when (value) {
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull()
            else -> null
        }
    }

    private fun buildSourceWorkoutId(record: ExerciseSessionRecord): String {
        val metadataId = record.metadata.id
        if (metadataId.isNotBlank()) {
            return metadataId
        }

        return listOf(
            record.metadata.dataOrigin.packageName,
            record.exerciseType.toString(),
            record.startTime.toString(),
            record.endTime.toString(),
        ).joinToString(":")
    }

    private suspend fun <T : Record> readAllRecords(
        client: HealthConnectClient,
        recordType: KClass<T>,
        range: TimeRangeFilter,
        dataOriginFilter: Set<DataOrigin> = xiaomiHealthDataOrigins,
    ): List<T> {
        val records = mutableListOf<T>()
        var pageToken: String? = null

        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = recordType,
                    timeRangeFilter = range,
                    dataOriginFilter = dataOriginFilter,
                    pageToken = pageToken,
                ),
            )
            records.addAll(response.records)
            pageToken = response.pageToken
        } while (!pageToken.isNullOrBlank())

        return records
    }

    private fun filterSleepRecordsForDay(records: List<SleepSessionRecord>, dayRange: DayRange): List<SleepSessionRecord> {
        return records.filter { record ->
            record.endTime > dayRange.start && record.endTime <= dayRange.end
        }
    }

    private fun recordOrigins(records: List<Record>): String {
        return records
            .map { record -> record.metadata.dataOrigin.packageName }
            .filter { packageName -> packageName.isNotBlank() }
            .distinct()
            .sorted()
            .joinToString(", ")
    }

    private fun buildSleepSummary(records: List<SleepSessionRecord>): JSObject? {
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
            totalMinutes += minutesBetween(record.startTime, record.endTime)
            startTime = minInstant(startTime, record.startTime)
            endTime = maxInstant(endTime, record.endTime)

            for (stage in record.stages) {
                val minutes = minutesBetween(stage.startTime, stage.endTime)
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
        sleepHeartRateRecords: List<HeartRateRecord>,
        sleepRecords: List<SleepSessionRecord>,
    ): HeartRateSummaryResult {
        val samples = collectHeartRateSamples(heartRateRecords)
        val sleepSamples = collectHeartRateSamples(sleepHeartRateRecords).filter { sample ->
            sleepRecords.any { record -> sample.time >= record.startTime && sample.time <= record.endTime }
        }
        val values = samples.map { sample -> sample.bpm }
        val restingValues = restingRecords.map { record -> record.beatsPerMinute.toDouble() }
        val sleepRestingEstimate = calculateSleepRestingHeartRate(sleepSamples)
        val fallbackRestingEstimate = sleepRestingEstimate.takeIf { restingValues.isEmpty() }
        val restingWindowStart = sleepRecords.minOfOrNull { record -> record.startTime }
        val restingWindowEnd = sleepRecords.maxOfOrNull { record -> record.endTime }
        val restingSource = when {
            restingValues.isNotEmpty() -> "health-connect-resting-record"
            sleepRestingEstimate != null -> "calculated-from-sleep-heart-rate"
            else -> "missing"
        }

        if (values.isEmpty() && restingValues.isEmpty() && sleepRestingEstimate == null) {
            return HeartRateSummaryResult(
                null,
                restingSource,
                null,
                sleepSamples.size,
                restingWindowStart,
                restingWindowEnd,
            )
        }

        val heartRate = JSObject()
        putNullableNumber(heartRate, "restingBpm", average(restingValues) ?: sleepRestingEstimate)
        putNullableNumber(heartRate, "averageBpm", average(values))
        putNullableNumber(heartRate, "minBpm", values.minOrNull())
        putNullableNumber(heartRate, "maxBpm", values.maxOrNull())
        putNullable(heartRate, "hrvRmssdMs", null)

        return HeartRateSummaryResult(
            heartRate,
            restingSource,
            fallbackRestingEstimate,
            sleepSamples.size,
            restingWindowStart,
            restingWindowEnd,
        )
    }

    private fun collectHeartRateSamples(records: List<HeartRateRecord>): List<HeartRateSample> {
        return records.flatMap { record ->
            record.samples.map { sample ->
                HeartRateSample(sample.time, sample.beatsPerMinute.toDouble())
            }
        }.filter { sample ->
            sample.bpm >= MIN_REASONABLE_HEART_RATE && sample.bpm <= MAX_REASONABLE_HEART_RATE
        }
    }

    private fun calculateSleepRestingHeartRate(samples: List<HeartRateSample>): Double? {
        if (samples.size < MIN_RESTING_ESTIMATE_SAMPLES) {
            return null
        }

        val values = samples
            .map { sample -> sample.bpm }
            .filter { bpm -> bpm >= MIN_REASONABLE_HEART_RATE && bpm <= MAX_REASONABLE_HEART_RATE }

        if (values.size < MIN_RESTING_ESTIMATE_SAMPLES) {
            return null
        }

        return average(values)
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
        return DayRange(entryDate, start, end, start.minus(Duration.ofHours(SLEEP_LOOKUP_HOURS_BEFORE_DAY)))
    }

    private fun minutesBetween(start: Instant, end: Instant): Double {
        return max(0.0, Duration.between(start, end).toMillis().toDouble() / MILLIS_PER_MINUTE)
    }

    private fun overlaps(recordStart: Instant, recordEnd: Instant, rangeStart: Instant, rangeEnd: Instant): Boolean {
        return recordEnd > rangeStart && recordStart < rangeEnd
    }

    private fun clampInstant(value: Instant, start: Instant, end: Instant): Instant {
        return when {
            value < start -> start
            value > end -> end
            else -> value
        }
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

    private fun installedKnownHealthSourcePackages(): List<String> {
        return XIAOMI_HEALTH_SOURCE_PACKAGES.filter { packageName -> isPackageInstalled(packageName) }
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
        val sleepLookupStart: Instant,
    )

    private data class HeartRateSample(
        val time: Instant,
        val bpm: Double,
    )

    private data class HeartRateSummaryResult(
        val summary: JSObject?,
        val restingSource: String,
        val estimatedRestingBpm: Double?,
        val sleepSampleCount: Int,
        val restingWindowStart: Instant?,
        val restingWindowEnd: Instant?,
    )

    companion object {
        private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
        private const val MI_FITNESS_PACKAGE = "com.xiaomi.wearable"
        private const val XIAOMI_HEALTH_PACKAGE = "com.mi.health"
        private const val ZEPP_LIFE_PACKAGE = "com.xiaomi.hm.health"
        private const val PROVIDER = "health-connect"
        private const val MILLIS_PER_MINUTE = 60000.0
        private const val SLEEP_LOOKUP_HOURS_BEFORE_DAY = 18L
        private const val MIN_REASONABLE_HEART_RATE = 25.0
        private const val MAX_REASONABLE_HEART_RATE = 240.0
        private const val MIN_RESTING_ESTIMATE_SAMPLES = 3
        private const val MAX_WORKOUT_SAMPLES = 2500
        private val XIAOMI_HEALTH_SOURCE_PACKAGES = listOf(
            MI_FITNESS_PACKAGE,
            XIAOMI_HEALTH_PACKAGE,
            ZEPP_LIFE_PACKAGE,
        )
        private val xiaomiHealthDataOrigins = XIAOMI_HEALTH_SOURCE_PACKAGES.map { packageName ->
            DataOrigin(packageName)
        }.toSet()
        private val requiredPermissions = setOf(
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        )
        private val requiredWorkoutPermissions = setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        )
        private val optionalWorkoutPermissions = setOf(
            HealthPermission.getReadPermission(SpeedRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        )
        private val permissions = requiredPermissions + optionalWorkoutPermissions
    }
}
