import SwiftUI

@main
struct LifeSystemApp: App {
    @StateObject private var health = HealthKitManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(health)
                .task { await health.refresh() }
        }
    }
}
