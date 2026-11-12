# Third-party notices

PriTta's own source code is released under the MIT License (see `LICENSE`).
It uses or bundles the following components, which keep their own licenses.

| Component | Used for | License |
|---|---|---|
| [Primer3](https://github.com/primer3-org/primer3) (libprimer3) | primer design engine | GPL-2.0-or-later |
| [primer3-py](https://github.com/libnano/primer3-py) | Python bindings to Primer3 | GPL-2.0-or-later |
| [pywebview](https://github.com/r0x0r/pywebview) | desktop window | BSD-3-Clause |
| [Pretendard](https://github.com/orioncactus/pretendard) | UI font | SIL OFL 1.1 |
| [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) | display font | SIL OFL 1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | sequence font | SIL OFL 1.1 |
| [Jua](https://fonts.google.com/specimen/Jua) | mascot speech bubble font | SIL OFL 1.1 |

Font license texts are in `pritta/web/fonts/licenses/`.

**About the Windows release build.** The prebuilt `PriTta.exe` bundles
Primer3 and primer3-py, which are GPL-2.0-or-later. That combined binary is
therefore distributed under the terms of the GPL-2.0-or-later; the complete
corresponding source is this repository plus the upstream projects linked
above. Using PriTta's MIT-licensed source on its own (without the bundled
engine) is unaffected.

**Mascot and icon images.** `pritta/web/img/mascot.png`, `icon.png` and
`icon.ico` are not covered by the MIT License; rights remain with their
respective owners. Helly, the built-in fallback mascot drawn in SVG
(`pritta/web/js/mascot.js`, `helly-icon.*`), is an original character made
for this project and is covered by the MIT License.
