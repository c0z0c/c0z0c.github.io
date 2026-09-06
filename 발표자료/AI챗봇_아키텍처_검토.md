# AIc0z0c 챗봇 — 아키텍처 검토 (AWS Lambda + FastAPI + Gemini)

> 대상: `docs/AIc0z0c.html`의 더미 챗 UI에 실제 백엔드를 연결하는 안
> 방식: 이력서/프로젝트 텍스트(~100K)를 통째로 프롬프트에 넣는 "풀 컨텍스트 주입" (별도 벡터DB/RAG 없음)

---

## 1. 제안 아키텍처

```
[c0z0c.github.io/AIc0z0c.html]
        │  fetch(POST /chat)
        ▼
[AWS Lambda Function URL]  ← 상시 무료 티어 (월 100만 요청 + 40만 GB-초)
        │  FastAPI + Mangum 어댑터
        ▼
[Lambda 코드]
   - 이력서/프로젝트 텍스트(~100K)를 시스템 프롬프트로 고정 삽입
   - 사용자 질문 + 시스템 프롬프트 → Gemini API 호출
        ▼
[Gemini API] (Google AI Studio 키, Lambda 환경변수로 보관 — 프론트엔드에 노출 안 함)
        │
        ▼
   답변 텍스트 → 프론트로 반환
```

- **프론트(GitHub Pages)는 정적**이라 API 키를 절대 가질 수 없음 → 반드시 Lambda가 프록시 역할을 해야 함 (지난 논의와 동일한 원칙).
- 100K 텍스트는 Gemini Flash 계열의 **1M 토큰 컨텍스트 윈도우** 안에 여유 있게 들어가므로, 임베딩/벡터DB 없이 매 요청마다 통째로 프롬프트에 붙여도 됨. 구현이 훨씬 단순해지는 대신, 매 호출마다 100K 토큰 분량의 **입력 비용이 매번 청구**된다는 트레이드오프가 있음 (아래 4번 참고).

## 2. 모델 선택 — 왜 "가장 저렴한 모델"인가

2026년 8월 기준 Gemini 요금 (출처는 문서 하단):

| 모델 | 입력 ($/1M 토큰) | 출력 ($/1M 토큰) | 컨텍스트 윈도우 | 비고 |
|---|---|---|---|---|
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | 1M | 가장 저렴, **2026-10-16 단종 예정** |
| Gemini 3.1 Flash-Lite | $0.25 | $1.50 | 1M | 2.5 Flash-Lite 단종 후 사실상 최저가 |
| Gemini 3.5 Flash-Lite | $0.15 | $1.25 | 1M | 최신 세대 경량 모델 |

→ 결론: 지금 시작한다면 **2.5 Flash-Lite**로 붙이되, 10월 단종 일정이 있으니 **모델명을 환경변수로 빼두고** 단종 시점에 3.x Flash-Lite로 바로 교체할 수 있게 만드는 걸 권장.

## 3. 비용 추정 (100K 텍스트 풀 컨텍스트 주입 기준)

가정: 이력서/프로젝트 텍스트 100,000자 ≈ 한글 기준 토큰 약 6~8만 토큰(문자:토큰 비율은 텍스트 성격에 따라 유동적 — 실측 필요). 여유 있게 **요청당 입력 10만 토큰**으로 계산.

- 2.5 Flash-Lite 입력 단가 $0.10/1M → **요청 1회당 입력 비용 약 $0.01**
- 출력(답변) 500토큰 가정 → $0.40/1M × 0.0005M ≈ **$0.0002**
- **요청 1회 ≈ $0.01 안팎**

→ 포트폴리오 방문자가 하루 50번 채팅해도 월 비용은 대략 $15 수준. 다만 이건 어뷰징(봇이 무제한 호출)이 없다는 전제이며, 지난번 논의한 **App Check + Rate limit + 키 사용량 캡**이 반드시 같이 들어가야 이 추정치가 의미가 있음.

**참고**: Gemini API 자체에도 무료 티어가 있음 (Flash-Lite 기준 분당 15회, 일 1,000회, 분당 25만 토큰 — 계정/리전에 따라 유동적). 개인 포트폴리오 규모 트래픽이면 **유료 결제 없이 무료 티어만으로도 충분히 운영 가능**할 가능성이 높음. 다만 무료 티어는 요청 제한이 낮아 트래픽이 몰리면 바로 막히므로, "일단 무료 티어로 시작 → 필요 시 결제 전환" 전략을 권장.

## 4. RAG(벡터 검색) vs 풀 컨텍스트 주입 — 왜 지금은 후자가 맞는가

| | 풀 컨텍스트 주입 (제안) | RAG (벡터DB) |
|---|---|---|
| 구현 복잡도 | 낮음 (텍스트 파일 하나 + 프롬프트 조립) | 높음 (임베딩, 벡터DB, 검색 로직) |
| 데이터 100K 규모 | 1M 컨텍스트 윈도우에 여유 있게 들어감 | 굳이 필요 없음 |
| 요청당 비용 | 매번 10만 토큰치 입력 비용 발생 | 검색된 일부만 넣어 입력 비용 절감 |
| 확장성 | 텍스트가 수백만 토큰으로 커지면 한계 | 데이터가 커져도 비용/속도 영향 적음 |

