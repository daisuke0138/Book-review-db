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
require("dotenv").config();

//CORS対策
const cors = require("cors");


// PORT=は起動するURLの番号になります🤗とても重要なので今回は統一してください🤗
const PORT = 8888;

// clientの機能を使えるように設定する
const prisma = new PrismaClient();

// jsで書いた文字列をjsonとしてexpressで使えるようにする必要があります🤗
app.use(cors({
    origin: "https://book-review-sage-seven.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));

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

// 投稿用API
app.post("/api/post", async (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({
            message: "投稿内容がありません！",
        });
    }

    try {
        // 登録の処理を記述していく🤗
        const newPost = await prisma.post.create({
            data: {
                content,
                authorId: 1, //MEMO: 最後に修正します🤗
            },
            include: {
                author: true,
            },
        });
        res.status(201).json(newPost);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "サーバーエラーです！項目がおかしい、何か見直してください！",
        });
    }
});

// 取得用API
app.get("/api/get_post", async (req, res) => {
    try {
        // 取得の処理を記述していく🤗
        const postData = await prisma.post.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
                author: true,
            },
        });
        res.status(201).json(postData);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "サーバーエラーです！項目がおかしい、何か見直してください！",
        });
    }
});

// local環境ここでサーバーを起動します！！🤗
// app.listen(PORT, () => console.log("server start!!!"));


// 本番環境ここでサーバーを起動します！！
module.exports = app;
