// ===== AIc0z0c 백엔드(POST /chat) 호출부 =====
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
// 현재는 백엔드(AWS Lambda + LangGraph) 미배포 상태라 더미 값을 반환한다.
// 연동할 때는 API_BASE_URL을 채우고 아래 "실제 호출" 블록의 주석을 풀고 더미 블록을 지운다.

(function () {
    const API_BASE_URL = ''; // 예: 'https://xxxx.execute-api.ap-northeast-2.amazonaws.com'
    const QUERY_MAX_LENGTH = 2000; // 서버 ChatRequest.query max_length 와 동일

    class ChatApiError extends Error {
        constructor(status, code, message) {
            super(message);
            this.name = 'ChatApiError';
            this.status = status;
            this.code = code;
        }
    }

    let dummySeq = 0;

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

        // ---- 실제 호출 (백엔드 배포 후 주석 해제) ----
        // const res = await fetch(`${API_BASE_URL}/chat`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ query, history_jwt: historyJwt }),
        // });
        // if (!res.ok) {
        //     const body = await res.json().catch(() => ({}));
        //     const detail = body.detail || body;
        //     throw new ChatApiError(res.status, detail.error || 'http_error', detail.message || `HTTP ${res.status}`);
        // }
        // const data = await res.json();
        // return { answer: data.answer, historyJwt: data.history_jwt };

        // ---- 더미 반환 (LLM 연동 전: 서버가 {answer, history_jwt}를 돌려줬다고 가정) ----
        await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
        dummySeq += 1;
        return {
            answer: `[더미 응답] "${query}" 질문이 접수되었습니다. 실제 답변은 백엔드(POST /chat, AWS Lambda + LangGraph) 연동 후 이력·프로젝트 데이터를 근거로 생성됩니다.`,
            historyJwt: `dummy-history-jwt.${dummySeq}`,
        };
    }

    window.AIc0z0cApi = { sendChat, ChatApiError, QUERY_MAX_LENGTH, isDummy: API_BASE_URL === '' };
})();
