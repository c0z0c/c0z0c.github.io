// ===== AIc0z0c 챗 UI =====
// AIc0z0c.html의 입력·대화 표시·localStorage 복원을 담당한다.
// - 표시용 대화 로그와 서버가 발급한 history_jwt를 localStorage에 저장/복원 (서버는 무상태)
// - 백엔드 호출은 window.AIc0z0cApi.sendChat (aichat-api.js) 에만 의존
// - 추천 질문은 prompts/system_prompt.json(페르소나 데이터)의 실제 프로젝트 이름으로 만든다

(function () {
    const STORAGE_KEY = 'c0z0c-aichat-v2';

    // 첫 방문 시 보여주는 예시 대화 (실제 이력 데이터 기반, 서버 응답이 아님)
    const SEED_HISTORY = [
        { role: 'user', text: 'c0z0c은 어떤 일을 해온 개발자인가요?' },
        {
            role: 'bot',
            text: '22년간 IPTV/셋톱박스, 철도 통합 방송·보안, 한전 전력 계량(DCU) 같은 임베디드·시스템 소프트웨어를 개발했고, 2025년 하반기부터 LLM·RAG·에이전트·n8n 자동화로 영역을 넓히고 있습니다. (예시 대화)'
        },
        { role: 'user', text: 'helper-hwp는 뭘 해주나요?' },
        {
            role: 'bot',
            text: 'HWP 5.x / HWP97 / HWPX 파일을 파싱해 텍스트, Markdown, HTML, DOCX, PDF로 변환해주는 PyPI 패키지입니다. (예시 대화)'
        }
    ];

    const GENERIC_QUESTIONS = [
        '주로 어떤 기술을 다루나요?',
        'RAG나 LLM 에이전트를 직접 만들어 본 적 있나요?',
        '특허는 어떤 것이 있나요?'
    ];

    function emptyState() {
        return { messages: SEED_HISTORY.slice(), historyJwt: null };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return emptyState();
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.messages)) return emptyState();
            return { messages: parsed.messages, historyJwt: parsed.historyJwt || null };
        } catch (err) {
            console.warn('챗 상태 로드 실패, 초기값 사용:', err);
            return emptyState();
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            console.warn('챗 상태 저장 실패:', err); // 저장소 차단/용량 초과 시 무시
        }
    }

    function render(chatWindow, messages) {
        chatWindow.innerHTML = '';
        messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = 'bubble ' + (msg.role === 'user' ? 'user' : msg.role === 'error' ? 'error' : 'bot');
            bubble.textContent = msg.text;
            chatWindow.appendChild(bubble);
        });
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function shortName(name) {
        return name.split(/ - | \(/)[0].trim();
    }

    async function renderSuggestions(container, onPick) {
        if (!container) return;
        let questions = GENERIC_QUESTIONS.slice();
        try {
            const res = await fetch('prompts/system_prompt.json', { cache: 'no-store' });
            if (!res.ok) throw new Error('system_prompt.json load failed: ' + res.status);
            const persona = await res.json();
            const projectQs = persona.projects.slice(0, 4).map(p => `${shortName(p.name)}은(는) 어떤 프로젝트인가요?`);
            questions = projectQs.concat(GENERIC_QUESTIONS);
        } catch (err) {
            console.warn('추천 질문 로드 실패, 기본 질문 사용:', err);
        }
        container.innerHTML = '';
        questions.forEach(q => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip';
            btn.textContent = q;
            btn.addEventListener('click', () => onPick(q));
            container.appendChild(btn);
        });
    }

    function errorMessage(err) {
        if (err && err.status === 429) return '요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.';
        if (err && err.status === 400) return '대화 기록 검증에 실패해 새 대화로 시작합니다. 질문을 다시 보내 주세요.';
        if (err && err.status === 422) return err.message;
        return '답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }

    document.addEventListener('DOMContentLoaded', () => {
        const chatWindow = document.getElementById('chatWindow');
        const form = document.getElementById('chatForm');
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSendBtn');
        const clearBtn = document.getElementById('chatClearBtn');
        const modeNote = document.getElementById('chatModeNote');
        if (!chatWindow || !form || !window.AIc0z0cApi) return;

        input.maxLength = window.AIc0z0cApi.QUERY_MAX_LENGTH;
        if (modeNote) {
            modeNote.textContent = window.AIc0z0cApi.isDummy
                ? 'LLM 백엔드 연동 전: 응답은 더미 값입니다.'
                : '';
        }

        let state = loadState();
        render(chatWindow, state.messages);

        async function submit(text) {
            text = text.trim();
            if (!text) return;

            state.messages.push({ role: 'user', text });
            saveState(state);
            render(chatWindow, state.messages);

            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;

            try {
                const reply = await window.AIc0z0cApi.sendChat(text, state.historyJwt);
                state.messages.push({ role: 'bot', text: reply.answer });
                state.historyJwt = reply.historyJwt;
            } catch (err) {
                console.warn('챗 요청 실패:', err);
                if (err && err.status === 400) state.historyJwt = null; // 서명 불일치/만료: 새 대화로
                state.messages.push({ role: 'error', text: errorMessage(err) });
            } finally {
                saveState(state);
                render(chatWindow, state.messages);
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
            }
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submit(input.value);
        });

        renderSuggestions(document.getElementById('chatSuggestions'), submit);

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                state = emptyState();
                saveState(state);
                render(chatWindow, state.messages);
            });
        }
    });
})();
