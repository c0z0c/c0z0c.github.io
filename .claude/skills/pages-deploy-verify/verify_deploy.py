"""push 이후 GitHub Pages 배포(Actions)와 실제 서비스 반영 여부를 검증한다.

사용: python verify_deploy.py [--repo c0z0c/c0z0c.github.io] [--site https://c0z0c.github.io/]
      [--timeout 600]
종료 코드: 0 성공, 1 실패.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
import time
import urllib.request

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("verify_deploy")


def _get(url: str, binary: bool = False):
    """GET 요청. GITHUB_TOKEN이 있으면 api.github.com 요청에만 붙인다(값은 로그 금지)."""
    headers = {"User-Agent": "pages-deploy-verify"}
    token = os.environ.get("GITHUB_TOKEN")
    if token and url.startswith("https://api.github.com"):
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
    return body if binary else json.loads(body)


def _git(*args: str) -> bytes:
    return subprocess.run(["git", *args], check=True, capture_output=True).stdout


def wait_actions(repo: str, sha: str, timeout: int) -> bool:
    """HEAD SHA의 Actions run이 success가 될 때까지 대기한다."""
    deadline = time.time() + timeout
    url = f"https://api.github.com/repos/{repo}/actions/runs?head_sha={sha}&per_page=10"
    while time.time() < deadline:
        runs = _get(url)["workflow_runs"]
        for run in runs:
            log.info("run %s %s status=%s conclusion=%s", run["id"], run["name"], run["status"], run["conclusion"])
        if runs and all(r["status"] == "completed" for r in runs):
            ok = all(r["conclusion"] == "success" for r in runs)
            for r in runs:
                log.info("  %s", r["html_url"])
            return ok
        time.sleep(15)
    log.error("Actions 대기 시간 초과")
    return False


def compare_live(site: str, timeout: int) -> bool:
    """docs/ 하위 서비스 파일을 git HEAD 내용과 라이브 응답을 바이트 비교한다."""
    paths = [p for p in _git("ls-tree", "-r", "--name-only", "HEAD", "docs").decode("utf-8").splitlines() if p]
    pending = set(paths)
    deadline = time.time() + timeout
    while pending and time.time() < deadline:
        for path in sorted(pending):
            rel = path[len("docs/"):]
            url = site.rstrip("/") + "/" + rel + f"?v={int(time.time())}"
            try:
                live = _get(url, binary=True)
            except Exception as err:  # 404 등은 CDN 반영 지연일 수 있어 재시도
                log.info("대기 %s (%s)", rel, err)
                continue
            if live.replace(b"\r\n", b"\n") == _git("show", f"HEAD:{path}").replace(b"\r\n", b"\n"):
                pending.discard(path)
        if pending:
            time.sleep(10)
    for path in sorted(pending):
        log.error("불일치/미반영: %s", path)
    log.info("라이브 일치 %d/%d", len(paths) - len(pending), len(paths))
    return not pending


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default="c0z0c/c0z0c.github.io")
    parser.add_argument("--site", default="https://c0z0c.github.io/")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    sha = _git("rev-parse", "HEAD").decode().strip()
    log.info("HEAD %s branch=%s", sha[:7], _git("branch", "--show-current").decode().strip())
    ok = wait_actions(args.repo, sha, args.timeout) and compare_live(args.site, 180)
    log.info("RESULT %s", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
