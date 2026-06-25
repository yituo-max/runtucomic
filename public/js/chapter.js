document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const comicId = urlParams.get('comicId');
    const chapterId = urlParams.get('chapterId');
    const comicTitleElement = document.querySelector('.reader_header .comic_title h2');
    const pageContainer = document.getElementById('pageContainer');
    const backButton = document.querySelector('.reader_header .back_button a');
    const viewModeButton = document.getElementById('viewModeButton');
    const chapterSelect = document.getElementById('chapterSelect');
    const prevPageButton = document.querySelector('.reader_footer .prev_page a');
    const nextPageButton = document.querySelector('.reader_footer .next_page a');
    const prevChapterButton = document.querySelector('.reader_footer .prev_chapter a');
    const nextChapterButton = document.querySelector('.reader_footer .next_chapter a');
    const pageInfo = document.querySelector('.reader_footer .page_info span');
    
    let currentPage = 1;
    let totalPages = 0;
    let allPages = [];
    let currentChapter = null;
    let allChapters = [];
    let comicTitle = '';
    let viewMode = localStorage.getItem('viewMode') || 'single';
    let savedPage = localStorage.getItem(`currentPage_${comicId}_${chapterId}`);

    if (!comicId || !chapterId) {
        console.error('未找到漫画 ID 或章节 ID');
        return;
    }

    if (backButton) {
        backButton.href = `comic.html?id=${comicId}`;
    }

    if (viewModeButton) {
        viewModeButton.textContent = viewMode === 'single' ? '单页' : '双页';
    }

    if (chapterSelect) {
        chapterSelect.addEventListener('change', function(e) {
            const selectedChapterId = e.target.value;
            if (selectedChapterId) {
                window.location.href = `chapter.html?comicId=${comicId}&chapterId=${selectedChapterId}`;
            }
        });
    }

    if (viewModeSelect) {
        viewModeSelect.addEventListener('change', function(e) {
            const selectedMode = e.target.value;
            if (selectedMode) {
                changeViewMode(selectedMode);
            }
        });
    }

    if (pageContainer) {
        pageContainer.addEventListener('contextmenu', function(e) {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
            }
        });
    }

    function changeViewMode(newMode) {
        viewMode = newMode;
        pageContainer.classList.remove('single-page', 'double-page', 'all-page');
        pageContainer.classList.add(viewMode === 'single' ? 'single-page' : (viewMode === 'double' ? 'double-page' : 'all-page'));
        
        const readerContent = document.querySelector('.reader_content');
        if (readerContent) {
            if (viewMode === 'all') {
                readerContent.classList.add('all-page-mode');
            } else {
                readerContent.classList.remove('all-page-mode');
            }
        }
        
        localStorage.setItem('viewMode', viewMode);
        showPage(currentPage);
    }

    function checkImageAspectRatio() {
        const firstImage = document.querySelector('.reader_content .page img');
        if (!firstImage) return;
        
        const width = firstImage.naturalWidth;
        const height = firstImage.naturalHeight;
        
        if (width > height && viewMode === 'double') {
            changeViewMode('single');
        }
    }

    async function loadChapter() {
        try {
            const response = await fetch(`/api/chapter/${comicId}/${chapterId}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                currentChapter = result.data;
                renderChapter(result.data);
                updateDownloadInfo(result.data.downloadLink || '');
                scrollToChapterContent();
            } else {
                console.error('章节不存在');
            }
        } catch (error) {
            console.error('加载章节数据失败:', error);
        }
    }

    function updateDownloadInfo(downloadLink) {
        const downloadLinkInfo = document.querySelector('.download_link_info');
        if (!downloadLinkInfo) return;
        
        const textElement = downloadLinkInfo.querySelector('p.text');
        const imgElement = downloadLinkInfo.querySelector('img');
        
        if (textElement) {
            textElement.innerHTML = downloadLink || '暂无下载链接';
        }
        
        if (imgElement) {
            imgElement.style.display = 'none';
        }
    }

    function scrollToChapterContent() {
        const readerContent = document.querySelector('.reader_content');
        if (readerContent) {
            readerContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async function loadAllChapters() {
        try {
            const response = await fetch(`/api/comic/${comicId}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                comicTitle = result.data.title || '';
                if (result.data.chapters) {
                    allChapters = result.data.chapters;
                    updateChapterNavigation();
                    populateChapterSelector();
                }
            }
        } catch (error) {
            console.error('加载所有章节失败:', error);
        }
    }

    function populateChapterSelector() {
        if (!chapterSelect || !allChapters || allChapters.length === 0) return;
        
        chapterSelect.innerHTML = '<option value="">选择章节</option>';
        
        allChapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.chapterId;
            option.textContent = chapter.chapterTitle || '章节';
            
            if (chapter.chapterId === chapterId) {
                option.selected = true;
            }
            
            chapterSelect.appendChild(option);
        });
    }

    function renderChapter(chapter) {
        if (comicTitleElement) {
            const displayTitle = comicTitle ? `${comicTitle} ${chapter.chapterTitle || '章节'}` : (chapter.chapterTitle || '章节');
            comicTitleElement.textContent = displayTitle;
        }

        if (pageContainer) {
            pageContainer.innerHTML = '';
            pageContainer.classList.remove('single-page', 'double-page', 'all-page');
            pageContainer.classList.add(viewMode === 'single' ? 'single-page' : (viewMode === 'double' ? 'double-page' : 'all-page'));
            
            const readerContent = document.querySelector('.reader_content');
            if (readerContent) {
                if (viewMode === 'all') {
                    readerContent.classList.add('all-page-mode');
                } else {
                    readerContent.classList.remove('all-page-mode');
                }
            }
            
            if (chapter.pageUrls && chapter.pageUrls.length > 0) {
                allPages = chapter.pageUrls.filter(url => url && url.trim() !== '');
                totalPages = allPages.length;
                
                allPages.forEach((imageUrl, index) => {
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'page';
                    pageDiv.setAttribute('data-page', index + 1);
                    
                    const img = document.createElement('img');
                    img.loading = 'lazy';
                    img.src = imageUrl.trim();
                    img.alt = `第${index + 1}页`;
                    img.style.width = '100%';
                    img.style.height = 'auto';
                    img.style.borderRadius = '10px';
                    img.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
                    
                    if (index === 0) {
                        img.onload = function() {
                            checkImageAspectRatio();
                        };
                    }
                    
                    pageDiv.appendChild(img);
                    pageContainer.appendChild(pageDiv);
                });
            } else {
                allPages = [];
                totalPages = 0;
                
                const emptyDiv = document.createElement('div');
                emptyDiv.style.textAlign = 'center';
                emptyDiv.style.padding = '100px 0';
                emptyDiv.style.color = '#888';
                emptyDiv.textContent = '该章节暂无内容';
                
                pageContainer.appendChild(emptyDiv);
            }
            
            if (pageInfo) {
                pageInfo.textContent = `${currentPage} / ${totalPages}`;
            }
            
            if (savedPage && savedPage > 0 && savedPage <= totalPages) {
                currentPage = parseInt(savedPage);
            } else {
                currentPage = 1;
            }
            showPage(currentPage);
        }
    }

    function updateChapterNavigation() {
        if (!allChapters || allChapters.length === 0) return;
        
        const currentIndex = allChapters.findIndex(c => c.chapterId === chapterId);
        
        if (currentIndex > 0) {
            const prevChapter = allChapters[currentIndex - 1];
            prevChapterButton.href = `chapter.html?comicId=${comicId}&chapterId=${prevChapter.chapterId}`;
        } else {
            prevChapterButton.href = '#';
        }
        
        if (currentIndex < allChapters.length - 1) {
            const nextChapter = allChapters[currentIndex + 1];
            nextChapterButton.href = `chapter.html?comicId=${comicId}&chapterId=${nextChapter.chapterId}`;
        } else {
            nextChapterButton.href = '#';
        }
    }

    function showPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > totalPages) return;
        
        const pages = document.querySelectorAll('.reader_content .page');
        
        if (viewMode === 'all') {
            pages.forEach((page, index) => {
                page.classList.add('active');
            });
            currentPage = pageNumber;
        } else if (viewMode === 'double') {
            pages.forEach((page, index) => {
                page.classList.remove('active');
            });
            const showTwoPages = Math.min(pageNumber + 1, totalPages);
            for (let i = pageNumber - 1; i < showTwoPages; i++) {
                if (pages[i]) {
                    pages[i].classList.add('active');
                }
            }
            currentPage = pageNumber;
        } else {
            pages.forEach((page, index) => {
                page.classList.remove('active');
            });
            pages[pageNumber - 1].classList.add('active');
            currentPage = pageNumber;
        }
        
        if (pageInfo) {
            pageInfo.textContent = `${currentPage} / ${totalPages}`;
        }
        
        localStorage.setItem(`currentPage_${comicId}_${chapterId}`, currentPage);
    }

    prevPageButton.addEventListener('click', function(e) {
        e.preventDefault();
        const step = viewMode === 'double' ? 2 : 1;
        showPage(currentPage - step);
    });

    nextPageButton.addEventListener('click', function(e) {
        e.preventDefault();
        const step = viewMode === 'double' ? 2 : 1;
        showPage(currentPage + step);
    });

    document.addEventListener('keydown', function(e) {
        const step = viewMode === 'double' ? 2 : 1;
        if (e.key === 'ArrowLeft') {
            showPage(currentPage - step);
        } else if (e.key === 'ArrowRight') {
            showPage(currentPage + step);
        }
    });

    const downloadBtn = document.getElementById('downloadBtn');
    const downloadLinkInfo = document.querySelector('.download_link_info');

    if (downloadBtn && downloadLinkInfo) {
        downloadBtn.addEventListener('click', function() {
            downloadLinkInfo.classList.toggle('show');
        });
    }

    loadAllChapters().then(() => {
        loadChapter();
    });
});
