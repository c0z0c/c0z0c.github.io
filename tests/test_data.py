"""데이터 파일 정적 검증 (브라우저 불필요).

- system_prompt.json: AIc0z0c prompt_loader.PersonaData 스키마로 실제 검증
- 세 JSON 모두 더미/깨진 문자열 없음
- manifest 의 썸네일/링크/id 규칙, career 섹션 규칙

실행: D:\\venvs\\aws_lambda\\Scripts\\python.exe -I tests\\test_data.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
AIC_SRC = Path(r"D:\project\portfolio\AIc0z0c\src")

BANNED = ["(더미)", "더미", "dummy", "example.com", "샘플", "sample", "lorem", "\ufffd"]
SECTIONS = {"experience", "education", "patent", "openSource"}

failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


def strings(node):
    """JSON 트리의 모든 문자열 값을 순회한다."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)


def load(rel: str):
    return json.loads((DOCS / rel).read_text(encoding="utf-8"))


def main() -> int:
    persona = load("prompts/system_prompt.json")
    career = load("assets/career.json")
    manifest = load("projects/manifest.json")

    for name, data in [("system_prompt", persona), ("career", career), ("manifest", manifest)]:
        hits = [(b, s[:40]) for s in strings(data) for b in BANNED if b.lower() in s.lower()]
        check(not hits, f"{name}.json 더미/깨진 문자열 없음 {hits[:3]}")

    # ---- PersonaData 스키마 (AIc0z0c 원본 모델 사용) ----
    sys.path.insert(0, str(AIC_SRC))
    from app.services.prompt_loader import PersonaData  # noqa: E402

    model = PersonaData.model_validate(persona)
    check(len(model.projects) >= 5, f"persona projects {len(model.projects)}건")
    check(set(persona) == set(PersonaData.model_fields), "persona 최상위 키가 스키마와 정확히 일치")
    check(all(p["duration_weeks"] >= 0 for p in persona["projects"]), "duration_weeks 음수 없음")
    check("@" in model.contact.email, "contact.email 형식")
    check(len(json.dumps(persona, ensure_ascii=False)) < 40000, "persona 크기 40KB 미만(프롬프트 토큰 예산)")

    # ---- manifest ----
    ids = [p["id"] for p in manifest]
    check(len(ids) == len(set(ids)), "manifest id 중복 없음")
    for p in manifest:
        check(all(k in p for k in ("id", "title", "description", "tags", "link", "media")), f"manifest[{p['id']}] 필수 키")
        check(p["link"].startswith("https://"), f"manifest[{p['id']}] https 링크")
        if p.get("thumbImage"):
            check((DOCS / p["thumbImage"]).is_file(), f"manifest[{p['id']}] thumbImage 존재")
        check(p["media"].get("type") != "video" or p["media"].get("src", "").startswith("https://"), f"manifest[{p['id']}] media")

    # ---- career ----
    check(bool(career["lead"]) and bool(career["skills"]), "career lead/skills")
    check({t["section"] for t in career["timeline"]} <= SECTIONS, "career section 값 유효")
    check(any(t["featured"] for t in career["timeline"]), "career featured 항목 존재")
    check(sum(t["featured"] for t in career["timeline"]) <= 6, "career featured 6개 이하(홈 요약 패널)")

    # ---- 정적 자원 ----
    for rel in ("assets/og-image.png", "favicon.png", "favicon.ico"):
        check((DOCS / rel).is_file(), f"{rel} 존재")

    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
