// ===== 공통 리소스: 커서, 배경 매트릭스, 네비게이션, 디버그 =====
// index.html / AIc0z0c.html / career.html / portfolio.html 공용

(function () {
    // ===== 디버그 모드 토글 =====
    let debugMode = false;
    const debugToggleBtn = document.querySelector('.debug-toggle');
    const debugVertical = document.getElementById('debugVertical');
    const debugHorizontal = document.getElementById('debugHorizontal');

    window.toggleDebug = function () {
        debugMode = !debugMode;
        document.body.classList.toggle('debug-mode', debugMode);
        if (debugToggleBtn) debugToggleBtn.textContent = debugMode ? 'DEBUG ON' : 'DEBUG OFF';
    };

    // ===== 마우스 커서 효과 =====
    const cursor = document.querySelector('.terminal-cursor');
    let mouseX = 0, mouseY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (debugMode && debugVertical && debugHorizontal) {
            debugVertical.style.left = mouseX + 'px';
            debugHorizontal.style.top = mouseY + 'px';
        }
    });

    if (cursor) {
        function updateCursor() {
            cursor.style.left = mouseX - 10 + 'px';
            cursor.style.top = mouseY - 10 + 'px';
            requestAnimationFrame(updateCursor);
        }
        updateCursor();
    }

    // ===== 배경 매트릭스 효과 - 김춘수 꽃 시 =====
    function createMatrixRain() {
        const matrixBg = document.getElementById('matrixBg');
        if (!matrixBg) return;
        const poemText = '01내가그의이름을불러주기전에는그는다만하나의몸짓에지나지않았다내가그의이름을불러주었을때그는나에게로와서꽃이되었다우리들은모두무엇이되고싶다너는나에게로나는너에게로가고싶다하나의의미가되고싶다';
        const chars = poemText.split('');

        function createChar() {
            const char = document.createElement('div');
            char.className = 'matrix-char';
            char.textContent = chars[Math.floor(Math.random() * chars.length)];
            char.style.left = Math.random() * 100 + '%';
            char.style.animationDuration = (Math.random() * 3 + 2) + 's';
            char.style.fontSize = (Math.random() * 0.5 + 0.5) + 'rem';

            matrixBg.appendChild(char);

            setTimeout(() => {
                if (char.parentNode) char.remove();
            }, 5000);
        }

        setInterval(createChar, 200);
    }
    createMatrixRain();

    // ===== 모바일 햄버거 메뉴 토글 =====
    const navLinks = document.querySelector('.nav-links');

    window.toggleNav = function () {
        if (navLinks) navLinks.classList.toggle('open');
    };

    // ===== 네비게이션 링크 클릭 효과 (# 앵커만 막음) =====
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
            } else if (navLinks) {
                // 실제 이동 링크를 누르면 모바일 메뉴는 닫아준다
                navLinks.classList.remove('open');
            }
        });
    });

    // ===== 드롭다운 메뉴 처리 =====
    function toggleMenu(menuId, event) {
        event.preventDefault();
        const menu = document.getElementById(menuId);
        if (!menu) return;
        const isShown = menu.classList.contains('show');

        document.querySelectorAll('.dropdown-menu.show').forEach(m => {
            if (m.id !== menuId) m.classList.remove('show');
        });

        menu.classList.toggle('show', !isShown);
    }

    window.toggleProjectMenu = function (event) {
        toggleMenu('projectMenu', event);
    };

    window.togglePipMenu = function (event) {
        toggleMenu('pipMenu', event);
    };

    document.addEventListener('click', (event) => {
        const isNavItem = event.target.closest('.nav-item');
        if (!isNavItem) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
})();
