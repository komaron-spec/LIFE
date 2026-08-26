import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var health: HealthKitManager
    @State private var showingHealthAccess = false

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    header
                    playerCard
                    healthCard
                    effectsCard
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
        }
        .preferredColorScheme(.light)
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text("WORLD TIME").hudLabel()
                Text(Date.now, format: .dateTime.hour().minute())
                    .font(.system(size: 47, weight: .light, design: .monospaced))
                Text(Date.now, format: .dateTime.weekday(.wide).day().month(.wide))
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Spacer()
            Button { Task { await health.refresh() } } label: {
                VStack(spacing: 3) { Text("SYNC").hudLabel(); Text("↻").font(.title3) }
                    .padding(11).glass()
            }
        }
    }

    private var playerCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("PLAYER").hudLabel()
                    Text("PLAYER ONE").font(.title3.weight(.medium))
                    Text("WORLD WALKER").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                LevelRing(level: health.player.level, progress: Double(health.player.exp) / 500)
            }
            ParameterBar(label: "HP", value: health.player.hp, color: .pink)
            ParameterBar(label: "ENERGY", value: health.player.energy, color: .mint)
            ParameterBar(label: "FOCUS", value: health.player.focus, color: .cyan)
        }
        .padding(21).glass()
    }

    private var healthCard: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack { Text("HEALTHKIT LINK").hudLabel(); Spacer(); Text(health.statusMessage).hudLabel() }
            HStack(spacing: 8) {
                HealthMetric(value: "\(Int(health.snapshot.steps))", label: "STEPS")
                HealthMetric(value: "\(Int(health.snapshot.activeEnergy))", label: "ACTIVE KCAL")
                HealthMetric(value: String(format: "%.1f", health.snapshot.sleepHours), label: "SLEEP H")
            }
            Button(health.isAuthorized ? "REFRESH HEALTH SYNC" : "CONNECT APPLE HEALTH") {
                Task { if health.isAuthorized { await health.refresh() } else { await health.requestAccess() } }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.25, green: 0.22, blue: 0.38))
        }
        .padding(21).glass()
    }

    private var effectsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("STATUS EFFECT").hudLabel()
            ForEach(Array(health.player.effects.enumerated()), id: \.offset) { _, effect in
                HStack(spacing: 10) {
                    Circle().fill(effect.2.color).frame(width: 9, height: 9)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(effect.0).font(.system(.subheadline, design: .monospaced))
                        Text(effect.1).font(.caption).foregroundStyle(.secondary)
                    }
                }.padding(11).background(.white.opacity(0.4), in: RoundedRectangle(cornerRadius: 16))
            }
        }.padding(21).glass()
    }
}

private struct LevelRing: View {
    let level: Int; let progress: Double
    var body: some View { ZStack { Circle().stroke(.white.opacity(0.6), lineWidth: 5); Circle().trim(from: 0, to: progress).stroke(AngularGradient(colors: [.pink, .purple, .cyan], center: .center), style: StrokeStyle(lineWidth: 5, lineCap: .round)).rotationEffect(.degrees(-90)); VStack(spacing: 0) { Text("LV").hudLabel(); Text("\(level)").font(.title3.monospaced()) } }.frame(width: 70, height: 70) }
}

private struct HealthMetric: View {
    let value: String; let label: String
    var body: some View { VStack(alignment: .leading, spacing: 5) { Text(value).font(.system(.subheadline, design: .monospaced)); Text(label).hudLabel() }.frame(maxWidth: .infinity, alignment: .leading).padding(11).background(.white.opacity(0.43), in: RoundedRectangle(cornerRadius: 16)) }
}

private struct ParameterBar: View {
    let label: String; let value: Int; let color: Color
    var body: some View { VStack(spacing: 5) { HStack { Text(label).hudLabel(); Spacer(); Text("\(value)").font(.caption.monospaced()) }; ProgressView(value: Double(value), total: 100).tint(color) } }
}

private struct AmbientBackground: View {
    var body: some View { LinearGradient(colors: [Color.white, Color(red: 0.97, green: 0.94, blue: 1), Color(red: 0.9, green: 0.97, blue: 1)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea().overlay(Circle().fill(.pink.opacity(0.17)).blur(radius: 70).offset(x: -120, y: -260)) }
}

private extension View {
    func glass() -> some View { background(.white.opacity(0.58), in: RoundedRectangle(cornerRadius: 28)).overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.9))) }
    func hudLabel() -> some View { font(.system(size: 9, weight: .medium, design: .monospaced)).tracking(1.4).foregroundStyle(.secondary) }
}

private extension StateTone {
    var color: Color { switch self { case .good: .mint; case .focus: .cyan; case .low: .pink; case .calm: .purple } }
}
