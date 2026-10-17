// ===== AIc0z0c 백엔드(POST /chat) 호출부 =====
// 화면 로직과 백엔드 API의 경계를 분리하는 모듈이다.
// 이 파일이 LLM 백엔드와 닿는 유일한 지점이다. 나머지(UI, 히스토리 저장, 오류 처리)는 aichat.js.
//
// API 계약 (AIc0z0c/src/app/routers/chat.py)
//   요청  POST {API_BASE_URL}/chat   { "query": string(<=2000), "history_jwt": string | null }
//   200   { "answer": string, "history_jwt": string }   -> history_jwt는 다음 요청에 그대로 보낸다 (서버는 무상태)
//   400   { "error": "invalid_history", ... }            -> 서명 불일치/만료: 클라이언트가 history_jwt를 버리고 새 대화로 시작
//   422   query 길이 초과 등 검증 실패
//   429   { "error": "rate_limited", "message": ... }    -> 인젝션 시도로 인한 일시 차단, history_jwt는 그대로 유지
//   500   서버 오류
//
// AWS Lambda Function URL의 실제 챗 API를 호출한다.

(function () {
    const API_BASE_URL = 'https://6m325nkitd32edu6pcn4khoqqa0dkplz.lambda-url.us-east-1.on.aws';
    const QUERY_MAX_LENGTH = 2000; // 서버 ChatRequest.query max_length 와 동일

    class ChatApiError extends Error {
        constructor(status, code, message) {
            super(message);
            this.name = 'ChatApiError';
            this.status = status;
            this.code = code;
        }
    }

    /**
     * 질의를 백엔드로 보내고 답변과 갱신된 history_jwt를 받는다.
     * @param {string} query 사용자 질의 (최대 2000자)
     * @param {string|null} historyJwt 이전 응답의 history_jwt, 새 대화면 null
     * @returns {Promise<{answer: string, historyJwt: string}>}
     * @throws {ChatApiError} HTTP 오류(400/422/429/5xx)
     */
    async function sendChat(query, historyJwt) {
        if (query.length > QUERY_MAX_LENGTH) {
            throw new ChatApiError(422, 'query_too_long', `질문은 ${QUERY_MAX_LENGTH}자 이내로 입력해 주세요.`);
        }

        const res = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, history_jwt: historyJwt }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const detail = body.detail || body;
            throw new ChatApiError(res.status, detail.error || 'http_error', detail.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return { answer: data.answer, historyJwt: data.history_jwt };
    }

    window.AIc0z0cApi = { sendChat, ChatApiError, QUERY_MAX_LENGTH, isDummy: API_BASE_URL === '' };
})();
