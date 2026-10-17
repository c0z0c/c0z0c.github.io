"""데이터 검증 + 브라우저 테스트 + 검토용 캡처(tests/out)를 순서대로 실행한다. 하나라도 실패하면 종료 코드 1."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    code = 0
    for script in ("test_data.py", "test_browser.py", "capture_all.py"):
        print(f"\n=== {script}")
        result = subprocess.run([sys.executable, "-I", str(HERE / script)], timeout=300)
        code |= result.returncode
    return code


if __name__ == "__main__":
    sys.exit(main())
