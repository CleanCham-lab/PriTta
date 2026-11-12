"""Entry point used by PyInstaller for pritta-cli.exe (command line)."""

import sys

from pritta.cli import main

if __name__ == "__main__":
    sys.exit(main())
