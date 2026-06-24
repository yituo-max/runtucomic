document.addEventListener('DOMContentLoaded', function() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const comicLibraryList = document.querySelector('.comic_library .comic_cover ul');
    const hotRecommendList = document.querySelector('.hot_recommend .comic_cover2 ul');
    const searchInput = document.querySelector('.search input');
    const searchButton = document.querySelector('.search button');

    let allComics = [];

    async function loadComics() {
        try {
            const response = await fetch('/api/comics');
            const result = await response.json();
            
            if (result.success && result.data) {
                allComics = result.data;
                renderComicLibrary(allComics);
                renderHotRecommend(allComics);
            }
        } catch (error) {
            console.error('加载漫画数据失败:', error);
        }
    }

    async function searchComics(keyword) {
        try {
            const response = await fetch(`/api/comics?search=${encodeURIComponent(keyword)}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                allComics = result.data;
                renderComics(allComics);
            }
        } catch (error) {
            console.error('搜索漫画数据失败:', error);
        }
    }

    function filterComics(keyword) {
        if (!keyword || keyword.trim() === '') {
            renderComicLibrary(allComics);
            return;
        }

        const filteredComics = allComics.filter(comic => {
            const title = comic.title || '';
            const desc = comic.description || '';
            return title.toLowerCase().includes(keyword.toLowerCase()) || 
                   desc.toLowerCase().includes(keyword.toLowerCase());
        });

        renderComicLibrary(filteredComics);
    }

    function handleSearch() {
        const keyword = searchInput.value.trim();
        if (keyword) {
            filterComics(keyword);
        } else {
            renderComicLibrary(allComics);
        }
        
        const comicLibrarySection = document.querySelector('.comic_library');
        if (comicLibrarySection) {
            comicLibrarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                handleSearch();
            }
        });
    }

    function renderComicLibrary(comics) {
        if (!comics || comics.length === 0) return;

        comicLibraryList.innerHTML = '';

        const displayCount = 12;

        comics.forEach((comic, index) => {
            const comicItem = createComicItem(comic);
            
            if (index < displayCount) {
                comicLibraryList.appendChild(comicItem);
            } else {
                comicItem.classList.add('hidden');
                comicLibraryList.appendChild(comicItem);
            }
        });

        if (comics.length <= displayCount) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    }

    function renderHotRecommend(comics) {
        if (!comics || comics.length === 0) return;

        hotRecommendList.innerHTML = '';

        const hotRecommendCount = 10;

        comics.forEach((comic, index) => {
            if (index < hotRecommendCount) {
                const hotItem = createComicItem(comic);
                hotRecommendList.appendChild(hotItem);
            }
        });
    }

    function renderComics(comics) {
        renderComicLibrary(comics);
        renderHotRecommend(comics);
    }

    function createComicItem(comic) {
        const li = document.createElement('li');
        li.className = 'comic-item';
        
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
        
        return li;
    }

    loadMoreBtn.addEventListener('click', function() {
        const hiddenItems = document.querySelectorAll('.comic-item.hidden');
        
        if (hiddenItems.length > 0) {
            hiddenItems.forEach(function(item) {
                item.classList.remove('hidden');
            });
            loadMoreBtn.style.display = 'none';
        }
    });

    loadComics();
});