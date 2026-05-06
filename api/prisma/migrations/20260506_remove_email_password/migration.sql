-- Migration: Remove email and password columns from User table
-- Date: 2026-05-06
-- Description: ログイン方式をemail/passwordからusername/libraryCardNumber認証に変更

-- Drop email column
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";

-- Drop password column  
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
