// ===== 포트폴리오 공용 로더 =====
// projects/manifest.json 을 읽어 카드 목록을 렌더링한다.
// - index.html: #portfolioStrip (가로 스크롤 티저, 5초 정지 -> 스크롤 반복)
// - portfolio.html: #portfolioGrid (전체 그리드)
//
// 프로젝트 추가 방법: docs/projects/manifest.json 에 항목 하나 추가하면 끝.

(function () {
    // manifest.json의 프로젝트 한 건을 카드 DOM으로 변환한다.
    function buildCard(p) {
        const card = document.createElement('a');
        card.className = 'proj-card';
        card.href = p.link;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        const thumb = document.createElement('div');
        thumb.className = 'proj-thumb';
        thumb.style.background = p.thumbGradient || 'linear-gradient(135deg, #00ff41, #16213e)';

        if (p.media && p.media.type === 'video' && p.media.src) {
            const video = document.createElement('video');
            video.src = p.media.src;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.autoplay = true;
            video.preload = 'metadata';
            thumb.appendChild(video);

            const badge = document.createElement('span');
            badge.className = 'proj-video-badge';
            badge.textContent = '▶ VIDEO';
            thumb.appendChild(badge);
        } else if (p.thumbImage) {
            const img = document.createElement('img');
            img.className = 'proj-img';
            img.src = p.thumbImage;
            img.alt = p.title;
            thumb.appendChild(img);
        } else {
            const emoji = document.createElement('span');
            emoji.className = 'proj-emoji';
            emoji.textContent = p.thumbEmoji || '📁';
            thumb.appendChild(emoji);
        }

        const body = document.createElement('div');
        body.className = 'proj-body';

        const title = document.createElement('div');
        title.className = 'proj-title';
        title.textContent = p.title;

        const desc = document.createElement('div');
        desc.className = 'proj-desc';
        desc.textContent = p.description;

        const tags = document.createElement('div');
        tags.className = 'proj-tags';
        (p.tags || []).forEach(t => {
            const tag = document.createElement('span');
            tag.className = 'proj-tag';
            tag.textContent = t;
            tags.appendChild(tag);
        });

        body.appendChild(title);
        body.appendChild(desc);
        body.appendChild(tags);

        card.appendChild(thumb);
        card.appendChild(body);
        return card;
    }

    // ease-in-out-cubic: 처음엔 천천히 가속, 끝날 땐 천천히 감속하는 '쓱' 느낌
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function smoothScrollTo(container, targetLeft, duration, isCancelled, onDone) {
        const startLeft = container.scrollLeft;
        const distance = targetLeft - startLeft;
        const startTime = performance.now();

        function step(now) {
            if (isCancelled()) return;
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            container.scrollLeft = startLeft + distance * easeInOutCubic(t);
            if (t < 1) {
                requestAnimationFrame(step);
            } else if (onDone) {
                onDone();
            }
        }
        requestAnimationFrame(step);
    }

    // 카드 세트를 한 번 더 복제해 뒤에 이어붙이고, 첫 세트를 다 지나가면
    // 화면 밖에서 scrollLeft를 조용히 되감아 끊김 없이 무한 회전하는 것처럼 보이게 한다.
    function setupInfiniteAutoScroll(container, cycleWidth) {
        let paused = false;
        const SCROLL_DURATION = 1400; // ms, 느긋하게 '쓱' 넘어가는 속도

        function wrapIfNeeded() {
            if (container.scrollLeft >= cycleWidth) {
                container.scrollLeft -= cycleWidth;
            }
        }

        function tick() {
            if (paused) return;
            const card = container.querySelector('.proj-card');
            const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
            const step = card ? card.getBoundingClientRect().width + gap : container.clientWidth * 0.8;
            const target = container.scrollLeft + step;
            smoothScrollTo(container, target, SCROLL_DURATION, () => paused, wrapIfNeeded);
        }

        const timer = setInterval(tick, 5000);

        container.addEventListener('mousedown', () => { paused = true; });
        container.addEventListener('mouseup', () => { paused = false; });
        container.addEventListener('mouseleave', () => { paused = false; });
        container.addEventListener('touchstart', () => { paused = true; }, { passive: true });
        container.addEventListener('touchend', () => { paused = false; });

        return () => clearInterval(timer);
    }

    async function loadProjects() {
        const res = await fetch('projects/manifest.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('manifest load failed: ' + res.status);
        return res.json();
    }

    // index.html은 #portfolioStrip, portfolio.html은 #portfolioGrid를 사용한다.
    async function initPortfolio() {
        const strip = document.getElementById('portfolioStrip');
        const grid = document.getElementById('portfolioGrid');
        if (!strip && !grid) return;

        try {
            const projects = await loadProjects();

            if (strip) {
                projects.forEach(p => strip.appendChild(buildCard(p)));
                // 폭을 측정한 뒤 같은 세트를 한 번 더 이어붙여 무한 루프처럼 보이게 한다.
                const singleSetWidth = strip.scrollWidth;
                projects.forEach(p => strip.appendChild(buildCard(p)));
                const gap = parseFloat(getComputedStyle(strip).columnGap) || 0;
                setupInfiniteAutoScroll(strip, singleSetWidth + gap);
            }
            if (grid) {
                projects.forEach(p => grid.appendChild(buildCard(p)));
            }
        } catch (err) {
            console.error(err);
            const target = strip || grid;
            if (target) target.textContent = '프로젝트 목록을 불러오지 못했습니다.';
        }
    }

    document.addEventListener('DOMContentLoaded', initPortfolio);
})();
