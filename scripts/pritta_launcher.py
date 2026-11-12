"""Entry point used by PyInstaller for PriTta.exe (desktop window)."""

import sys

from pritta.app import main

if __name__ == "__main__":
    sys.exit(main())
