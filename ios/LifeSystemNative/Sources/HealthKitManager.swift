import Foundation
import HealthKit

@MainActor
final class HealthKitManager: ObservableObject {
    @Published private(set) var snapshot = HealthSnapshot()
    @Published private(set) var player = PlayerState()
    @Published private(set) var isAuthorized = false
    @Published private(set) var statusMessage = "HEALTH DATA NOT CONNECTED"

    private let store = HKHealthStore()
    private let stepType = HKQuantityType(.stepCount)
    private let activeEnergyType = HKQuantityType(.activeEnergyBurned)
    private let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!

    func requestAccess() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            statusMessage = "HEALTH DATA UNAVAILABLE"
            return
        }
        do {
            try await store.requestAuthorization(toShare: [], read: [stepType, activeEnergyType, sleepType])
            isAuthorized = true
            statusMessage = "HEALTH SYNC ACTIVE"
            await refresh()
        } catch {
            statusMessage = "HEALTH ACCESS REQUIRED"
        }
    }

    func refresh() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        async let steps = cumulativeQuantity(for: stepType, unit: .count())
        async let activeEnergy = cumulativeQuantity(for: activeEnergyType, unit: .kilocalorie())
        async let sleep = sleepDuration()
        snapshot = HealthSnapshot(steps: await steps, activeEnergy: await activeEnergy, sleepHours: await sleep)
        player.update(from: snapshot)
        if isAuthorized { statusMessage = "HEALTH SYNC COMPLETE" }
    }

    private func cumulativeQuantity(for type: HKQuantityType, unit: HKUnit) async -> Double {
        await withCheckedContinuation { continuation in
            let start = Calendar.current.startOfDay(for: .now)
            let predicate = HKQuery.predicateForSamples(withStart: start, end: .now)
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, _ in
                continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit) ?? 0)
            }
            store.execute(query)
        }
    }

    private func sleepDuration() async -> Double {
        await withCheckedContinuation { continuation in
            let start = Calendar.current.date(byAdding: .hour, value: -18, to: .now)!
            let predicate = HKQuery.predicateForSamples(withStart: start, end: .now)
            let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                let seconds = (samples as? [HKCategorySample] ?? []).reduce(0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                continuation.resume(returning: seconds / 3_600)
            }
            store.execute(query)
        }
    }
}
