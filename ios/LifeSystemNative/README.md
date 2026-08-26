# LIFE SYSTEM Native for iPhone

HealthKit対応のSwiftUI版です。歩数・アクティブエネルギー・睡眠時間をiPhone内でPLAYERのHP / ENERGY / FOCUS / EXPへ変換します。健康データはネットワーク送信しません。

## Macでの起動

1. MacにXcodeとXcodeGenを入れる（`brew install xcodegen`）。
2. このフォルダで `xcodegen generate` を実行。
3. `LifeSystem.xcodeproj` をXcodeで開く。
4. Signing & Capabilitiesで自分のApple Teamを選択し、HealthKitを有効にする。
5. 実機のiPhoneを選び、Runする。

初回起動時に「CONNECT APPLE HEALTH」をタップすると、歩数・アクティブエネルギー・睡眠分析の読み取り許可が表示されます。

> HealthKitの仕様上、利用者が読み取りを許可しなかった場合は、アプリにはデータがないように見えます。これはiOSのプライバシー保護です。
