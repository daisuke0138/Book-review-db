# Prisma Migration Guide

## 変更内容

### schema.prisma の変更
- `User`モデルから`email`と`password`フィールドを削除
- `username`と`libraryCardNumber`のみで認証する方式に変更

### server.js の変更
- `/api/auth/register`: username, libraryCardNumber のみで登録（重複チェック付き）
- `/api/auth/login`: username, libraryCardNumber で認証（パスワードなし）
- `/api/auth/me`: libraryCardNumber を返すように変更
- bcrypt を削除（パスワードハッシュ不要のため）

---

## データベースリセット手順

### 方法1: Supabase SQL Editor で直接実行（推奨）

1. Supabase Dashboard にログイン
   - https://supabase.com/dashboard/project/kzvnrnziwdjwxollfgag
2. 左メニューから「SQL Editor」を選択
3. `scripts/reset_database.sql` の内容をコピーして実行

### 方法2: Prisma を使用

```bash
cd api

# データベースをリセット（全データ削除）
npx prisma migrate reset

# マイグレーションを実行
npx prisma migrate deploy

# Prisma Client を再生成
npx prisma generate
```

---

## 本番環境（Vercel）への反映

1. このリポジトリをプッシュ
2. Vercel が自動でデプロイ
3. ビルド時に Prisma migrate が実行される

---

## 手動でスキーマを変更する場合（SQL）

```sql
-- email, password カラムを削除
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
```

---

## 確認用クエリ

```sql
-- Userテーブルの構造を確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
ORDER BY ordinal_position;
```

---

## バックエンド側の対応状況

- schema.prisma - User モデル更新完了（email, password削除）
- server.js - 認証API更新完了
- /api/auth/register - 重複チェック付きユーザー登録
- /api/auth/login - username + libraryCardNumber 認証
- /api/auth/me - libraryCardNumber を返却
- /api/books/latest-reviewed - 最新レビュー取得API
