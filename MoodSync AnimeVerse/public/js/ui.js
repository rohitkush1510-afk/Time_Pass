window.UI = {
    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    debounce(fn, delay = 300) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    sanitize(str) {
        if (!str) return '';
        const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' };
        const reg = /[<&"']/ig;
        return (str + '').replace(reg, (match) => (map[match]));
    },

    formatScore(score) {
        return score ? `⭐ ${parseFloat(score).toFixed(2)}` : 'N/A';
    },

    formatEpisodes(episodes) {
        return episodes ? `${episodes} eps` : '? eps';
    },

    createAnimeCard(anime) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.id = anime.id;
        card.onclick = () => window.navigateTo(`#/anime/${anime.id}`);
        
        const title = anime.title_english || anime.title;
        // Grid cards are small — prefer the medium cover over the huge one
        const imageUrl = anime.images?.jpg?.image_url || anime.images?.jpg?.large_image_url || '';
        const genres = anime.genres ? anime.genres.map(g => g.name).slice(0, 2).join(', ') : '';

        card.innerHTML = `
            <div class="anime-card-img" style="background-image: url('${this.sanitize(imageUrl)}')">
                <span class="anime-score">${this.formatScore(anime.score)}</span>
            </div>
            <div class="anime-card-body">
                <h4 title="${this.sanitize(title)}">${this.sanitize(title)}</h4>
                <div class="anime-meta">
                    <span>${this.sanitize(anime.type || 'TV')}</span> • <span>${this.formatEpisodes(anime.episodes)}</span>
                </div>
                <div class="anime-genres">${this.sanitize(genres)}</div>
            </div>
        `;
        return card;
    },

    createSkeletonCards(count) {
        return Array.from({ length: count }).map(() => {
            const card = document.createElement('div');
            card.className = 'anime-card skeleton';
            card.innerHTML = `
                <div class="skeleton-img"></div>
                <div class="skeleton-body">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            `;
            return card;
        });
    },

    getPageList(current, total, maxVisible = 5) {
        if (total <= maxVisible) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages = [];
        const half = Math.floor(maxVisible / 2);
        let start = Math.max(1, current - half);
        let end = Math.min(total, start + maxVisible - 1);
        if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

        if (start > 1) pages.push(1, '...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < total) pages.push('...', total);
        return pages;
    },

    createPagination({ currentPage, totalPages, onPageChange, maxVisible = 5 }) {
        const nav = document.createElement('nav');
        nav.className = 'pagination';
        nav.setAttribute('aria-label', 'Pagination');

        if (!totalPages || totalPages <= 1) return nav;

        const makeBtn = (label, page, { active = false, disabled = false, title = '' } = {}) => {
            const btn = document.createElement('button');
            btn.className = `page-btn${active ? ' active' : ''}`;
            btn.innerHTML = label;
            if (title) btn.title = title;
            if (disabled) {
                btn.disabled = true;
            } else {
                btn.onclick = () => onPageChange(page);
            }
            return btn;
        };

        nav.appendChild(makeBtn('&laquo;', currentPage - 1, { disabled: currentPage <= 1, title: 'Previous page' }));

        this.getPageList(currentPage, totalPages, maxVisible).forEach(p => {
            if (p === '...') {
                const span = document.createElement('span');
                span.className = 'page-ellipsis';
                span.innerText = '…';
                nav.appendChild(span);
            } else {
                nav.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
            }
        });

        nav.appendChild(makeBtn('&raquo;', currentPage + 1, { disabled: currentPage >= totalPages, title: 'Next page' }));
        return nav;
    },

    timeAgo(date) {
        if (!date) return '';
        const parsed = date instanceof Date ? date : new Date(date);
        const seconds = Math.floor((new Date() - parsed) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }
};
