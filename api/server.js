// まずはexpressというnode.jsの機能を使えるように読み込みましょう🤗
const express = require("express");

// ここで実行をし、appの中にexpressの機能を使えるようにしています🤗
const app = express();

// prismaのclientの機能を使えるようにする🤗
const { PrismaClient } = require("@prisma/client");

// パスワードハッシュ化
const bcrypt = require("bcrypt");

// json web token jwtの機能を設定します🤗
const jwt = require("jsonwebtoken");

// 環境変数=秘密の鍵が使えるようにdotenvを記述して使えるようにします🤗
require("dotenv");

// PORT=は起動するURLの番号になります🤗とても重要なので今回は統一してください🤗
const PORT = 8888;

// clientの機能を使えるように設定する
const prisma = new PrismaClient();

// jsで書いた文字列をjsonとしてexpressで使えるようにする必要があります🤗
app.use(express.json());

// 新規ユーザーAPI
app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;

    // 暗号化対応=bcryptを使ってハッシュ化する🤗
    const hasedPass = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            username,
            email,
            password: hasedPass,
        },
    });

    return res.json({ user });
});

// ログインAPI
app.post("/api/auth/login", async (req, res) => {
    // email, passwordをチェックするために取得します🤗
    const { email, password } = req.body;

    // whereはSQL等で出てくる条件を絞るという条件です🤗
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(401).json({
            error: "そのユーザーは存在しません",
        });
    }

    //compare bcryptのcompareは比較をしてチェックするおまじないです🤗
    const isPasswordCheck = await bcrypt.compare(password, user.password);

    if (!isPasswordCheck) {
        return res.status(401).json({
            error: "そのパスワードは間違っていますよ！",
        });
    }

    // token = チケットのイメージです🤗
    const token = jwt.sign({ id: user.id }, process.env.KEY, {
        expiresIn: "1d",
    });

    return res.json({ token });
});

// ここでサーバーを起動します！！🤗
app.listen(PORT, () => console.log("server start!!!"));