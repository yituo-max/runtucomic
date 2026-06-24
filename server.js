const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;

// 数据库文件路径
const dbPath = path.join(__dirname, 'database', 'comic.db');

// 加载数据库（sql.js 是异步初始化）
let db = null;
let dbReady = initSqlJs().then(SQL => {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('数据库加载成功');
    return db;
}).catch(err => {
    console.error('数据库加载失败:', err.message);
    return null;
});

app.use(cors());
app.use(express.json());

// 静态文件从 public/ 目录提供（Vercel 也使用 public/）
app.use(express.static(path.join(__dirname, 'public')));

// 去掉标题中的 "a数字-" 前缀（如 "a1-绝对蝙蝠侠-英" → "绝对蝙蝠侠-英"）
function cleanTitle(title) {
    if (!title) return title;
    return title.replace(/^a\d+-/, '');
}

// 等待数据库就绪的中间件
async function waitForDb(req, res, next) {
    if (!db) {
        await dbReady;
    }
    if (!db) {
        res.status(500).json({ error: '数据库不可用' });
        return;
    }
    next();
}

// 执行参数化查询，返回对象数组
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// 执行参数化查询，返回第一条记录
function queryOne(sql, params = []) {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// 获取漫画列表
app.get('/api/comics', waitForDb, (req, res) => {
    try {
        const rows = queryAll('SELECT id, title, cover, chapter_count FROM comics ORDER BY id');
        const data = rows.map(row => ({
            id: row.id,
            title: cleanTitle(row.title),
            cover: row.cover,
            chapterCount: row.chapter_count
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error('查询漫画列表失败:', error);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 获取漫画详情和章节列表
app.get('/api/comic/:id', waitForDb, (req, res) => {
    const comicId = req.params.id;
    try {
        const comic = queryOne('SELECT id, title, cover, chapter_count FROM comics WHERE id = ?', [comicId]);
        if (!comic) {
            res.status(404).json({ error: '漫画不存在' });
            return;
        }

        const chapterRows = queryAll('SELECT chapter_id, chapter_title FROM chapters WHERE comic_id = ? ORDER BY chapter_id', [comicId]);
        const chapters = chapterRows.map(r => ({ chapterId: r.chapter_id, chapterTitle: r.chapter_title }));

        res.json({
            success: true,
            data: {
                id: comic.id,
                title: cleanTitle(comic.title),
                cover: comic.cover,
                chapterCount: comic.chapter_count,
                chapters: chapters
            }
        });
    } catch (error) {
        console.error('查询漫画详情失败:', error);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 获取章节内容（含图片URL列表和下载链接）
app.get('/api/chapter/:comicId/:chapterId', waitForDb, (req, res) => {
    const { comicId, chapterId } = req.params;
    try {
        const chapter = queryOne('SELECT chapter_id, comic_id, chapter_title, page_urls, download_link FROM chapters WHERE comic_id = ? AND chapter_id = ?', [comicId, chapterId]);
        if (!chapter) {
            res.status(404).json({ error: '章节不存在' });
            return;
        }

        let pageUrls = [];
        try {
            pageUrls = JSON.parse(chapter.page_urls || '[]');
        } catch (e) {
            pageUrls = [];
        }

        res.json({
            success: true,
            data: {
                chapterId: chapter.chapter_id,
                comicId: chapter.comic_id,
                chapterTitle: chapter.chapter_title,
                pageUrls: pageUrls,
                downloadLink: chapter.download_link || ''
            }
        });
    } catch (error) {
        console.error('查询章节内容失败:', error);
        res.status(500).json({ error: '读取数据失败' });
    }
});

app.get('/comic.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'comic.html'));
});

app.get('/chapter.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chapter.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
        console.log(`API 地址: http://localhost:${PORT}/api/comics`);
        console.log(`数据库: ${dbPath}`);
    });
}

module.exports = app;
