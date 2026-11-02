# トレ部

仲間とトレーニングを記録・共有する、シンプルなPWA。

公開先: https://taichidoi0509-stack.github.io/torebu/

## 構成

- HTML / CSS / JavaScript、GitHub Pages（mainブランチのdocsフォルダ）
- Supabase Auth: 森研麻雀倶楽部と同じ既存アカウントでログイン
- Supabaseの専用テーブル: torebu_profiles / torebu_groups / torebu_members / torebu_workouts / torebu_likes / torebu_comments
- 既存の麻雀テーブル・RPC・メール設定には変更なし
- グループごとのRLS、投稿者だけ削除可能
- Supabase Realtimeで更新。接続不良時は15秒間隔で再読込
- PWA、部位別の種目選択、セット別の重量・回数、前回コピー、独自種目、自己ベスト

## 開発

```
npm ci
npm test
npm run build
```

ビルド結果はdocs/。mainへpushするとGitHub Pagesに反映される。公開する構成情報はプロジェクトURLとpublishable keyのみ。service_roleやSMTPの資格情報は使用しない。

## アカウント

麻雀アプリと同じメールアドレス・パスワードを使用する。ログイン状態はトレ部用に分けて保存し、トレ部からのログアウトで麻雀側のセッションは終了しない。

既存の認証設定を変更しないため、新規登録の確認メール・パスワード再設定メールのリンク先は麻雀アプリ。確認後はトレ部へ戻ってログインする。パスワード変更は共用アカウントのため両アプリに適用される。

## 検証

- npm test: GitHub Pages用の相対パス、PWAアセット、認証先、専用スキーマ定義を確認
- tests/rls.sql: 実Postgresでグループ分離、招待コード参加、所有者だけの削除、不正な入力、所有者の偽装、匿名ユーザー拒否を検証。検証データは最後にrollback
- 新規トレ部テーブルについてSupabaseセキュリティ検査で新しい指摘なし

## 制限

- 一覧・自己ベスト・前回コピーは最新500件の記録が対象
- オフライン共有は不可。入力中の下書きはアカウント・グループ別に端末内へ保持
- 以前のSites版のデータは自動移行していない。旧環境は削除しない
- メール配信・既存パスワードでの実際のログインは本人のアカウントで確認する必要がある
