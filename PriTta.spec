# -*- mode: python ; coding: utf-8 -*-
# Build:  pyinstaller --noconfirm --clean PriTta.spec
# Output: dist/PriTta.exe      (double-click: desktop app)
#         dist/pritta-cli.exe  (command line, replaces primer3.sh)

import os
import sys

from PyInstaller.utils.hooks import collect_all

ICON = os.path.join("pritta", "web", "img", "icon.ico")
if not os.path.isfile(ICON):  # fall back to the built-in Helly icon
    ICON = os.path.join("pritta", "web", "img", "helly-icon.ico")


def collect(*packages):
    datas, binaries, hidden = [], [], []
    for pkg in packages:
        try:
            d, b, h = collect_all(pkg)
        except Exception:
            continue
        datas += d
        binaries += b
        hidden += h
    return datas, binaries, hidden


excludes = ["tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "qtpy", "matplotlib", "pandas", "IPython", "gi"]

# ---------------------------------------------------------------- desktop app
gui_pkgs = ["primer3", "webview"]
gui_hidden = ["pritta.app", "pritta.cli", "pritta.server", "bottle", "proxy_tools"]
if sys.platform == "win32":
    # pywebview's Windows backend (WinForms + Edge WebView2 through pythonnet)
    gui_pkgs += ["pythonnet", "clr_loader"]
    gui_hidden += ["clr", "webview.platforms.winforms", "webview.platforms.edgechromium"]
d, b, h = collect(*gui_pkgs)
gui = Analysis(
    [os.path.join("scripts", "pritta_launcher.py")],
    pathex=["."],
    datas=[(os.path.join("pritta", "web"), os.path.join("pritta", "web"))] + d,
    binaries=b,
    hiddenimports=gui_hidden + h,
    excludes=excludes,
)
gui_exe = EXE(
    PYZ(gui.pure),
    gui.scripts,
    gui.binaries,
    gui.datas,
    [],
    name="PriTta",
    console=False,
    icon=ICON,
    upx=False,
)

# ---------------------------------------------------------------- command line
d, b, h = collect("primer3")
cli = Analysis(
    [os.path.join("scripts", "pritta_cli_launcher.py")],
    pathex=["."],
    datas=d,
    binaries=b,
    hiddenimports=["pritta.cli"] + h,
    excludes=excludes + ["webview", "clr", "pythonnet"],
)
cli_exe = EXE(
    PYZ(cli.pure),
    cli.scripts,
    cli.binaries,
    cli.datas,
    [],
    name="pritta-cli",
    console=True,
    icon=ICON,
    upx=False,
)
