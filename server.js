const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const parseMarkdownTable = (content) => {
    const lines = content.split('\n');
    const comics = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('|') && line.endsWith('|')) {
            const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
            
            if (parts.length >= 4) {
                const comicId = parts[0];
                const title = parts[1];
                const cover = parts[2];
                const chapterCount = parts[3];
                
                if (comicId && 
                    comicId !== 'comic-id' && 
                    comicId !== '--------' &&
                    title && 
                    title !== 'comic-title' &&
                    title !== '-----------' &&
                    !comicId.startsWith('-') &&
                    comicId.trim() !== '') {
                    comics.push({
                        id: comicId,
                        title: title,
                        cover: cover,
                        chapterCount: chapterCount
                    });
                }
            }
        }
    }
    
    return comics;
};

const parseChapterTable = (content) => {
    const lines = content.split('\n');
    const chapters = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('|') && line.endsWith('|')) {
            const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
            
            if (parts.length >= 4) {
                const comicId = parts[0];
                const chapterId = parts[1];
                const chapterTitle = parts[2];
                const chapterUrl = parts[3];
                const pageCount = parts[4] || '';
                
                if (chapterId && 
                    chapterId !== 'chapter-id' && 
                    chapterId !== '--------' &&
                    chapterTitle && 
                    chapterTitle !== 'chapter-title' &&
                    chapterTitle !== '-----------' &&
                    !chapterId.startsWith('-') &&
                    chapterId.trim() !== '') {
                    chapters.push({
                        chapterId: chapterId,
                        chapterTitle: chapterTitle,
                        chapterUrl: chapterUrl,
                        pageCount: pageCount
                    });
                }
            }
        }
    }
    
    console.log('解析到的章节数量:', chapters.length);
    return chapters;
};

app.get('/api/comics', (req, res) => {
    const dataPath = path.join(__dirname, 'database', 'data-info.md');
    
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('读取数据文件失败:', err);
            res.status(500).json({ error: '读取数据失败' });
            return;
        }
        
        try {
            const comics = parseMarkdownTable(data);
            res.json({ success: true, data: comics });
        } catch (error) {
            console.error('解析数据失败:', error);
            res.status(500).json({ error: '解析数据失败' });
        }
    });
});

app.get('/api/comic/:id', (req, res) => {
    const comicId = req.params.id;
    const dataPath = path.join(__dirname, 'database', 'data-info.md');
    
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('读取数据文件失败:', err);
            res.status(500).json({ error: '读取数据失败' });
            return;
        }
        
        try {
            const comics = parseMarkdownTable(data);
            const comic = comics.find(c => c.id === comicId);
            
            if (!comic) {
                res.status(404).json({ error: '漫画不存在' });
                return;
            }
            
            const chapterPath = path.join(__dirname, 'database', `${comicId}.md`);
            
            fs.readFile(chapterPath, 'utf8', (err, chapterData) => {
                if (err) {
                    console.error('读取章节文件失败:', err);
                    res.json({ success: true, data: { ...comic, chapters: [] } });
                    return;
                }
                
                try {
                    const chapters = parseChapterTable(chapterData);
                    res.json({ success: true, data: { ...comic, chapters } });
                } catch (error) {
                    console.error('解析章节数据失败:', error);
                    res.json({ success: true, data: { ...comic, chapters: [] } });
                }
            });
        } catch (error) {
            console.error('解析数据失败:', error);
            res.status(500).json({ error: '解析数据失败' });
        }
    });
});

app.get('/api/chapter/:comicId/:chapterId', (req, res) => {
    const comicId = req.params.comicId;
    const chapterId = req.params.chapterId;
    const chapterPath = path.join(__dirname, 'database', `${comicId}.md`);
    
    fs.readFile(chapterPath, 'utf8', (err, chapterData) => {
        if (err) {
            console.error('读取章节文件失败:', err);
            res.status(404).json({ error: '章节不存在' });
            return;
        }
        
        try {
            const chapters = parseChapterTable(chapterData);
            const chapter = chapters.find(c => c.chapterId === chapterId);
            
            if (!chapter) {
                res.status(404).json({ error: '章节不存在' });
                return;
            }
            
            res.json({ success: true, data: chapter });
        } catch (error) {
            console.error('解析章节数据失败:', error);
            res.status(500).json({ error: '解析数据失败' });
        }
    });
});

app.get('/api/data-info', (req, res) => {
    const dataPath = path.join(__dirname, 'database', 'data-info.md');
    
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('读取 data-info.md 失败:', err);
            res.status(500).json({ error: '读取数据失败' });
            return;
        }
        
        res.type('text/plain').send(data);
    });
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 地址: http://localhost:${PORT}/api/comics`);
});
