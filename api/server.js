const express = require("express");
const app = express();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer"); // 画像転送
const sharp = require("sharp"); // 画像圧縮
const { createClient } = require("@supabase/supabase-js");

const PORT = 8888;
const prisma = new PrismaClient();

// Supabase client for storage
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ROLE_KEY
);

// Multer setup for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("画像ファイルのみアップロード可能です"), false);
        }
    },
});

// CORS configuration
app.use(
    cors({
        origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
    })
);

app.use(express.json());

// JWT認証ミドルウェア
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "認証が必要です" });
    }

    jwt.verify(token, process.env.KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "トークンが無効です" });
        }
        req.user = user;
        next();
    });
};

// オプショナル認証ミドルウェア（ログインしていなくてもOK）
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
        jwt.verify(token, process.env.KEY, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
};

// ========== 認証API ==========

// 新規ユーザー登録API
app.post("/api/auth/register", async (req, res) => {
    const { username, libraryCardNumber, email, password } = req.body;

    try {
        const hashedPass = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                libraryCardNumber,
                email,
                password: hashedPass,
            },
        });

        return res.json({ user: { id: user.id, username: user.username, libraryCardNumber: user.libraryCardNumber } });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "ユーザー登録に失敗しました" });
    }
});

// ログインAPI
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(401).json({
            error: "そのユーザーは存在しません",
        });
    }

    const isPasswordCheck = await bcrypt.compare(password, user.password);

    if (!isPasswordCheck) {
        return res.status(401).json({
            error: "そのパスワードは間違っています",
        });
    }

    const token = jwt.sign({ id: user.id }, process.env.KEY, {
        expiresIn: "1d",
    });

    return res.json({ token });
});

// 現在のユーザー情報取得API
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                email: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: "ユーザーが見つかりません" });
        }

        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "サーバーエラーです" });
    }
});

// ========== 本（Book）API ==========

// 本の登録API（画像アップロード対応）
app.post("/api/books", upload.single("image"), async (req, res) => {
    const { title } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ message: "タイトルは必須です" });
    }

    try {
        // 1. まずDBにレコードを作成（imageUrlは一旦null）
        const newBook = await prisma.book.create({
            data: { title: title.trim(), imageUrl: null },
        });

        let imageUrl = null;

        // 画像がアップロードされた場合、Supabase Storageに保存
        if (req.file) {
            // sharpを使って圧縮処理
            // ここでは画質最適化のみを行う設定にすると、サーバー負荷が激減します
            const compressedBuffer = await sharp(req.file.buffer)
                .jpeg({ quality: 80 }) // 圧縮済みなので質は落としすぎない
                .toBuffer();

            //ファイル名の生成 (ID_YYYY-MM-DD.jpg)
            const datePart = newBook.createdAt.toISOString().split('T')[0];
            const fileName = `books/${newBook.id}_${datePart}.jpg`;

            //Supabaseにアップロード
            const { error } = await supabase.storage
                .from("book-images")
                .upload(fileName, compressedBuffer, {
                    contentType: "image/jpeg",
                    upsert: true,
                });
            
            if (error) {
                console.error("画像アップロードエラー:", error);
            } else {
                // 公開URLを取得
                const { data: publicData } = supabase.storage
                    .from("book-images")
                    .getPublicUrl(fileName);
                imageUrl = publicData.publicUrl;

                //画像URLをDBに保存
                await prisma.book.update({
                    where: { id: newBook.id },
                    data: { imageUrl },
                });
            }
        }

        // 最終的なオブジェクトを返却
        const finalBook = await prisma.book.findUnique({
            where: { id: newBook.id }
        });

        res.status(201).json(newBook);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "本の登録に失敗しました" });
    }
});

// 本のリスト取得API
app.get("/api/books", async (req, res) => {
    try {
        const books = await prisma.book.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(books);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "本のリスト取得に失敗しました" });
    }
});

// 最新レビュー取得API（異なる本の最新レビューを取得）
app.get("/api/books/latest-reviewed", async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;

    try {
        const latestReviews = await prisma.post.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            distinct: ["bookId"],
            select: {
                id: true,
                content: true,
                createdAt: true,
                author: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
                book: {
                    select: {
                        id: true,
                        title: true,
                        imageUrl: true,
                    },
                },
            },
        });

        res.json(latestReviews);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "最新レビューの取得に失敗しました" });
    }
});

// ========== 投稿（Post）API ==========

// 感想投稿API
app.post("/api/posts", authenticateToken, async (req, res) => {
    const { content, bookId } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ message: "投稿内容がありません" });
    }

    if (!bookId) {
        return res.status(400).json({ message: "本を選択してください" });
    }

    try {
        const newPost = await prisma.post.create({
            data: {
                content: content.trim(),
                authorId: req.user.id,
                bookId: parseInt(bookId),
            },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    },
                },
                book: true,
                likes: true,
                _count: {
                    select: { likes: true },
                },
            },
        });
        res.status(201).json(newPost);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "投稿に失敗しました" });
    }
});

// 特定の本の感想取得API
app.get("/api/get_post", optionalAuth, async (req, res) => {
    const { bookId } = req.query;

    try {
        const whereClause = bookId ? { bookId: parseInt(bookId) } : {};

        const postData = await prisma.post.findMany({
            where: whereClause,
            take: 50,
            orderBy: { createdAt: "desc" },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    },
                },
                book: true,
                likes: {
                    select: {
                        id: true,
                        userId: true,
                        postId: true,
                        createdAt: true,
                    },
                },
                _count: {
                    select: { likes: true },
                },
            },
        });
        res.status(200).json(postData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "サーバーエラーです" });
    }
});

// ========== いいね（Like）API ==========

// いいね追加API
app.post("/api/posts/:id/like", authenticateToken, async (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    try {
        // 既にいいねしているか確認
        const existingLike = await prisma.like.findUnique({
            where: {
                userId_postId: {
                    userId,
                    postId,
                },
            },
        });

        if (existingLike) {
            return res.status(400).json({ message: "既にいいねしています" });
        }

        const like = await prisma.like.create({
            data: {
                userId,
                postId,
            },
        });

        res.status(201).json(like);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "いいねに失敗しました" });
    }
});

// いいね削除API
app.delete("/api/posts/:id/like", authenticateToken, async (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    try {
        await prisma.like.delete({
            where: {
                userId_postId: {
                    userId,
                    postId,
                },
            },
        });

        res.status(200).json({ message: "いいねを取り消しました" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "いいねの取り消しに失敗しました" });
    }
});

// ========== 旧API（後方互換性のため残す） ==========

// 旧投稿API
app.post("/api/post", async (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ message: "投稿内容がありません" });
    }

    try {
        // bookIdがない場合はデフォルトの本を作成または取得
        let defaultBook = await prisma.book.findFirst({
            where: { title: "未分類" },
        });

        if (!defaultBook) {
            defaultBook = await prisma.book.create({
                data: { title: "未分類" },
            });
        }

        const newPost = await prisma.post.create({
            data: {
                content,
                authorId: 1,
                bookId: defaultBook.id,
            },
            include: {
                author: true,
                book: true,
            },
        });
        res.status(201).json(newPost);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "サーバーエラーです" });
    }
});

// 本番環境用エクスポート
module.exports = app;

// local環境ここでサーバーを起動します！！🤗
// app.listen(PORT, () => console.log("server start!!!"));
