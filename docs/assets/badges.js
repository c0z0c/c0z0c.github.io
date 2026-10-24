// ===== 훈장(배지) 줄 =====
// assets/badges.json의 badges 배열에 항목 하나를 추가하면 홈 히어로 아래에 훈장이 늘어난다.
// 항목: { name, issuer, image, url }

(function () {
    async function init() {
        const root = document.getElementById('heroBadges');
        if (!root) return;

        try {
            const res = await fetch('assets/badges.json', { cache: 'no-store' });
            if (!res.ok) throw new Error('badges.json load failed: ' + res.status);
            const data = await res.json();

            (data.badges || []).forEach(b => {
                const a = document.createElement('a');
                a.className = 'badge-medal';
                a.href = b.url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.setAttribute('aria-label', `${b.name} (${b.issuer})`);

                const img = document.createElement('img');
                img.src = b.image;
                img.alt = b.name;
                img.loading = 'lazy';

                const tip = document.createElement('span');
                tip.className = 'badge-tip';
                tip.textContent = b.name;
                const issuer = document.createElement('small');
                issuer.textContent = b.issuer;
                tip.appendChild(issuer);

                a.appendChild(img);
                a.appendChild(tip);
                root.appendChild(a);
            });
        } catch (err) {
            console.error(err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
