import Capacitor
import Foundation
import HealthKit

@objc(AppleHealthPlugin)
class AppleHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "AppleHealthPlugin"
    let jsName = "AppleHealth"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDailySummary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDailyWorkouts", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()
    private let isoFormatter = ISO8601DateFormatter()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": HKHealthStore.isHealthDataAvailable(),
            "reason": HKHealthStore.isHealthDataAvailable() ? NSNull() : "Apple Health недоступен на этом устройстве."
        ])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve([
                "granted": false,
                "reason": "Apple Health недоступен на этом устройстве."
            ])
            return
        }

        healthStore.requestAuthorization(toShare: [], read: readableTypes()) { success, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject("Не удалось запросить доступ Apple Health: \(error.localizedDescription)", nil, error)
                    return
                }

                call.resolve([
                    "granted": success,
                    "reason": success ? NSNull() : "Нет разрешения Apple Health на чтение данных."
                ])
            }
        }
    }

    @objc func readDailySummary(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health недоступен на этом устройстве.")
            return
        }

        guard let window = dayWindow(from: call.getString("entryDate")) else {
            call.reject("entryDate должен быть в формате YYYY-MM-DD.")
            return
        }

        let group = DispatchGroup()
        var sleep: [String: Any]?
        var heartRate: [String: Any]?
        var oxygen: [String: Any]?
        var workout: [String: Any]?
        var errors: [String] = []

        group.enter()
        querySleep(start: window.start, end: window.end) { result, error in
            sleep = result
            if let error = error { errors.append(error) }
            group.leave()
        }

        group.enter()
        queryHeartRate(start: window.start, end: window.end) { result, error in
            heartRate = result
            if let error = error { errors.append(error) }
            group.leave()
        }

        group.enter()
        queryOxygenSaturation(start: window.start, end: window.end) { result, error in
            oxygen = result
            if let error = error { errors.append(error) }
            group.leave()
        }

        group.enter()
        queryWorkoutSummary(start: window.start, end: window.end) { result, error in
            workout = result
            if let error = error { errors.append(error) }
            group.leave()
        }

        group.notify(queue: .main) {
            var rawPayload: [String: Any] = [
                "provider": "apple-health",
                "windowStart": self.iso(window.start),
                "windowEnd": self.iso(window.end)
            ]
            if !errors.isEmpty {
                rawPayload["queryErrors"] = errors
            }

            call.resolve([
                "entryDate": window.entryDate,
                "provider": "apple-health",
                "sourceDevice": "Apple Health",
                "sleep": sleep ?? NSNull(),
                "heartRate": heartRate ?? NSNull(),
                "oxygenSaturation": oxygen ?? NSNull(),
                "workout": workout ?? NSNull(),
                "rawPayload": rawPayload,
                "syncedAt": self.iso(Date())
            ])
        }
    }

    @objc func readDailyWorkouts(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health недоступен на этом устройстве.")
            return
        }

        guard let window = dayWindow(from: call.getString("entryDate")) else {
            call.reject("entryDate должен быть в формате YYYY-MM-DD.")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: window.start, end: window.end, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [sort]
        ) { _, samples, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject("Не удалось прочитать тренировки Apple Health: \(error.localizedDescription)", nil, error)
                    return
                }

                let workouts = (samples as? [HKWorkout] ?? []).map { workout in
                    self.mapWorkout(workout, entryDate: window.entryDate)
                }

                call.resolve([
                    "entryDate": window.entryDate,
                    "provider": "apple-health",
                    "workouts": workouts
                ])
            }
        }

        healthStore.execute(query)
    }

    private func readableTypes() -> Set<HKObjectType> {
        var types: [HKObjectType] = [
            HKObjectType.workoutType()
        ]

        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.append(sleep)
        }
        if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
            types.append(heartRate)
        }
        if let restingHeartRate = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            types.append(restingHeartRate)
        }
        if let oxygen = HKObjectType.quantityType(forIdentifier: .oxygenSaturation) {
            types.append(oxygen)
        }

        return Set(types)
    }

    private func dayWindow(from entryDate: String?) -> (entryDate: String, start: Date, end: Date)? {
        guard let entryDate = entryDate else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"

        guard let date = formatter.date(from: entryDate) else {
            return nil
        }

        let calendar = Calendar.current
        let start = calendar.startOfDay(for: date)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else {
            return nil
        }

        return (entryDate, start, end)
    }

    private func querySleep(
        start: Date,
        end: Date,
        completion: @escaping ([String: Any]?, String?) -> Void
    ) {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            completion(nil, "Тип сна Apple Health недоступен.")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(
            sampleType: sleepType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [sort]
        ) { _, samples, error in
            if let error = error {
                completion(nil, "Сон: \(error.localizedDescription)")
                return
            }

            let sleepSamples = samples as? [HKCategorySample] ?? []
            guard !sleepSamples.isEmpty else {
                completion(nil, nil)
                return
            }

            var awakeMinutes = 0.0
            var deepMinutes = 0.0
            var lightMinutes = 0.0
            var remMinutes = 0.0
            var unspecifiedSleepMinutes = 0.0
            var firstSleepStart: Date?
            var lastSleepEnd: Date?

            for sample in sleepSamples {
                let minutes = self.overlapMinutes(sampleStart: sample.startDate, sampleEnd: sample.endDate, dayStart: start, dayEnd: end)
                guard minutes > 0 else { continue }

                if self.isSleepValue(sample.value) {
                    firstSleepStart = minDate(firstSleepStart, sample.startDate)
                    lastSleepEnd = maxDate(lastSleepEnd, sample.endDate)
                }

                if #available(iOS 16.0, *) {
                    switch sample.value {
                    case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
                        lightMinutes += minutes
                    case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
                        deepMinutes += minutes
                    case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
                        remMinutes += minutes
                    case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue:
                        unspecifiedSleepMinutes += minutes
                    case HKCategoryValueSleepAnalysis.awake.rawValue:
                        awakeMinutes += minutes
                    default:
                        if sample.value == HKCategoryValueSleepAnalysis.asleep.rawValue {
                            unspecifiedSleepMinutes += minutes
                        }
                    }
                } else if sample.value == HKCategoryValueSleepAnalysis.asleep.rawValue {
                    unspecifiedSleepMinutes += minutes
                }
            }

            let durationMinutes = deepMinutes + lightMinutes + remMinutes + unspecifiedSleepMinutes
            guard durationMinutes > 0 else {
                completion(nil, nil)
                return
            }

            completion([
                "awakeMinutes": self.nullableNumber(awakeMinutes > 0 ? awakeMinutes : nil),
                "deepMinutes": self.nullableNumber(deepMinutes > 0 ? deepMinutes : nil),
                "durationMinutes": durationMinutes,
                "endTime": lastSleepEnd.map { self.iso($0) } ?? NSNull(),
                "lightMinutes": self.nullableNumber((lightMinutes + unspecifiedSleepMinutes) > 0 ? lightMinutes + unspecifiedSleepMinutes : nil),
                "remMinutes": self.nullableNumber(remMinutes > 0 ? remMinutes : nil),
                "score": NSNull(),
                "startTime": firstSleepStart.map { self.iso($0) } ?? NSNull()
            ], nil)
        }

        healthStore.execute(query)
    }

    private func queryHeartRate(
        start: Date,
        end: Date,
        completion: @escaping ([String: Any]?, String?) -> Void
    ) {
        let group = DispatchGroup()
        var heartRateStats: (average: Double?, min: Double?, max: Double?)?
        var restingHeartRate: Double?
        var errors: [String] = []

        group.enter()
        queryQuantityStats(
            identifier: .heartRate,
            unit: HKUnit.count().unitDivided(by: .minute()),
            start: start,
            end: end
        ) { stats, error in
            heartRateStats = stats
            if let error = error { errors.append(error) }
            group.leave()
        }

        group.enter()
        queryQuantityStats(
            identifier: .restingHeartRate,
            unit: HKUnit.count().unitDivided(by: .minute()),
            start: start,
            end: end
        ) { stats, error in
            restingHeartRate = stats.average
            if let error = error { errors.append(error) }
            group.leave()
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            let hasData = restingHeartRate != nil ||
                heartRateStats?.average != nil ||
                heartRateStats?.min != nil ||
                heartRateStats?.max != nil

            guard hasData else {
                completion(nil, errors.first)
                return
            }

            completion([
                "averageBpm": self.nullableNumber(heartRateStats?.average),
                "hrvRmssdMs": NSNull(),
                "maxBpm": self.nullableNumber(heartRateStats?.max),
                "minBpm": self.nullableNumber(heartRateStats?.min),
                "restingBpm": self.nullableNumber(restingHeartRate)
            ], errors.first)
        }
    }

    private func queryOxygenSaturation(
        start: Date,
        end: Date,
        completion: @escaping ([String: Any]?, String?) -> Void
    ) {
        guard let oxygenType = HKObjectType.quantityType(forIdentifier: .oxygenSaturation) else {
            completion(nil, nil)
            return
        }

        let group = DispatchGroup()
        var stats: (average: Double?, min: Double?, max: Double?)?
        var latest: Double?
        var sampleCount = 0
        var errors: [String] = []

        group.enter()
        queryQuantityStats(identifier: .oxygenSaturation, unit: HKUnit.percent(), start: start, end: end) { result, error in
            stats = (
                average: result.average.map { $0 * 100 },
                min: result.min.map { $0 * 100 },
                max: result.max.map { $0 * 100 }
            )
            if let error = error { errors.append(error) }
            group.leave()
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let latestSort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        group.enter()
        let latestQuery = HKSampleQuery(
            sampleType: oxygenType,
            predicate: predicate,
            limit: 1,
            sortDescriptors: [latestSort]
        ) { _, samples, error in
            if let error = error { errors.append("SpO2 latest: \(error.localizedDescription)") }
            if let quantity = (samples as? [HKQuantitySample])?.first?.quantity {
                latest = quantity.doubleValue(for: HKUnit.percent()) * 100
            }
            group.leave()
        }
        healthStore.execute(latestQuery)

        group.enter()
        let countQuery = HKSampleQuery(
            sampleType: oxygenType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, error in
            if let error = error { errors.append("SpO2 count: \(error.localizedDescription)") }
            sampleCount = samples?.count ?? 0
            group.leave()
        }
        healthStore.execute(countQuery)

        group.notify(queue: .global(qos: .userInitiated)) {
            let hasData = latest != nil || stats?.average != nil || sampleCount > 0
            guard hasData else {
                completion(nil, errors.first)
                return
            }

            completion([
                "averagePercent": self.nullableNumber(stats?.average),
                "latestPercent": self.nullableNumber(latest),
                "maxPercent": self.nullableNumber(stats?.max),
                "minPercent": self.nullableNumber(stats?.min),
                "sampleCount": sampleCount
            ], errors.first)
        }
    }

    private func queryWorkoutSummary(
        start: Date,
        end: Date,
        completion: @escaping ([String: Any]?, String?) -> Void
    ) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, error in
            if let error = error {
                completion(nil, "Тренировки: \(error.localizedDescription)")
                return
            }

            let workouts = samples as? [HKWorkout] ?? []
            completion(self.summarizeWorkouts(workouts), nil)
        }

        healthStore.execute(query)
    }

    private func queryQuantityStats(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date,
        completion: @escaping ((average: Double?, min: Double?, max: Double?), String?) -> Void
    ) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            completion((nil, nil, nil), nil)
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: predicate,
            options: [.discreteAverage, .discreteMin, .discreteMax]
        ) { _, statistics, error in
            if let error = error {
                completion((nil, nil, nil), "\(identifier.rawValue): \(error.localizedDescription)")
                return
            }

            completion((
                statistics?.averageQuantity()?.doubleValue(for: unit),
                statistics?.minimumQuantity()?.doubleValue(for: unit),
                statistics?.maximumQuantity()?.doubleValue(for: unit)
            ), nil)
        }

        healthStore.execute(query)
    }

    private func summarizeWorkouts(_ workouts: [HKWorkout]) -> [String: Any] {
        var durationMinutes = 0.0
        var distanceMeters = 0.0
        var hasDistance = false
        var activeCalories = 0.0
        var hasCalories = false

        for workout in workouts {
            durationMinutes += workout.duration / 60

            if let distance = workout.totalDistance {
                distanceMeters += distance.doubleValue(for: HKUnit.meter())
                hasDistance = true
            }

            if let calories = workout.totalEnergyBurned {
                activeCalories += calories.doubleValue(for: HKUnit.kilocalorie())
                hasCalories = true
            }
        }

        return [
            "activeCalories": nullableNumber(hasCalories ? activeCalories : nil),
            "averageHeartRateBpm": NSNull(),
            "count": workouts.count,
            "maxHeartRateBpm": NSNull(),
            "totalDistanceMeters": nullableNumber(hasDistance ? distanceMeters : nil),
            "totalDurationMinutes": nullableNumber(workouts.isEmpty ? nil : durationMinutes)
        ]
    }

    private func mapWorkout(_ workout: HKWorkout, entryDate: String) -> [String: Any] {
        return [
            "activeCalories": nullableNumber(workout.totalEnergyBurned?.doubleValue(for: HKUnit.kilocalorie())),
            "averageHeartRateBpm": NSNull(),
            "distanceMeters": nullableNumber(workout.totalDistance?.doubleValue(for: HKUnit.meter())),
            "durationMinutes": workout.duration / 60,
            "endTime": iso(workout.endDate),
            "entryDate": entryDate,
            "maxHeartRateBpm": NSNull(),
            "minHeartRateBpm": NSNull(),
            "provider": "apple-health",
            "rawPayload": [
                "activityType": workout.workoutActivityType.rawValue,
                "sourceBundleIdentifier": workout.sourceRevision.source.bundleIdentifier
            ],
            "samples": [],
            "sourceDevice": sourceDeviceLabel(for: workout),
            "sourceWorkoutId": workout.uuid.uuidString,
            "startTime": iso(workout.startDate),
            "syncedAt": iso(Date()),
            "workoutType": workoutTypeLabel(workout.workoutActivityType)
        ]
    }

    private func workoutTypeLabel(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running:
            return "running"
        case .walking:
            return "walking"
        case .cycling:
            return "cycling"
        case .swimming:
            return "swimming"
        case .traditionalStrengthTraining, .functionalStrengthTraining:
            return "strength"
        case .wrestling:
            return "wrestling"
        case .mixedCardio, .highIntensityIntervalTraining:
            return "conditioning"
        default:
            return "workout"
        }
    }

    private func isSleepValue(_ value: Int) -> Bool {
        if value == HKCategoryValueSleepAnalysis.asleep.rawValue {
            return true
        }

        if #available(iOS 16.0, *) {
            return value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                value == HKCategoryValueSleepAnalysis.asleepREM.rawValue ||
                value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
        }

        return false
    }

    private func overlapMinutes(sampleStart: Date, sampleEnd: Date, dayStart: Date, dayEnd: Date) -> Double {
        let start = max(sampleStart, dayStart)
        let end = min(sampleEnd, dayEnd)
        return max(0, end.timeIntervalSince(start) / 60)
    }

    private func sourceDeviceLabel(for workout: HKWorkout) -> String {
        if let deviceName = workout.device?.name, !deviceName.isEmpty {
            return deviceName
        }

        let sourceName = workout.sourceRevision.source.name
        return sourceName.isEmpty ? "Apple Health" : sourceName
    }

    private func nullableNumber(_ value: Double?) -> Any {
        guard let value = value, value.isFinite else {
            return NSNull()
        }
        return value
    }

    private func iso(_ date: Date) -> String {
        return isoFormatter.string(from: date)
    }
}

private func minDate(_ left: Date?, _ right: Date) -> Date {
    guard let left = left else {
        return right
    }
    return min(left, right)
}

private func maxDate(_ left: Date?, _ right: Date) -> Date {
    guard let left = left else {
        return right
    }
    return max(left, right)
}
