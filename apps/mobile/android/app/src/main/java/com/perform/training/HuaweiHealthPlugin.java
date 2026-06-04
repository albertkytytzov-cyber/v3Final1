package com.perform.training;

import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.huawei.hmf.tasks.OnFailureListener;
import com.huawei.hmf.tasks.OnSuccessListener;
import com.huawei.hms.hihealth.ActivityRecordsController;
import com.huawei.hms.hihealth.DataController;
import com.huawei.hms.hihealth.HuaweiHiHealth;
import com.huawei.hms.hihealth.SettingController;
import com.huawei.hms.hihealth.data.ActivityRecord;
import com.huawei.hms.hihealth.data.ActivitySummary;
import com.huawei.hms.hihealth.data.DataType;
import com.huawei.hms.hihealth.data.Field;
import com.huawei.hms.hihealth.data.SamplePoint;
import com.huawei.hms.hihealth.data.SampleSet;
import com.huawei.hms.hihealth.data.Scopes;
import com.huawei.hms.hihealth.data.Value;
import com.huawei.hms.hihealth.options.ActivityRecordReadOptions;
import com.huawei.hms.hihealth.result.HealthKitAuthResult;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "HuaweiHealth")
public class HuaweiHealthPlugin extends Plugin {
    private static final String HUAWEI_HMS_PACKAGE = "com.huawei.hwid";
    private static final String HUAWEI_HEALTH_PACKAGE = "com.huawei.health";
    private static final String PROVIDER = "huawei-health";
    private static final String[] HEALTH_SCOPES = new String[] {
        Scopes.HEALTHKIT_SLEEP_READ,
        Scopes.HEALTHKIT_HEARTRATE_READ,
        Scopes.HEALTHKIT_ACTIVITY_READ,
        Scopes.HEALTHKIT_ACTIVITY_RECORD_READ,
        Scopes.HEALTHKIT_DISTANCE_READ,
        Scopes.HEALTHKIT_CALORIES_READ
    };

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        boolean hasHmsCore = isPackageInstalled(HUAWEI_HMS_PACKAGE);
        boolean hasHealth = isPackageInstalled(HUAWEI_HEALTH_PACKAGE);
        boolean hasAgConnectServices = BuildConfig.HAS_AGCONNECT_SERVICES;

        result.put("available", hasAgConnectServices && hasHmsCore && hasHealth);
        result.put("hasAgConnectServices", hasAgConnectServices);
        result.put("hasHmsCore", hasHmsCore);
        result.put("hasHuaweiHealth", hasHealth);
        result.put("hmsPackage", HUAWEI_HMS_PACKAGE);
        result.put("healthPackage", HUAWEI_HEALTH_PACKAGE);
        result.put("packageName", BuildConfig.APPLICATION_ID);
        result.put("provider", PROVIDER);
        result.put("scopes", new JSONArray(Arrays.asList(HEALTH_SCOPES)));

        if (!hasAgConnectServices) {
            result.put(
                "reason",
                "В Android-сборке нет agconnect-services.json. Настройте приложение com.perform.training в AppGallery Connect и добавьте файл в apps/mobile/android/app/."
            );
        } else if (!hasHmsCore) {
            result.put("reason", "На устройстве не найден HMS Core.");
        } else if (!hasHealth) {
            result.put("reason", "На устройстве не найдено приложение Huawei Health.");
        } else {
            result.put("reason", JSONObject.NULL);
        }

