<p align="center">
  <img src="docs/logo.png" width="128" alt="PriTta">
</p>

<h1 align="center">PriTta</h1>

<p align="center">
  <b>Primer + 뜌땨</b> · 게임처럼 쓰는 Primer3 PCR 프라이머 설계 앱<br>
  <i>"뜌따.. 뜌우따이 뜌따따 우따야!"</i>
</p>

<p align="center">
  <a href="README.md">English</a> | <b>한국어</b>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-4FE3C1">
  <img alt="python" src="https://img.shields.io/badge/python-3.9%2B-6CA8FF">
  <img alt="engine" src="https://img.shields.io/badge/engine-Primer3%20(primer3--py)-FFD23F">
  <img alt="platform" src="https://img.shields.io/badge/Windows-PriTta.exe-B79CFF">
</p>

![PriTta 화면](docs/screenshot_ko.png)

## PriTta는?

**PriTta(프리따)**는 **Pri**mer와 마스코트의 울음소리 **뜌땨**를 합친 이름입니다.
마스코트가 하는 말은 *"뜌따.. 뜌우따이 뜌따따 우따야!"* 하나뿐이지만, 프라이머는
제대로 짜 줍니다.

[Primer3](https://github.com/primer3-org/primer3) 기반 데스크톱 앱입니다. 서열을
붙여넣고 `[ ]`로 타깃을 표시한 뒤 **프라이머 설계**를 누르면 다음을 보여 줍니다.

- 등급(S~D)이 매겨진 후보 프라이머 쌍
- 헤어핀·이합체 검사 결과
- 앰플리콘 지도와 예상 겔 그림

결과는 올리고 주문서, 결과표, Primer3 원본 형식(`.primer3.in` / `.primer3.out`)으로
내보낼 수 있습니다.

Primer3 엔진은 [primer3-py](https://github.com/libnano/primer3-py)로 앱 안에 들어
있어서 WSL이나 `primer3_core`를 따로 설치할 필요가 없습니다. **기본 PCR** 프리셋은
기존 `primer3.sh`와 바이트 단위로 같은 결과를 냅니다(`tests/`에서 검증).

## 빠른 시작 (Windows)

1. [Releases](../../releases)에서 **`PriTta.exe`**를 받습니다.
2. 더블클릭합니다. 설치할 것이 없습니다.
3. **예제** → **프라이머 설계**를 눌러 보세요.

파일 하나짜리 앱이라 처음 실행할 때 압축을 푸느라 몇 초 걸립니다. 코드 서명이 안 된
exe여서 Windows SmartScreen 경고가 뜰 수 있는데, **추가 정보 → 실행**을 누르면 됩니다.
Windows 10/11에 기본으로 들어 있는 Microsoft Edge WebView2를 사용하며, 오래된 PC라면
[WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)을 먼저 설치하세요.

## 기능

| | |
|---|---|
| **서열 입력** | 텍스트, FASTA(여러 서열 가능), Boulder-IO 파일을 끌어다 놓거나, 파일로 열거나, 아무 곳에서나 Ctrl+V로 붙여넣을 수 있습니다. 서열과 함께 붙여넣은 메모 줄(유전자명, HGVS, 좌표)은 경고와 함께 무시합니다. |
| **영역 지정** | `[타깃]`, `<제외>`, `{포함}`. Primer3Web과 같은 문법입니다. 서열을 드래그한 뒤 타깃·제외·포함 버튼으로 지정해도 됩니다. |
| **프리셋** | 기본 PCR(`primer3.sh`와 동일), qPCR(SYBR), qPCR + TaqMan 프로브, Sanger 시퀀싱. Primer3 파라미터는 모두 직접 바꿀 수 있습니다. |
| **결과** | S/A/B/C/D 등급, 색으로 구분한 서열과 원클릭 복사, 헤어핀·이합체 위험도 막대, ASCII 2차 구조, 100 bp 래더 기준 예상 겔, 후보가 왜 탈락했는지 보여 주는 막대를 제공합니다. |
| **일괄 처리** | 멀티 FASTA를 불러와 모든 서열을 한 번에 설계합니다. |
| **내보내기** | 올리고 주문서(별표한 쌍), CSV/TSV 결과표, `.primer3.in`, `.primer3.out`. 예전 `.primer3.out`을 열면 다시 돌리지 않고 결과를 보여 줍니다. |
| **마스코트** | Primer3가 도는 동안 DNA 머리가 빙글빙글 돌고, 성공하면 점프하고, 실패하면 시무룩해집니다. 클릭하면 팁을 알려 줍니다. |
| **편의** | 한국어/영어 화면, 라이트/다크 테마, 효과음(기본값 꺼짐). |

## 사용법

1. **서열 넣기.** PCR 산물에 꼭 들어가야 할 부분을 표시합니다.

   ```text
   ...GGCCGCAGC[GCCCGGGCCCCCCCTCACCG]CGCCGCCCCC...
   ```

   | 표시 | 의미 | Primer3 태그 |
   |---|---|---|
   | `[ ... ]` | 타깃: 산물이 이 영역을 포함해야 함 | `SEQUENCE_TARGET` |
   | `< ... >` | 제외: 프라이머가 겹치면 안 됨 (SNP, 반복 서열) | `SEQUENCE_EXCLUDED_REGION` |
   | `{ ... }` | 포함: 프라이머가 이 안에 있어야 함 | `SEQUENCE_INCLUDED_REGION` |

2. **설정** 탭에서 프리셋을 고르고, 필요하면 산물 크기·Tm·GC 등을 조정합니다.
3. **프라이머 설계** 버튼을 누릅니다(Ctrl+Enter).
4. **결과 확인과 내보내기.** 카드나 지도의 레인을 클릭하면 서열에서 해당 쌍이
   강조됩니다. 원하는 쌍에 별표를 하고 **내보내기 → 올리고 주문서**를 고르세요.

### NCBI Primer-BLAST로 특이도 확인하기

[Primer-BLAST](https://www.ncbi.nlm.nih.gov/tools/primer-blast/)에 템플릿 없이
forward/reverse 프라이머만 넣을 때, 지노믹 DNA로 설계한 프라이머라면 **Database**를
**RefSeq Representative genomes**(Organism *Homo sapiens*)로 바꾸세요. 기본값인
*RefSeq mRNA*에서는 인트론에 있거나 엑손을 감싸는 프라이머가 템플릿을 찾지 못해
아무 결과도 나오지 않습니다.

### 등급

Primer3 pair penalty 기준입니다(0이면 모든 조건이 최적값).
**S** ≤ 0.5 · **A** ≤ 1.5 · **B** ≤ 3 · **C** ≤ 6 · **D** > 6.

카드마다 있는 위험도 막대 다섯 개는 헤어핀·이합체 구조의 열역학적 Tm을 설정의
한계값(기본 47 °C)과 비교한 것입니다. 한 칸이면 한계에서 멀고, 다섯 칸이면
한계에 닿았거나 넘은 것입니다.

### 좌표

앱 화면과 내보낸 결과표의 위치는 **1부터** 셉니다. `.primer3.in` / `.primer3.out`
원본 파일은 `primer3_core`와 똑같이 **0부터** 세는 좌표를 그대로 씁니다.

## 명령줄

`pritta-cli`는 `primer3.sh`를 대신하며 Windows, 리눅스, macOS에서 모두 동작합니다.

```bash
pritta-cli example_seq.txt ex_example           # -> ex_example.primer3.in / .primer3.out
pritta-cli targets.fa run1 --preset qpcr --csv   # + run1.primers.csv, run1.order.tsv
pritta-cli seq.txt out --set PRIMER_PRODUCT_SIZE_RANGE=200-400 --set PRIMER_NUM_RETURN=10
```

Windows 릴리스에는 `pritta-cli.exe`가 들어 있습니다. 소스에서는 `python -m pritta.cli`를 쓰면 됩니다.

기본 엔진은 `primer3-py`입니다. 직접 빌드한 `primer3_core`를 쓰려면 PriTta가
`$PRIMER3_BIN`, `~/tool/primer3/src/primer3_core`, `PATH` 순서로 찾습니다.
설정 → 고급 설정 → 엔진에서 고르거나 `--engine primer3_core`를 주세요.

## 소스에서 실행

```bash
git clone https://github.com/CleanCham-lab/PriTta.git
cd PriTta
pip install -r requirements.txt
python -m pritta              # 데스크톱 창 (Windows/macOS, 리눅스는 GTK·Qt 필요)
python -m pritta --browser    # 웹 브라우저로 열기
```

WSL에서 실행하면 Windows 브라우저로 자동으로 열립니다.

## Windows 앱 빌드

- **내 PC에서:** `build_windows.bat`을 더블클릭합니다(Windows용 Python 필요).
  같은 폴더에 `PriTta.exe`와 `pritta-cli.exe`가 만들어집니다.
- **직접 명령으로:** `pip install -r requirements.txt pyinstaller`를 실행한 뒤
  `pyinstaller --noconfirm --clean PriTta.spec`를 실행합니다.

## 폴더 구성

```text
pritta/
  sequence.py   서열·[ ] < > { } 표시 해석, FASTA, Boulder-IO 입력
  params.py     Primer3 파라미터, 기본값, 프리셋
  engine.py     Primer3 실행, 결과 정리, .primer3.in/.out 작성
  export.py     CSV/TSV 결과표, 올리고 주문서
  api.py        화면과 엔진을 잇는 연결부
  app.py        데스크톱 창(pywebview) / 브라우저 모드
  cli.py        명령줄
  web/          화면(HTML/CSS/JS), 마스코트, 아이콘, 폰트
tests/          테스트 (primer3.sh와 바이트 단위 일치 검증 포함)
icon/           PriTta 원본 아트워크
```

## 인용

PriTta가 도움이 되었다면 Primer3를 인용해 주세요.

> Untergasser A, Cutcutache I, Koressaar T, Ye J, Faircloth BC, Remm M, Rozen SG.
> Primer3 — new capabilities and interfaces. *Nucleic Acids Research* 2012;40(15):e115.

## 라이선스

PriTta 소스 코드는 [MIT 라이선스](LICENSE)입니다.

- Windows 빌드에는 Primer3 / primer3-py(GPL-2.0-or-later)가 함께 들어 있어서, 그 묶음
  실행 파일은 GPL 조건으로 배포됩니다.
- 폰트는 SIL OFL 1.1입니다.
- 마스코트·아이콘 이미지는 MIT 라이선스에 포함되지 않습니다.

자세한 내용은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 보세요.

## 만든 사람

**채승원 (Seung Won Chae)**: 서울대학교병원 진단검사의학과 분자진단검사실, 서울대학교 암연구소.
