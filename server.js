const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;

// 数据库文件位于本目录的 database 子目录
const dbPath = path.join(__dirname, 'database', 'comic.db');
const db = new Database(dbPath, { readonly: true });
db.pragma('journal_mode = WAL');

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'css')));
app.use(express.static(path.join(__dirname, 'js')));
app.use(express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, 'video')));
app.use(express.static(path.join(__dirname, 'database')));
app.use(express.static(path.join(__dirname)));

// 去掉标题中的 "a数字-" 前缀（如 "a1-绝对蝙蝠侠-英" → "绝对蝙蝠侠-英"）
function cleanTitle(title) {
    if (!title) return title;
    return title.replace(/^a\d+-/, '');
}

// 获取漫画列表
app.get('/api/comics', (req, res) => {
    try {
        const comics = db.prepare('SELECT id, title, cover, chapter_count FROM comics ORDER BY id').all();
        const data = comics.map(c => ({
            id: c.id,
            title: cleanTitle(c.title),
            cover: c.cover,
            chapterCount: c.chapter_count
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error('查询漫画列表失败:', error);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 获取漫画详情和章节列表
app.get('/api/comic/:id', (req, res) => {
    const comicId = req.params.id;
    try {
        const comic = db.prepare('SELECT id, title, cover, chapter_count FROM comics WHERE id = ?').get(comicId);
        if (!comic) {
            res.status(404).json({ error: '漫画不存在' });
            return;
        }

        const chapters = db.prepare('SELECT chapter_id, chapter_title FROM chapters WHERE comic_id = ? ORDER BY chapter_id').all(comicId);
        const chapterData = chapters.map(c => ({
            chapterId: c.chapter_id,
            chapterTitle: c.chapter_title
        }));

        res.json({
            success: true,
            data: {
                id: comic.id,
                title: cleanTitle(comic.title),
                cover: comic.cover,
                chapterCount: comic.chapter_count,
                chapters: chapterData
            }
        });
    } catch (error) {
        console.error('查询漫画详情失败:', error);
        res.status(500).json({ error: '读取数据失败' });
    }
});

// 获取章节内容（含图片URL列表和下载链接）
app.get('/api/chapter/:comicId/:chapterId', (req, res) => {
    const { comicId, chapterId } = req.params;
    try {
        const chapter = db.prepare('SELECT chapter_id, comic_id, chapter_title, page_urls, download_link FROM chapters WHERE comic_id = ? AND chapter_id = ?').get(comicId, chapterId);
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
    res.sendFile(path.join(__dirname, 'comic.html'));
});

app.get('/chapter.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'chapter.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
        console.log(`API 地址: http://localhost:${PORT}/api/comics`);
        console.log(`数据库: ${dbPath}`);
    });
}

module.exports = app;