→ 100K 텍스트 규모, 개인 포트폴리오 트래픽에서는 **RAG가 과설계**. 지금은 풀 컨텍스트 주입으로 시작하고, 나중에 프로젝트가 많아져 텍스트가 수백만 자 단위로 커지면 그때 RAG 도입을 고려하는 게 합리적.

## 5. 보안 — 지난 논의 요약 (재확인)

1. Gemini API 키는 Lambda 환경변수에만 존재, 프론트엔드에 절대 노출 안 함
2. CORS를 `c0z0c.github.io`로 제한 (기본 위생, 완전한 방어는 아님)
3. **Firebase App Check** 연동 — Referer 스푸핑보다 훨씬 강한 "진짜 내 페이지에서 온 요청" 검증
4. Rate limiting (IP/세션당 분당 요청 수 제한)
5. 최후 안전장치: Gemini API 키에 월 사용량 캡 설정 + GCP/Google Cloud 예산 알림

## 6. 클라이언트 상태 관리 — 대화 히스토리는 localStorage

**결정**: 대화 히스토리는 서버(Lambda)가 아니라 **브라우저 local storage에 저장/관리**한다.

- Lambda는 stateless로 유지 — 세션/DB 없이 요청-응답만 처리하면 되므로 구조가 단순해지고 비용도 안 듦
- 사용자 프라이버시 측면에서도 대화 내용이 서버에 안 남는 게 유리 (개인 포트폴리오 사이트라 굳이 대화 로그를 서버에 쌓을 이유가 없음)
- 브라우저/기기를 바꾸면 히스토리가 안 이어진다는 단점은 있지만, 이 사이트 성격(1회성 방문자와의 짧은 QA)에는 문제 없다고 판단
- 프론트 구현: `docs/AIc0z0c.html` + `docs/assets/aichat.js`에 이미 반영 완료
  - 키: `c0z0c-aichat-history-v1`, 값: `[{role: 'user'|'bot', text: string}, ...]`
  - 저장/복원, "대화 초기화" 버튼까지 구현 (현재는 데모용 고정 응답, 실제 Gemini 연동 전 단계)

## 7. API 계약 (요청/응답 JSON)

Lambda가 stateless이므로, **history는 클라이언트(local storage)가 들고 있다가 매 요청마다 실어 보낸다.**

```json
// 요청 POST /chat
{
  "query": "helper-hwp는 뭐하는 패키지예요?",
  "history": [
    { "role": "user", "text": "c0z0c은 주로 어떤 프로젝트를 하나요?" },
    { "role": "bot",  "text": "문서 자동화와 RAG 기반 검색 프로젝트를 주로..." }
  ]
}
```

```json
// 응답 200
{
  "answer": "HWP 파일을 PDF/Markdown/텍스트로 변환해주는 헬퍼 패키지입니다...",
  "model": "gemini-2.5-flash-lite"
}
```

```json
// 응답 4xx/5xx (에러도 JSON으로 통일)
{
  "error": "rate_limited",
  "message": "잠시 후 다시 시도해주세요."
}
```

**주의할 점**

- `role`은 프론트 저장 포맷(`user`/`bot`)과 그대로 맞춤 — 변환 로직 불필요
- `history`를 통째로 다 보내면 대화가 길어질수록 요청마다 토큰 비용이 계속 커짐 (100K 이력서 텍스트는 서버 쪽 시스템 프롬프트로 별도 고정 주입되므로 이건 순수 대화 turn 누적 비용). **클라이언트에서 최근 6~10턴만 잘라서 전송**하는 걸 권장
- 서버(Lambda)에서도 `query` 길이 + `history` 총 길이에 상한을 걸어서, 비정상적으로 큰 payload로 비용을 태우는 걸 막아야 함 (5번 보안 섹션의 rate limit/사용량 캡과 같은 맥락)

## 8. 남은 결정 사항 (다음에 정할 것)

- [ ] 100K 텍스트를 어떤 형식으로 관리할지 (단일 `.txt`/`.md`를 Lambda 배포 패키지에 포함? S3에서 불러오기?)
- [ ] Gemini API 키를 Google AI Studio에서 발급할지, Vertex AI로 갈지 (Vertex는 GCP 프로젝트/결제 필요, AI Studio가 더 가벼움)
- [ ] Lambda 배포 방식 (AWS SAM vs CDK vs 수동 zip 업로드) — AWS 강의 진도에 맞춰 결정
- [x] ~~프론트(AIc0z0c.html)의 더미 챗 UI를 실제 fetch 호출로 교체~~ → 입력 UI + localStorage 히스토리는 구현 완료, 실제 fetch(Lambda) 연동만 남음

---

### 출처
- [Gemini pricing in 2026: every model, every plan](https://www.cloudzero.com/blog/gemini-pricing/)
- [Gemini API Pricing (2026): Flash, Pro, and Flash-Lite Per-Token Costs](https://www.morphllm.com/gemini-api-pricing)
- [Gemini API Pricing 2026: Complete Per-1M-Token Cost Guide](https://www.aifreeapi.com/en/posts/gemini-api-pricing-2026)
- [Gemini API Free Tier Rate Limits 2026](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)
- [Gemini API Free Tier 2026: 1,500 Req/Day, 1M TPM](https://tokenmix.ai/blog/gemini-api-free-tier-limits)

*가격/한도는 변동이 잦으니 실제 구현 직전에 [Google AI 공식 가격 페이지](https://ai.google.dev/pricing)에서 재확인 권장.*
