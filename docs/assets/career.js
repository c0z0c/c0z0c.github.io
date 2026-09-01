// ===== 경력 데이터 공용 로더 =====
// assets/career.json 하나를 index.html(요약)과 career.html(전체)이 함께 읽어서 렌더링한다.
// 경력 추가 방법: career.json의 timeline 배열에 항목 하나 추가하면 끝.

(function () {
    const SECTION_LABEL = {
        experience: '경력',
        education: '학력',
        openSource: '오픈소스 / 패키지'
    };
    const SECTION_ORDER = ['experience', 'education', 'openSource'];

    async function loadCareer() {
        const res = await fetch('assets/career.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('career.json load failed: ' + res.status);
        return res.json();
    }

    function renderSkills(container, skills, skillClass) {
        if (!container) return;
        container.innerHTML = '';
        (skills || []).forEach(s => {
            const span = document.createElement('span');
            span.className = skillClass;
            span.textContent = s;
            container.appendChild(span);
        });
    }

    // index.html 우상단 요약 패널
    function renderTeaser(data) {
        const leadEl = document.getElementById('careerLead');
        const timelineEl = document.getElementById('careerTimeline');
        const skillsEl = document.getElementById('careerSkills');
        if (!timelineEl) return;

        if (leadEl) leadEl.textContent = data.lead;

        timelineEl.innerHTML = '';
        data.timeline.filter(item => item.featured).forEach(item => {
            const div = document.createElement('div');
            div.className = 'timeline-item';

            const period = document.createElement('div');
            period.className = 'timeline-period';
            period.textContent = item.period;

            const role = document.createElement('div');
            role.className = 'timeline-role';
            role.textContent = item.org ? `${item.role} @ ${item.org}` : item.role;

            const desc = document.createElement('div');
            desc.className = 'timeline-desc';
            desc.textContent = item.summary;

            div.appendChild(period);
            div.appendChild(role);
            div.appendChild(desc);
            timelineEl.appendChild(div);
        });

        renderSkills(skillsEl, data.skills, 'skill-tag');
    }

    // career.html 전체 페이지
    function renderFull(data) {
        const leadEl = document.getElementById('careerLead');
        const root = document.getElementById('careerFull');
        if (!root) return;

        if (leadEl) leadEl.textContent = data.lead;

        root.innerHTML = '';
        SECTION_ORDER.forEach(sectionKey => {
            const items = data.timeline.filter(item => item.section === sectionKey);
            if (!items.length) return;

            const section = document.createElement('section');
            const h2 = document.createElement('h2');
            h2.textContent = '> ' + (SECTION_LABEL[sectionKey] || sectionKey);
            section.appendChild(h2);

            items.forEach(item => {
                const entry = document.createElement('div');
                entry.className = 'entry';

                const period = document.createElement('div');
                period.className = 'entry-period';
                period.textContent = item.period;

                const body = document.createElement('div');
                body.className = 'entry-body';

                const role = document.createElement('div');
                role.className = 'entry-role';
                role.textContent = item.role;
                body.appendChild(role);

                if (item.org) {
                    const org = document.createElement('div');
                    org.className = 'entry-org';
                    org.textContent = item.org;
                    body.appendChild(org);
                }

                if (item.bullets && item.bullets.length) {
                    const ul = document.createElement('ul');
                    item.bullets.forEach(b => {
                        const li = document.createElement('li');
                        li.textContent = b;
                        ul.appendChild(li);
                    });
                    body.appendChild(ul);
                } else if (item.summary) {
                    const org = document.createElement('div');
                    org.className = 'entry-org';
                    org.textContent = item.summary;
                    body.appendChild(org);
                }

                entry.appendChild(period);
                entry.appendChild(body);
                section.appendChild(entry);
            });

            root.appendChild(section);
        });

        const skillsSection = document.createElement('section');
        const skillsHeading = document.createElement('h2');
        skillsHeading.textContent = '> 기술 스택';
        const grid = document.createElement('div');
        grid.className = 'skills-grid';
        skillsSection.appendChild(skillsHeading);
        skillsSection.appendChild(grid);
        root.appendChild(skillsSection);
        renderSkills(grid, data.skills, 'skill-pill');
    }

    async function init() {
        const isTeaser = !!document.getElementById('careerTimeline');
        const isFull = !!document.getElementById('careerFull');
        if (!isTeaser && !isFull) return;

        try {
            const data = await loadCareer();
            if (isTeaser) renderTeaser(data);
            if (isFull) renderFull(data);
        } catch (err) {
            console.error(err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
