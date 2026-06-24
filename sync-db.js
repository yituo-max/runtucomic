/**
 * 漫画数据迁移脚本
 * 读取 comic-data/ 下的 .md 文件，写入 SQLite 数据库
 * 每次在 Obsidian 修改 Markdown 后重新运行即可同步
 *
 * 用法: node sync-db.js
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const baseDir = __dirname;
const comicDataDir = path.join(baseDir, 'comic-data');
const dbPath = path.join(baseDir, 'database', 'comic.db');

// 解析单个 .md 文件
function parseMarkdown(content) {
    const result = {};

    // 提取 YAML front matter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const fm = fmMatch[1];
        const lines = fm.split('\n');
        for (const line of lines) {
            const idx = line.indexOf(':');
            if (idx === -1) continue;
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            result[key] = value;
        }
    }

    // 提取 chapter-url 列表（front matter 之后的 URL）
    const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n\nchapter-url[：:]\n([\s\S]*?)$/);
    if (bodyMatch) {
        const urls = bodyMatch[1]
            .split('\n')
            .map(u => u.trim())
            .filter(u => u);
        result['page-urls'] = JSON.stringify(urls);
    } else {
        result['page-urls'] = '[]';
    }

    return result;
}

// 初始化数据库
const db = new Database(dbPath);

// 开启 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 建表
db.exec(`
    CREATE TABLE IF NOT EXISTS comics (
        id          TEXT PRIMARY KEY,
        title       TEXT,
        cover       TEXT,
        chapter_count INTEGER,
        updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS chapters (
        chapter_id    TEXT PRIMARY KEY,
        comic_id      TEXT,
        chapter_title TEXT,
        page_urls     TEXT,
        download_link TEXT,
        updated_at    TEXT,
        FOREIGN KEY (comic_id) REFERENCES comics(id)
    );

    CREATE INDEX IF NOT EXISTS idx_chapters_comic_id ON chapters(comic_id);
`);

// 预处理语句
const upsertComic = db.prepare(`
    INSERT INTO comics (id, title, cover, chapter_count, updated_at)
    VALUES (@id, @title, @cover, @chapterCount, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
        title = @title,
        cover = @cover,
        chapter_count = @chapterCount,
        updated_at = @updatedAt
`);

const upsertChapter = db.prepare(`
    INSERT INTO chapters (chapter_id, comic_id, chapter_title, page_urls, download_link, updated_at)
    VALUES (@chapterId, @comicId, @chapterTitle, @pageUrls, @downloadLink, @updatedAt)
    ON CONFLICT(chapter_id) DO UPDATE SET
        comic_id = @comicId,
        chapter_title = @chapterTitle,
        page_urls = @pageUrls,
        download_link = @downloadLink,
        updated_at = @updatedAt
`);

// 获取所有漫画文件夹
const folders = fs.readdirSync(comicDataDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^a\d+-/.test(e.name))
    .map(e => e.name)
    .sort((a, b) => {
        const numA = parseInt(a.match(/^a(\d+)/)[1]);
        const numB = parseInt(b.match(/^a(\d+)/)[1]);
        return numA - numB;
    });

console.log(`找到 ${folders.length} 个漫画文件夹`);

// 用事务批量写入
const syncAll = db.transaction(() => {
    let totalChapters = 0;

    for (const folder of folders) {
        const folderPath = path.join(comicDataDir, folder);
        const files = fs.readdirSync(folderPath)
            .filter(f => f.endsWith('.md'))
            .sort();

        if (files.length === 0) {
            console.log(`[跳过] ${folder}: 无章节文件`);
            continue;
        }

        const comicId = folder.split('-')[0];
        let comicTitle = folder;
        let comicCover = '';
        const now = new Date().toISOString();

        // 先读取所有章节，收集封面
        const chaptersData = [];
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const data = parseMarkdown(content);

            if (!comicCover && data['cover-url']) {
                comicCover = data['cover-url'];
            }

            chaptersData.push(data);
        }

        // 先写漫画（父表）
        upsertComic.run({
            id: comicId,
            title: comicTitle,
            cover: comicCover,
            chapterCount: files.length,
            updatedAt: now
        });

        // 再写章节（子表）
        for (const data of chaptersData) {
            upsertChapter.run({
                chapterId: data['chapter-id'] || '',
                comicId: data['comic-id'] || comicId,
                chapterTitle: data['chapter-title'] || '',
                pageUrls: data['page-urls'] || '[]',
                downloadLink: data['download-link'] || '',
                updatedAt: now
            });

            totalChapters++;
        }

        console.log(`[完成] ${comicId} (${folder}): ${files.length} 章`);
    }

    return totalChapters;
});

const total = syncAll();
console.log(`\n========== 同步完成 ==========`);
console.log(`漫画总数: ${folders.length}`);
console.log(`章节总数: ${total}`);
console.log(`数据库位置: ${dbPath}`);

// 复制一份到 api/ 目录供 Vercel 部署使用
const apiDbPath = path.join(baseDir, 'api', 'comic.db');
fs.copyFileSync(dbPath, apiDbPath);
console.log(`已复制到: ${apiDbPath}`);

// 验证数据
const comicCount = db.prepare('SELECT COUNT(*) as count FROM comics').get().count;
const chapterCount = db.prepare('SELECT COUNT(*) as count FROM chapters').get().count;
console.log(`\n数据库验证: 漫画 ${comicCount} 条, 章节 ${chapterCount} 条`);

db.close();
