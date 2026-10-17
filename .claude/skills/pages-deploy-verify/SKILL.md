---
name: pages-deploy-verify
description: c0z0c.github.io를 beta 브랜치에 push한 뒤 GitHub Actions(pages build and deployment) 성공 여부와 실제 서비스(https://c0z0c.github.io/) 반영 여부를 검토하는 절차. push, 배포 확인, 라이브 사이트 검증, Actions 상태 확인이 필요할 때 사용한다.
---

# Pages 배포 검증 (c0z0c.github.io)

## 1. 전제

- 저장소: https://github.com/c0z0c/c0z0c.github.io , 서비스 브랜치: **beta** (Pages 소스는 `/docs`)
- 서비스 주소: https://c0z0c.github.io/ (포트폴리오 서비스 페이지)
- Actions: https://github.com/c0z0c/c0z0c.github.io/actions (워크플로 이름 `pages build and deployment`)
- `gh` CLI는 로그인되어 있지 않다. 공개 저장소이므로 비인증 REST API(`curl`/`urllib`)로 충분하다 (시간당 60회 제한).
  - 제한에 걸리면 환경변수 `GITHUB_TOKEN`을 설정해 실행한다 (AIc0z0c/.env의 값 재사용 가능, 로그에 출력 금지).
- 쓰기(push)는 SSH remote(`git@github.com:c0z0c/c0z0c.github.io.git`)로 동작한다.

## 2. 절차

1. 로컬 테스트: `D:\venvs\aws_lambda\Scripts\python.exe -I D:\project\portfolio\tests\run_all.py` (데이터 검증 + 로컬 서버 브라우저 테스트 + 검토 캡처). 테스트는 공개 저장소에 포함하지 않고 저장소 밖 `D:\project\portfolio\tests`에서 관리한다
2. `git branch --show-current`가 `beta`인지 확인 후 commit, `git push origin beta`
3. 배포 검증: `python .claude\skills\pages-deploy-verify\verify_deploy.py`
   - HEAD SHA에 해당하는 Actions run이 `completed/success`가 될 때까지 폴링 (기본 최대 10분)
   - `docs/` 의 서비스 대상 파일을 `git show HEAD:<path>` 내용과 라이브 응답을 바이트 비교 (CDN 캐시 반영 대기 포함)
4. 라이브 브라우저 테스트: `D:\venvs\aws_lambda\Scripts\python.exe -I D:\project\portfolio\tests\test_browser.py --base-url https://c0z0c.github.io/`
5. 실패 시: Actions run 로그 URL(`html_url`)과 `conclusion`을 보고하고, 라이브가 이전 커밋이면 재시도 대기 후에도 불일치하는 파일 목록을 그대로 보고한다. 성공으로 단정하지 않는다.

## 3. 판정 기준

| 항목 | 성공 조건 |
| --- | --- |
| Actions | `head_sha == HEAD` 인 run의 `conclusion == success` |
| 라이브 파일 | 비교 대상 전 파일 HTTP 200 + 바이트 일치 |
| 브라우저 | 4개 페이지 렌더링, 콘솔 에러 0, 채팅 더미 응답 동작, 기준 뷰포트 1905x920(브라우저 UI 제외)에서 핵심 요소가 첫 화면에 보임 |

## 4. 주의

- 한 번 push하면 Actions run이 `beta`로 2개(build, deploy) 보일 수 있다. SHA로 구분한다.
- 라이브 확인 요청에는 `?v=<timestamp>` 쿼리를 붙여 브라우저/CDN 캐시를 피한다.
- 데이터 파일(`docs/prompts/system_prompt.json` 등)은 AIc0z0c가 GitHub Raw로 읽으므로 스키마를 깨는 변경은 `D:\project\portfolio\tests\test_data.py`의 PersonaData 검증을 반드시 통과해야 한다.
