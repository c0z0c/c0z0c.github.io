"""프로젝트 썸네일(SVG)과 OG 이미지(PNG)를 생성한다.

사용: D:\\venvs\\aws_lambda\\Scripts\\python.exe -I tools\\gen_images.py
산출물: docs/projects/images/<id>.svg, docs/assets/og-image.png
사이트 테마(검정 배경, 녹색/보라/시안 포인트, 모노스페이스)와 맞춘 ASCII 전용 이미지다.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "projects" / "images"

# id -> (포인트 색, 큰 글자, 한 줄 설명(ASCII))
THUMBS: dict[str, tuple[str, str, str]] = {
    "autostock": ("#00ff41", "AUTOSTOCK", "LangGraph / MCP / KIS Open API"),
    "familydoctor": ("#ff4d8d", "FamilyDoctor", "Gemini + MedGemma 4B / Cloud Run"),
    "h2map": ("#00ffff", "H2 Map", "Realtime map / FastAPI / Kakao Maps"),
    "n8n-automation": ("#ffb000", "n8n + AI", "Messenger bot / Claude / Notion"),
    "nanococoa": ("#b503fc", "NanoCoCoa", "SaaS ad generation / FLUX.1-dev"),
    "g2b-rfp-search": ("#4da3ff", "RFP RAG", "LangChain / FAISS / HWP+PDF"),
    "pdf-rag-search": ("#00ff41", "PDF RAG", "2-stage search / OpenAI / FAISS"),
    "pill-classifier": ("#ff4444", "PILL AI", "Computer vision / classification"),
    "pip-packages": ("#ffd43b", "helper-*", "PyPI: hwp / md-doc / plot-hangul"),
    "sprint-mission": ("#aaaaaa", "MISSIONS", "Codeit AI sprint archive"),
}


def thumb_svg(accent: str, title: str, caption: str) -> str:
    """640x360 썸네일 SVG 문자열을 만든다."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0a0a"/>
      <stop offset="1" stop-color="#16213e"/>
    </linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="{accent}" stroke-opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect width="640" height="360" fill="url(#grid)"/>
  <rect x="0" y="0" width="10" height="360" fill="{accent}" fill-opacity="0.7"/>
  <text x="56" y="188" font-family="Consolas, 'Courier New', monospace" font-size="72" font-weight="700" fill="{accent}">{title}</text>
  <text x="56" y="236" font-family="Consolas, 'Courier New', monospace" font-size="26" fill="#e0e6ea">{caption}</text>
</svg>
"""


def og_html() -> str:
    """OG 이미지 렌더링용 HTML(1200x630)."""
    return """<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#0a0a0a,#16213e);
font-family:Consolas,'Courier New',monospace;color:#00ff41;position:relative;overflow:hidden">
<div style="position:absolute;inset:40px;border:2px solid rgba(0,255,65,.45);border-radius:16px"></div>
<div style="position:absolute;left:90px;top:130px;font-size:150px;font-weight:700;text-shadow:0 0 30px rgba(0,255,65,.5)">c0z0c</div>
<div style="position:absolute;left:96px;top:330px;font-size:38px;color:#e0e0e0">AI / SW Engineer - Kim Myunghwan</div>
<div style="position:absolute;left:96px;top:400px;font-size:28px;color:#00ffff">LLM / RAG / Agent / Embedded / Patents / PyPI</div>
<div style="position:absolute;left:96px;top:520px;font-size:26px;color:#b503fc">c0z0c.github.io</div>
</body></html>"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for pid, (accent, title, caption) in THUMBS.items():
        (OUT / f"{pid}.svg").write_text(thumb_svg(accent, title, caption), encoding="utf-8")
        print("svg", pid)

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1200, "height": 630})
        page.set_content(og_html())
        page.screenshot(path=str(ROOT / "docs" / "assets" / "og-image.png"))
        browser.close()
    print("og-image.png")


if __name__ == "__main__":
    main()
