"""데이터 검증 + 로컬 서버 브라우저 테스트를 순서대로 실행한다. 하나라도 실패하면 종료 코드 1."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    code = 0
    for script in ("test_data.py", "test_browser.py"):
        print(f"\n=== {script}")
        result = subprocess.run([sys.executable, "-I", str(HERE / script)], timeout=300)
        code |= result.returncode
    return code


if __name__ == "__main__":
    sys.exit(main())
