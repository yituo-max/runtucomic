const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 漫画数据目录
const comicDataDir = path.join(__dirname, 'comic-data');

app.use(cors());
app.use(express.json());

// 静态文件从 public/ 目录提供
app.use(express.static(path.join(__dirname, 'public')));

// 去掉标题中的 "a数字-" 前缀（如 "a1-绝对蝙蝠侠-英" → "绝对蝙蝠侠-英"）
function cleanTitle(title) {
    if (!title) return title;
    return title.replace(/^a\d+-/, '');
}

// 解析单个 .md 文件，返回 front matter 和图片 URL 列表
function parseMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = { frontMatter: {}, pageUrls: [] };

    // 提取 YAML front matter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const lines = fmMatch[1].split('\n');
        for (const line of lines) {
            const idx = line.indexOf(':');
            if (idx === -1) continue;
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            result.frontMatter[key] = value;
        }
    }

    // 提取图片 URL（front matter 之后，以 https 开头的行）
    const afterFm = content.slice(fmMatch ? fmMatch[0].length : 0);
    const urlLines = afterFm.split('\n');
    for (const line of urlLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('http')) {
            result.pageUrls.push(trimmed);
        }
    }

    return result;
}

// 从文件夹名提取漫画 ID 和标题
function parseFolderName(folderName) {
    const match = folderName.match(/^(a\d+)-(.+)$/);
    if (match) {
        return { id: match[1], title: folderName };
    }
    return { id: folderName, title: folderName };
}

// 自然排序比较（a1-b2 排在 a1-b10 前面）
function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// 获取所有漫画文件夹
function getComicFolders() {
    return fs.readdirSync(comicDataDir)
        .filter(name => fs.statSync(path.join(comicDataDir, name)).isDirectory())
        .sort(naturalCompare);
}

// 获取漫画文件夹下所有章节文件
function getChapterFiles(comicId, folderName) {
    const dir = path.join(comicDataDir, folderName);
    return fs.readdirSync(dir)
        .filter(name => name.endsWith('.md'))
        .sort(naturalCompare);
}

// 从文件名提取章节 ID（a1-b1.md → a1-b1）
function getChapterId(fileName) {
    return fileName.replace(/\.md$/, '');
}

// 获取漫画列表
app.get('/api/comics', (req, res) => {
    try {
        const folders = getComicFolders();
        const data = folders.map(folder => {
            const { id, title } = parseFolderName(folder);
            const chapterFiles = getChapterFiles(id, folder);
            // 取第一章的封面作为漫画封面
            let cover = '';
            if (chapterFiles.length > 0) {
                const parsed = parseMarkdown(path.join(comicDataDir, folder, chapterFiles[0]));
                cover = parsed.frontMatter['cover-url'] || '';
            }
            return {
                id,
                title: cleanTitle(title),
                cover,
                chapterCount: chapterFiles.length
            };
        });
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
        const folders = getComicFolders();
        const folder = folders.find(f => f.startsWith(comicId + '-'));
        if (!folder) {
            res.status(404).json({ error: '漫画不存在' });
            return;
        }

        const { id, title } = parseFolderName(folder);
        const chapterFiles = getChapterFiles(id, folder);

        // 取第一章的封面
        let cover = '';
        if (chapterFiles.length > 0) {
            const parsed = parseMarkdown(path.join(comicDataDir, folder, chapterFiles[0]));
            cover = parsed.frontMatter['cover-url'] || '';
        }

        const chapters = chapterFiles.map(file => {
            const chapterId = getChapterId(file);
            const parsed = parseMarkdown(path.join(comicDataDir, folder, file));
            return {
                chapterId,
                chapterTitle: parsed.frontMatter['chapter-title'] || chapterId
            };
        });

        res.json({
            success: true,
            data: {
                id,
                title: cleanTitle(title),
                cover,
                chapterCount: chapterFiles.length,
                chapters
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
        const folders = getComicFolders();
        const folder = folders.find(f => f.startsWith(comicId + '-'));
        if (!folder) {
            res.status(404).json({ error: '漫画不存在' });
            return;
        }

        const filePath = path.join(comicDataDir, folder, `${chapterId}.md`);
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: '章节不存在' });
            return;
        }

        const parsed = parseMarkdown(filePath);
        const fm = parsed.frontMatter;

        res.json({
            success: true,
            data: {
                chapterId: fm['chapter-id'] || chapterId,
                comicId: fm['comic-id'] || comicId,
                chapterTitle: fm['chapter-title'] || '',
                pageUrls: parsed.pageUrls,
                downloadLink: fm['download-link'] || ''
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
        console.log(`数据目录: ${comicDataDir}`);
    });
}

module.exports = app;
