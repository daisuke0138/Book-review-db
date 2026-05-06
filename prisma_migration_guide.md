# Prisma Migration Guide

## Required Changes to Deploy

バックエンド側のスキーマ更新を本番環境に反映させるには、以下のコマンドを実行してください：

### Step 1: マイグレーションファイルの生成

```bash
npx prisma migrate dev --name add_library_card_number
```

このコマンドは以下の処理を実行します：
1. `libraryCardNumber` フィールドを User テーブルに追加
2. スキーマの同期
3. マイグレーション履歴の記録

### Step 2: 本番環境への反映（Supabaseで）

本番環境で以下のコマンドを実行：

```bash
npx prisma migrate deploy
```

## 変更内容

### schema.prisma の変更

User モデルに以下のフィールドを追加：
```prisma
libraryCardNumber String @unique
```

これにより、各ユーザーは固有の図書館カード番号を持つようになります。

### server.js の変更

`/api/auth/register` エンドポイントを更新：
- `libraryCardNumber` を登録リクエストから受け付けるように修正
- レスポンスに `libraryCardNumber` を含めるように修正

## バックエンド側の対応状況

✅ schema.prisma - User モデル更新完了
✅ server.js - 認証API更新完了
✅ その他のエンドポイント - 既にクライアント側の型定義に対応済み

## デプロイ手順

1. GitHub へのプッシュ
2. Vercel への自動デプロイ（またはVercel DashboardでDeploy）
3. 上記のマイグレーションコマンドを本番環境で実行
