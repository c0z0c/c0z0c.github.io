// ===== AIc0z0c 챗 데모 =====
// 실제 백엔드(Lambda + Gemini)는 아직 없음. 대신:
// - 대화 히스토리를 localStorage에 저장/복원
// - 전송 시 데모용 고정 응답을 돌려줌 (나중에 sendToBackend()만 교체하면 실제 연동)

(function () {
    const STORAGE_KEY = 'c0z0c-aichat-history-v1';

    const SEED_HISTORY = [
        { role: 'user', text: 'c0z0c은 주로 어떤 프로젝트를 하나요?' },
        {
            role: 'bot',
            text: '문서 자동화(HWP/MD/PDF 변환)와 RAG 기반 검색 프로젝트를 주로 진행했습니다. helper-hwp, helper-md-doc 같은 pip 패키지도 직접 배포하고 있어요. (샘플 응답)'
        },
        { role: 'user', text: 'helper-hwp는 뭘 해주나요?' },
        {
            role: 'bot',
            text: 'HWP 파일을 PDF/Markdown/텍스트로 변환해주는 헬퍼 패키지입니다. 문서 파이프라인에서 반복되는 변환 작업을 자동화하려고 만들었습니다. (샘플 응답)'
        }
    ];

    function loadHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return SEED_HISTORY.slice();
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : SEED_HISTORY.slice();
        } catch (err) {
            console.warn('챗 히스토리 로드 실패, 초기값 사용:', err);
            return SEED_HISTORY.slice();
        }
    }

    function saveHistory(history) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (err) {
            // localStorage가 막혀있거나 (사생활 보호 모드 등) 용량 초과인 경우 조용히 무시
            console.warn('챗 히스토리 저장 실패:', err);
        }
    }

    function render(chatWindow, history) {
        chatWindow.innerHTML = '';
        history.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = 'bubble ' + (msg.role === 'user' ? 'user' : 'bot');
            bubble.textContent = msg.text;
            chatWindow.appendChild(bubble);
        });
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // 데모용 고정 응답 (실제 연동 시 이 함수를 fetch(Lambda URL)로 교체)
    async function fakeBackendReply(userText) {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
        return `"${userText}" 에 대한 답변은 아직 데모용 고정 응답입니다. 실제 응답은 AWS Lambda + Gemini 연동 후 제공될 예정입니다.`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const chatWindow = document.getElementById('chatWindow');
        const form = document.getElementById('chatForm');
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSendBtn');
        const clearBtn = document.getElementById('chatClearBtn');
        if (!chatWindow || !form) return;

        let history = loadHistory();
        render(chatWindow, history);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            history.push({ role: 'user', text });
            saveHistory(history);
            render(chatWindow, history);

            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;

            try {
                const replyText = await fakeBackendReply(text);
                history.push({ role: 'bot', text: replyText });
                saveHistory(history);
                render(chatWindow, history);
            } finally {
                input.disabled = false;
                sendBtn.disabled = false;
                input.focus();
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                history = SEED_HISTORY.slice();
                saveHistory(history);
                render(chatWindow, history);
            });
        }
    });
})();
