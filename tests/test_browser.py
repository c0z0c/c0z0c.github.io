"""브라우저(Playwright, 시스템 Chrome) 기능 테스트.

기본은 docs/ 를 로컬 http.server 로 띄워 검사하고, --base-url 로 라이브 사이트도 같은 시나리오로 검사한다.
  python tests\\test_browser.py
  python tests\\test_browser.py --base-url https://c0z0c.github.io/
스크린샷은 tests/out/ (git 제외).
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import sys
import threading
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "out"
failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # 요청 로그 억제
        pass


def start_local_server() -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(Quiet, directory=str(ROOT / "docs"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/"


def open_page(browser, base: str, path: str, collect: dict, viewport=(1280, 800)) -> Page:
    """페이지를 열고 콘솔 에러/요청 실패를 collect[path]에 모은다."""
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
    page = ctx.new_page()
    errs: list[str] = []
    collect[path] = errs
    page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    page.on("console", lambda m: errs.append(f"console.error: {m.text}") if m.type == "error" else None)
    page.on("response", lambda r: errs.append(f"HTTP {r.status} {r.url}") if r.status >= 400 else None)
    page.goto(base + path + f"?v={int(time.time())}", wait_until="networkidle")
    return page


def test_index(browser, base, manifest, collect):
    page = open_page(browser, base, "index.html", collect)
    check(page.locator("#careerLead").inner_text().strip() != "", "index: whoami lead 렌더링")
    check(page.locator("#careerTimeline .timeline-item").count() >= 3, "index: 경력 타임라인 항목")
    check(page.locator("#careerSkills .skill-tag").count() >= 5, "index: 스킬 태그")
    check(page.locator("#portfolioStrip .proj-card").count() == 2 * len(manifest), "index: 포트폴리오 스트립 카드 수(2세트)")
    page.wait_for_function("[...document.querySelectorAll('#portfolioStrip .proj-img')].every(i => i.complete && i.naturalWidth > 0)")
    check(True, "index: 썸네일 이미지 모두 로드")
    check(page.get_attribute('meta[property="og:image"]', "content").endswith("/assets/og-image.png"), "index: og:image 메타")
    page.click("text=Projects")
    check(page.locator("#projectMenu.show").count() == 1, "index: Projects 드롭다운 열림")
    check("[더미]" not in page.content() and "dummy" not in page.inner_text("body").lower(), "index: 더미 문구 없음")
    # 히어로 문구 링크 + 외부 링크는 새 탭
    hero = page.eval_on_selector_all(".subtitle a", "els => els.map(e => e.href)")
    check(len(hero) == 7 and hero[0] == "https://github.com/c0z0c" and all("pypi.org/project/helper-" in h for h in hero[1:]), "index: 히어로 문구 7개 링크(GitHub/PyPI)")
    ext = page.eval_on_selector_all("a[href^='http']", "els => els.map(e => [e.target, e.rel])")
    check(len(ext) >= 15 and all(t == "_blank" and "noopener" in r for t, r in ext), f"index: 외부 링크 {len(ext)}개 모두 새 탭+noopener")
    internal = page.eval_on_selector_all(".nav-link[href$='.html']", "els => els.map(e => e.target)")
    check(len(internal) >= 3 and all(t == "" for t in internal), "index: 내부 페이지 링크는 같은 탭")
    with page.context.expect_page() as popup_info:
        page.click(".subtitle a >> nth=1")
    popup = popup_info.value
    check("pypi.org/project/helper-dev-utils" in popup.url or popup.url == "about:blank", "index: 히어로 링크 클릭 시 새 탭 열림")
    popup.close()
    check(page.url.startswith(base), "index: 원래 탭 유지")
    page.screenshot(path=str(OUT / "index.png"))
    page.context.close()


def test_career(browser, base, career, collect):
    page = open_page(browser, base, "career.html", collect)
    text = page.inner_text("#careerFull")
    for needle in ("중앙첨단소재", "셀런", "특허", "10-2025-0181403", "helper-hwp"):
        check(needle in text, f"career: '{needle}' 표시")
    check(page.locator("#careerFull .entry").count() == len(career["timeline"]), "career: 타임라인 항목 수 일치")
    check(page.locator(".skill-pill").count() == len(career["skills"]), "career: 스킬 수 일치")
    page.screenshot(path=str(OUT / "career.png"), full_page=True)
    page.context.close()


def test_portfolio(browser, base, manifest, collect):
    page = open_page(browser, base, "portfolio.html", collect)
    check(page.locator("#portfolioGrid .proj-card").count() == len(manifest), "portfolio: 카드 수 일치")
    page.wait_for_function("[...document.querySelectorAll('.proj-img')].every(i => i.complete && i.naturalWidth > 0)")
    check(page.locator(".proj-img").count() == len(manifest), "portfolio: 썸네일 전부 로드")
    hrefs = page.eval_on_selector_all("#portfolioGrid .proj-card", "els => els.map(e => e.href)")
    norm = lambda u: u.rstrip("/")  # noqa: E731  브라우저가 붙이는 끝 슬래시 차이 무시
    check([norm(h) for h in hrefs] == [norm(p["link"]) for p in manifest], "portfolio: 링크가 manifest 순서/값과 일치")
    check("manifest.json" not in page.inner_text(".page-sub"), "portfolio: 개발자용 안내 문구 제거")
    page.screenshot(path=str(OUT / "portfolio.png"), full_page=True)
    page.context.close()


def test_chat(browser, base, collect):
    page = open_page(browser, base, "AIc0z0c.html", collect)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    check(page.locator("#chatWindow .bubble").count() == 4, "chat: 예시 대화 4개 표시")
    check(page.locator("#chatSuggestions .chip").count() >= 6, "chat: 추천 질문 칩(페르소나 데이터 기반)")
    check("AutoStock" in page.inner_text("#chatSuggestions"), "chat: 추천 질문에 실제 프로젝트명")
    check(page.get_attribute("#chatInput", "maxlength") == "2000", "chat: 입력 maxlength 2000")
    check("더미" in page.inner_text("#chatModeNote"), "chat: 더미 모드 안내 표시")

    # 직접 입력 -> 더미 응답 + history_jwt 저장
    page.fill("#chatInput", "H2 Map은 어떤 서비스인가요?")
    page.click("#chatSendBtn")
    page.wait_for_selector("#chatWindow .bubble.bot >> nth=2")
    check(page.locator("#chatWindow .bubble").count() == 6, "chat: 질문+더미 응답 추가")
    check("[더미 응답]" in page.locator("#chatWindow .bubble").last.inner_text(), "chat: 더미 응답 내용")
    jwt = page.evaluate("JSON.parse(localStorage.getItem('c0z0c-aichat-v2')).historyJwt")
    check(isinstance(jwt, str) and jwt.startswith("dummy-history-jwt"), "chat: history_jwt 저장")
    check(page.is_enabled("#chatInput") and page.input_value("#chatInput") == "", "chat: 입력창 복구/비움")

    # 칩 클릭
    page.locator("#chatSuggestions .chip").first.click()
    page.wait_for_function("document.querySelectorAll('#chatWindow .bubble').length === 8")
    check(True, "chat: 추천 칩 클릭으로 질의 전송")

    # 새로고침 후 복원
    page.reload(wait_until="networkidle")
    check(page.locator("#chatWindow .bubble").count() == 8, "chat: 새로고침 후 대화 복원")

    # 서버 전송 요청 본문 계약 확인: sendChat 에 전달되는 인자 캡처
    page.evaluate("""() => { window.__calls = []; const orig = window.__origSend = window.AIc0z0cApi.sendChat;
        window.AIc0z0cApi.sendChat = (q, j) => { window.__calls.push([q, j]); return orig(q, j); }; }""")
    page.fill("#chatInput", "계약 확인")
    page.click("#chatSendBtn")
    page.wait_for_function("document.querySelectorAll('#chatWindow .bubble').length === 10")
    call = page.evaluate("window.__calls[0]")
    check(call[0] == "계약 확인" and str(call[1]).startswith("dummy-history-jwt"), "chat: 이전 history_jwt를 다음 요청에 전달")

    # 오류 처리: 429 는 jwt 유지, 400 은 jwt 폐기
    page.evaluate("""() => { const E = window.AIc0z0cApi.ChatApiError;
        window.AIc0z0cApi.sendChat = async () => { throw new E(429, 'rate_limited', 'x'); }; }""")
    before = page.evaluate("JSON.parse(localStorage.getItem('c0z0c-aichat-v2')).historyJwt")
    page.fill("#chatInput", "차단 테스트")
    page.click("#chatSendBtn")
    page.wait_for_selector("#chatWindow .bubble.error")
    check("일시적으로 제한" in page.locator("#chatWindow .bubble.error").last.inner_text(), "chat: 429 안내 문구")
    check(page.evaluate("JSON.parse(localStorage.getItem('c0z0c-aichat-v2')).historyJwt") == before, "chat: 429 시 history_jwt 유지")

    page.evaluate("""() => { const E = window.AIc0z0cApi.ChatApiError;
        window.AIc0z0cApi.sendChat = async () => { throw new E(400, 'invalid_history', 'x'); }; }""")
    page.fill("#chatInput", "만료 테스트")
    page.click("#chatSendBtn")
    page.wait_for_function("document.querySelectorAll('#chatWindow .bubble.error').length === 2")
    check(page.evaluate("JSON.parse(localStorage.getItem('c0z0c-aichat-v2')).historyJwt") is None, "chat: 400 시 history_jwt 폐기")
    check(page.is_enabled("#chatInput"), "chat: 오류 후에도 입력 가능")

    # 길이 제한 (API 계층, 원본 sendChat 복원 후)
    msg = page.evaluate("""async () => { window.AIc0z0cApi.sendChat = window.__origSend; try { await window.AIc0z0cApi.sendChat('x'.repeat(2001), null); return 'no error'; }
        catch (e) { return e.status + ':' + e.code; } }""")
    check(msg == "422:query_too_long", "chat: 2000자 초과 거부(422)")

    # 초기화
    page.click("#chatClearBtn")
    check(page.locator("#chatWindow .bubble").count() == 4, "chat: 대화 초기화 -> 예시 대화")
    check(page.evaluate("JSON.parse(localStorage.getItem('c0z0c-aichat-v2')).historyJwt") is None, "chat: 초기화 시 history_jwt 없음")
    page.screenshot(path=str(OUT / "aichat.png"), full_page=True)
    page.context.close()


def test_mobile(browser, base, collect):
    page = open_page(browser, base, "index.html", collect, viewport=(390, 844))
    page.click(".nav-toggle")
    check(page.locator(".nav-links.open").count() == 1, "mobile: 햄버거 메뉴 열림")
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "mobile: 가로 스크롤 없음")
    page.screenshot(path=str(OUT / "index_mobile.png"))
    page.context.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="")
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)

    server = None
    base = args.base_url
    if not base:
        server, base = start_local_server()
    base = base.rstrip("/") + "/"
    print("target", base)

    manifest = json.loads((ROOT / "docs/projects/manifest.json").read_text(encoding="utf-8"))
    career = json.loads((ROOT / "docs/assets/career.json").read_text(encoding="utf-8"))
    if args.base_url:  # 라이브는 라이브 데이터를 기준으로 비교
        manifest = json.load(urllib.request.urlopen(base + "projects/manifest.json?v=%d" % time.time()))
        career = json.load(urllib.request.urlopen(base + "assets/career.json?v=%d" % time.time()))

    collect: dict[str, list[str]] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        test_index(browser, base, manifest, collect)
        test_career(browser, base, career, collect)
        test_portfolio(browser, base, manifest, collect)
        test_chat(browser, base, collect)
        test_mobile(browser, base, collect)
        browser.close()

    for path, errs in collect.items():
        check(not errs, f"{path}: 콘솔 에러/실패 요청 0건 {errs[:3]}")

    if server:
        server.shutdown()
    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
