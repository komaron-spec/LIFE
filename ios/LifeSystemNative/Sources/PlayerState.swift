import Foundation

struct HealthSnapshot {
    var steps: Double = 0
    var activeEnergy: Double = 0
    var sleepHours: Double = 0
}

struct PlayerState {
    var level: Int = 1
    var exp: Int = 120
    var hp: Int = 86
    var energy: Int = 72
    var focus: Int = 61

    mutating func update(from snapshot: HealthSnapshot, now: Date = .now) {
        let hour = Calendar.current.component(.hour, from: now)
        let sleepScore = snapshot.sleepHours == 0 ? 62 : min(100, max(20, Int(snapshot.sleepHours * 12)))
        let timeModifier = hour >= 22 || hour < 5 ? -14 : hour >= 17 ? -5 : 4
        let movementBonus = min(10, Int(snapshot.steps / 1_200))
        energy = min(100, max(15, sleepScore + timeModifier + movementBonus))
        hp = min(100, max(20, Int(Double(energy) * 0.65 + min(25, snapshot.activeEnergy / 12))))
        focus = min(100, max(15, Int(Double(energy) * 0.62 + (hour < 12 ? 18 : 4))))
        exp = min(500, 120 + Int(snapshot.steps / 90) + Int(snapshot.activeEnergy / 8))
        level = max(1, exp / 100 + 1)
    }

    var effects: [(String, String, StateTone)] {
        if energy < 40 { return [("TIRED", "今日は回復を優先できそうです。", .low)] }
        if focus >= 75 { return [("FOCUSED", "静かな集中状態です。", .focus)] }
        if energy >= 75 { return [("WELL RESTED", "行動しやすい状態です。", .good)] }
        return [("BALANCED", "いまのペースを保っています。", .calm)]
    }
}

enum StateTone { case good, focus, low, calm }
