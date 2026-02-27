document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const comicId = urlParams.get('id');

    if (!comicId) {
        console.error('未找到漫画 ID');
        return;
    }

    async function loadComic() {
        try {
            const response = await fetch(`/api/comic/${comicId}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                renderComic(result.data);
            }
        } catch (error) {
            console.error('加载漫画数据失败:', error);
        }
    }

    async function loadHotRecommend() {
        try {
            const response = await fetch('/api/comics');
            const result = await response.json();
            
            if (result.success && result.data) {
                renderHotRecommend(result.data);
            }
        } catch (error) {
            console.error('加载热门推荐失败:', error);
        }
    }

    function renderComic(comic) {
        const titleElement = document.querySelector('.comic_library .container4 .text .comic-title');
        const coverElement = document.querySelector('.comic_library .container4 .comic_info .comic_cover ul li img');
        const coverInfoElement = document.querySelector('.comic_library .container4 .comic_info .comic_cover ul li .comic_info');
        const coverTitleElement = document.querySelector('.comic_library .container4 .comic_info .comic_cover ul li .comic_info .comic-title');
        const coverDescElement = document.querySelector('.comic_library .container4 .comic_info .comic_cover ul li .comic_info p');
        const chapterListElement = document.querySelector('.comic_library .container4 .comic_info .chapter .chapter_text ul');

        if (titleElement) {
            titleElement.textContent = comic.title || '漫画名称';
        }

        if (coverElement) {
            coverElement.src = comic.cover || 'img/01.jpg';
            coverElement.alt = comic.title;
        }

        if (coverInfoElement) {
            coverInfoElement.style.display = 'flex';
        }

        if (coverTitleElement) {
            coverTitleElement.textContent = comic.title || '漫画名称';
        }

        if (coverDescElement) {
            coverDescElement.textContent = `共 ${comic.chapterCount || 0} 章`;
        }

        if (chapterListElement && comic.chapters) {
            chapterListElement.innerHTML = '';
            
            comic.chapters.forEach(chapter => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `chapter.html?comicId=${comic.id}&chapterId=${chapter.chapterId}`;
                a.textContent = chapter.chapterTitle || '章节';
                li.appendChild(a);
                chapterListElement.appendChild(li);
            });
        }

        const comicLibrarySection = document.querySelector('.comic_library');
        if (comicLibrarySection) {
            comicLibrarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function renderHotRecommend(comics) {
        const hotRecommendList = document.querySelector('.hot_recommend .comic_cover2 ul');
        
        if (!hotRecommendList || !comics || comics.length === 0) return;

        hotRecommendList.innerHTML = '';
        const hotRecommendCount = 10;

        comics.slice(0, hotRecommendCount).forEach(comic => {
            const li = document.createElement('li');
            
            const img = document.createElement('img');
            img.src = comic.cover || 'img/01.jpg';
            img.alt = comic.title;
            
            const info = document.createElement('div');
            info.className = 'comic_info';
            
            const title = document.createElement('h3');
            title.textContent = comic.title || '漫画名称';
            
            const desc = document.createElement('p');
            desc.textContent = `共 ${comic.chapterCount || 0} 章`;
            
            info.appendChild(title);
            info.appendChild(desc);
            li.appendChild(img);
            li.appendChild(info);
            
            li.addEventListener('click', function() {
                window.location.href = `comic.html?id=${comic.id}`;
            });
            
            hotRecommendList.appendChild(li);
        });
    }

    loadComic();
    loadHotRecommend();
});
