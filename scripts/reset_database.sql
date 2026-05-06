-- ============================================
-- データベースリセット用SQLスクリプト
-- Supabaseの SQL Editor で実行してください
-- ============================================

-- 注意: このスクリプトはすべてのデータを削除します！
-- 実行前に必ずバックアップを取ってください。

-- 1. まず既存のデータを削除（外部キー制約の順序で削除）
TRUNCATE TABLE "Like" CASCADE;
TRUNCATE TABLE "Post" CASCADE;
TRUNCATE TABLE "Book" CASCADE;
TRUNCATE TABLE "User" CASCADE;

-- 2. シーケンス（ID）をリセット
ALTER SEQUENCE "Like_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Post_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Book_id_seq" RESTART WITH 1;
ALTER SEQUENCE "User_id_seq" RESTART WITH 1;

-- 3. Userテーブルのスキーマを変更（email, passwordカラムを削除）
-- 既存のカラムが存在する場合のみ削除
DO $$
BEGIN
    -- emailカラムが存在する場合は削除
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'email'
    ) THEN
        ALTER TABLE "User" DROP COLUMN "email";
    END IF;
    
    -- passwordカラムが存在する場合は削除
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'password'
    ) THEN
        ALTER TABLE "User" DROP COLUMN "password";
    END IF;
END $$;

-- 確認用: 現在のUserテーブル構造を表示
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
ORDER BY ordinal_position;