        call.resolve(result);
    }

    @PluginMethod
    public void requestAuthorization(PluginCall call) {
        if (!BuildConfig.HAS_AGCONNECT_SERVICES) {
            call.reject(
                "Huawei Health Kit не настроен в этой Android-сборке: нужен apps/mobile/android/app/agconnect-services.json."
            );
            return;
        }

        if (!isPackageInstalled(HUAWEI_HMS_PACKAGE) || !isPackageInstalled(HUAWEI_HEALTH_PACKAGE)) {
            call.reject("Нужны HMS Core и приложение Huawei Health на устройстве.");
            return;
        }

        try {
            SettingController settingController = HuaweiHiHealth.getSettingController(getActivity());
            Intent intent = settingController.requestAuthorizationIntent(HEALTH_SCOPES, true);
            startActivityForResult(call, intent, "handleAuthorizationResult");
        } catch (Exception error) {
            call.reject("Не удалось открыть авторизацию Huawei Health: " + safeMessage(error), error);
        }
    }

    @ActivityCallback
    private void handleAuthorizationResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        try {
            SettingController settingController = HuaweiHiHealth.getSettingController(getActivity());
            HealthKitAuthResult authResult = settingController.parseHealthKitAuthResultFromIntent(result.getData());
            JSObject response = new JSObject();
            boolean granted = authResult != null && authResult.isSuccess();

            response.put("granted", granted);
            response.put("reason", granted ? JSONObject.NULL : "Huawei Health не выдал разрешение на чтение данных.");

            call.resolve(response);
        } catch (Exception error) {
            call.reject("Ошибка авторизации Huawei Health: " + safeMessage(error), error);
        }
    }

    @PluginMethod
    public void readDailySummary(PluginCall call) {
        if (!BuildConfig.HAS_AGCONNECT_SERVICES) {
            call.reject(
                "Huawei Health Kit не настроен в этой Android-сборке: нужен apps/mobile/android/app/agconnect-services.json."
            );
            return;
        }

        String entryDate = call.getString("entryDate");

        if (entryDate == null || entryDate.trim().isEmpty()) {
            call.reject("entryDate is required");
            return;
        }

        final DayRange dayRange;
        try {
            dayRange = parseDayRange(entryDate);
        } catch (ParseException error) {
            call.reject("entryDate must use YYYY-MM-DD format", error);
            return;
        }

        DataController dataController = HuaweiHiHealth.getDataController(getActivity());
        List<DataType> dataTypes = Arrays.asList(
            DataType.DT_CONTINUOUS_SLEEP,
            DataType.DT_RESTING_HEART_RATE_STATISTICS,
            DataType.POLYMERIZE_CONTINUOUS_HEART_RATE_STATISTICS,
            DataType.POLYMERIZE_DISTANCE_DELTA,
            DataType.POLYMERIZE_CALORIES_EXPENDED,
            DataType.POLYMERIZE_CONTINUOUS_WORKOUT_DURATION
        );

        dataController
            .readDailySummation(dataTypes, dayRange.dateId, dayRange.dateId)
            .addOnSuccessListener(
                new OnSuccessListener<List<SampleSet>>() {
                    @Override
                    public void onSuccess(List<SampleSet> sampleSets) {
                        readActivityRecords(call, dayRange, sampleSets);
                    }
                }
            )
            .addOnFailureListener(
                new OnFailureListener() {
                    @Override
                    public void onFailure(Exception error) {
                        call.reject("Не удалось прочитать данные Huawei Health: " + safeMessage(error), error);
                    }
                }
            );
    }

    private void readActivityRecords(PluginCall call, DayRange dayRange, List<SampleSet> sampleSets) {
        ActivityRecordsController recordsController = HuaweiHiHealth.getActivityRecordsController(getActivity());
        ActivityRecordReadOptions options = new ActivityRecordReadOptions.Builder()
            .setTimeInterval(dayRange.startMillis, dayRange.endMillis, TimeUnit.MILLISECONDS)
            .readActivityRecordsFromAllApps()
            .allowRemoteInquiry()
            .build();

        recordsController
            .getActivityRecord(options)
            .addOnSuccessListener(
                reply -> call.resolve(toDailySummary(dayRange.entryDate, sampleSets, reply.getActivityRecords(), null))
            )
            .addOnFailureListener(
                error -> call.resolve(toDailySummary(dayRange.entryDate, sampleSets, null, safeMessage(error)))
            );
    }

    private JSObject toDailySummary(
        String entryDate,
        List<SampleSet> sampleSets,
        List<ActivityRecord> activityRecords,
        String activityRecordError
    ) {
        JSObject result = new JSObject();
        JSObject rawPayload = new JSObject();

        JSObject sleep = readSleepSummary(sampleSets);
        JSObject heartRate = readHeartRateSummary(sampleSets);
        JSObject workout = readWorkoutSummary(sampleSets, activityRecords);

        result.put("entryDate", entryDate);
        result.put("provider", PROVIDER);
        result.put("sourceDevice", "Huawei Health");
        putNullable(result, "sleep", sleep);
        putNullable(result, "heartRate", heartRate);
        putNullable(result, "workout", workout);
        result.put("syncedAt", isoNow());

        rawPayload.put("sampleSetCount", sampleSets == null ? 0 : sampleSets.size());
        rawPayload.put("activityRecordCount", activityRecords == null ? JSONObject.NULL : activityRecords.size());
        rawPayload.put("activityRecordError", activityRecordError == null ? JSONObject.NULL : activityRecordError);
        rawPayload.put("hasAgConnectServices", BuildConfig.HAS_AGCONNECT_SERVICES);
        rawPayload.put("hmsPackage", HUAWEI_HMS_PACKAGE);
        rawPayload.put("healthPackage", HUAWEI_HEALTH_PACKAGE);
        result.put("rawPayload", rawPayload);

        return result;
    }

    private JSObject readSleepSummary(List<SampleSet> sampleSets) {
        JSObject sleep = new JSObject();
        boolean hasData = false;

        for (SamplePoint point : allPoints(sampleSets)) {
            if (!DataType.DT_CONTINUOUS_SLEEP.equals(point.getDataType())) {
                continue;
            }

            Double lightMinutes = readNumber(point, "light_sleep_time");
            Double deepMinutes = readNumber(point, "deep_sleep_time");
            Double remMinutes = readNumber(point, "dream_time");
            Double awakeMinutes = readNumber(point, "awake_time");
            Double totalMinutes = readNumber(point, "all_sleep_time");
            Double score = readNumber(point, "sleep_score");
            Long startMillis = readLong(point, "fall_asleep_time");
            Long endMillis = readLong(point, "wakeup_time");

            hasData = hasData || lightMinutes != null || deepMinutes != null || remMinutes != null || totalMinutes != null || score != null;
            putNullableNumber(sleep, "lightMinutes", lightMinutes);
            putNullableNumber(sleep, "deepMinutes", deepMinutes);
            putNullableNumber(sleep, "remMinutes", remMinutes);
            putNullableNumber(sleep, "awakeMinutes", awakeMinutes);
            putNullableNumber(sleep, "durationMinutes", totalMinutes);
            putNullableNumber(sleep, "score", score);
            putNullable(sleep, "startTime", startMillis == null ? null : isoFromMillis(startMillis));
            putNullable(sleep, "endTime", endMillis == null ? null : isoFromMillis(endMillis));
        }

        return hasData ? sleep : null;
    }

    private JSObject readHeartRateSummary(List<SampleSet> sampleSets) {
        JSObject heartRate = new JSObject();
        boolean hasData = false;

        for (SamplePoint point : allPoints(sampleSets)) {
            if (!DataType.DT_RESTING_HEART_RATE_STATISTICS.equals(point.getDataType()) &&
                !DataType.POLYMERIZE_CONTINUOUS_HEART_RATE_STATISTICS.equals(point.getDataType())) {
                continue;
            }

            Double resting = readFirstNumber(point, "last", "avg", "resting_heart_rate", "bpm");
            Double average = readFirstNumber(point, "avg", "average", "bpm");
            Double min = readFirstNumber(point, "min", "min_bpm");
            Double max = readFirstNumber(point, "max", "max_bpm");

            hasData = hasData || resting != null || average != null || min != null || max != null;
            putNullableNumber(heartRate, "restingBpm", resting);
            putNullableNumber(heartRate, "averageBpm", average);
            putNullableNumber(heartRate, "minBpm", min);
            putNullableNumber(heartRate, "maxBpm", max);
            putNullable(heartRate, "hrvRmssdMs", null);
        }

        return hasData ? heartRate : null;
    }

    private JSObject readWorkoutSummary(List<SampleSet> sampleSets, List<ActivityRecord> activityRecords) {
        JSObject workout = new JSObject();
        int count = activityRecords == null ? 0 : activityRecords.size();
        double totalDurationMinutes = 0;
        Double totalDistanceMeters = null;
        Double activeCalories = null;
        Double averageHeartRate = null;
        Double maxHeartRate = null;

        if (activityRecords != null) {
            for (ActivityRecord record : activityRecords) {
                totalDurationMinutes += Math.max(0, record.getDurationTime(TimeUnit.MINUTES));

                ActivitySummary summary = record.getActivitySummary();
                if (summary == null || summary.getDataSummary() == null) {
                    continue;
                }

                for (SamplePoint point : summary.getDataSummary()) {
                    totalDistanceMeters = addNullable(totalDistanceMeters, readFirstNumber(point, "distance", "distance_delta"));
                    activeCalories = addNullable(activeCalories, readFirstNumber(point, "calories", "calories_total"));
                    averageHeartRate = prefer(averageHeartRate, readFirstNumber(point, "avg", "bpm"));
                    maxHeartRate = maxNullable(maxHeartRate, readFirstNumber(point, "max", "bpm"));
                }
            }
        }

        for (SamplePoint point : allPoints(sampleSets)) {
            totalDistanceMeters = addNullable(totalDistanceMeters, readFirstNumber(point, "distance", "distance_delta"));
            activeCalories = addNullable(activeCalories, readFirstNumber(point, "calories", "calories_total"));
            averageHeartRate = prefer(averageHeartRate, readFirstNumber(point, "avg", "bpm"));
            maxHeartRate = maxNullable(maxHeartRate, readFirstNumber(point, "max", "bpm"));

            if (totalDurationMinutes <= 0) {
                Double duration = readFirstNumber(point, "duration", "workout_duration");
                if (duration != null) {
                    totalDurationMinutes = duration;
                }
            }
        }

        boolean hasData = count > 0 || totalDurationMinutes > 0 || totalDistanceMeters != null || activeCalories != null;
        workout.put("count", count);
        putNullableNumber(workout, "totalDurationMinutes", totalDurationMinutes > 0 ? totalDurationMinutes : null);
        putNullableNumber(workout, "totalDistanceMeters", totalDistanceMeters);
        putNullableNumber(workout, "activeCalories", activeCalories);
        putNullableNumber(workout, "averageHeartRateBpm", averageHeartRate);
        putNullableNumber(workout, "maxHeartRateBpm", maxHeartRate);

        return hasData ? workout : null;
    }

    private List<SamplePoint> allPoints(List<SampleSet> sampleSets) {
        java.util.ArrayList<SamplePoint> points = new java.util.ArrayList<>();

        if (sampleSets == null) {
            return points;
        }

        for (SampleSet sampleSet : sampleSets) {
            if (sampleSet == null || sampleSet.getSamplePoints() == null) {
                continue;
            }
            points.addAll(sampleSet.getSamplePoints());
        }

        return points;
    }

    private Double readFirstNumber(SamplePoint point, String... fieldNames) {
        for (String fieldName : fieldNames) {
            Double value = readNumber(point, fieldName);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private Double readNumber(SamplePoint point, String fieldName) {
        Value value = readValue(point, fieldName);
        if (value == null || !value.isSet()) {
            return null;
        }

        try {
            int format = value.getFormat();

            if (format == Field.FORMAT_INT32) {
                return (double) value.asIntValue();
            }
            if (format == Field.FORMAT_FLOAT) {
                return (double) value.asFloatValue();
            }
            if (format == Field.FORMAT_LONG) {
                return (double) value.asLongValue();
            }
            if (format == Field.FORMAT_DOUBLE) {
                return value.asDoubleValue();
            }

            return null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long readLong(SamplePoint point, String fieldName) {
        Value value = readValue(point, fieldName);
        if (value == null || !value.isSet()) {
            return null;
        }

        try {
            if (value.getFormat() == Field.FORMAT_LONG) {
                return value.asLongValue();
            }
            if (value.getFormat() == Field.FORMAT_INT32) {
                return (long) value.asIntValue();
            }
        } catch (Exception ignored) {
            return null;
        }

        return null;
    }

    private Value readValue(SamplePoint point, String fieldName) {
        if (point == null || point.getDataType() == null || point.getDataType().getFields() == null) {
            return null;
        }

        for (Field field : point.getDataType().getFields()) {
            if (fieldName.equals(field.getName())) {
                return point.getFieldValue(field);
            }
        }

        return null;
    }

    private DayRange parseDayRange(String entryDate) throws ParseException {
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        dateFormat.setLenient(false);
        Date parsedDate = dateFormat.parse(entryDate);

        Calendar calendar = Calendar.getInstance();
        calendar.setTime(parsedDate);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);

        long startMillis = calendar.getTimeInMillis();
        int dateId = calendar.get(Calendar.YEAR) * 10000 + (calendar.get(Calendar.MONTH) + 1) * 100 + calendar.get(Calendar.DAY_OF_MONTH);
        calendar.add(Calendar.DAY_OF_MONTH, 1);

        return new DayRange(entryDate, dateId, startMillis, calendar.getTimeInMillis() - 1);
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }

    private static void putNullable(JSObject object, String key, Object value) {
        try {
            object.put(key, value == null ? JSONObject.NULL : value);
        } catch (Exception ignored) {}
    }

    private static void putNullableNumber(JSObject object, String key, Double value) {
        try {
            object.put(key, value == null ? JSONObject.NULL : value);
        } catch (Exception ignored) {}
    }

    private static Double addNullable(Double left, Double right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left + right;
    }

    private static Double maxNullable(Double left, Double right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return Math.max(left, right);
    }

    private static Double prefer(Double current, Double next) {
        return current == null ? next : current;
    }

    private static String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
    }

    private static String isoNow() {
        return isoFromMillis(System.currentTimeMillis());
    }

    private static String isoFromMillis(long millis) {
        SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
        return isoFormat.format(new Date(millis));
    }

    private static final class DayRange {
        final String entryDate;
        final int dateId;
        final long startMillis;
        final long endMillis;

        DayRange(String entryDate, int dateId, long startMillis, long endMillis) {
            this.entryDate = entryDate;
            this.dateId = dateId;
            this.startMillis = startMillis;
            this.endMillis = endMillis;
        }
    }
}
