# Suggesting Hinglish spellings offline (IndicXlit)

Why: the voice reads Roman Hindi by converting it to Devanagari with our own word
tables (`src/lib/hinglish-words.ts`). Words it does not know are logged in
`/admin/tts-words`. IndicXlit (AI4Bharat, Apache-2.0, free for commercial use) is a
trained Roman-to-Devanagari model that can suggest spellings for those words. It runs
on your computer only, never on the site, and you decide what is added.

Do not copy code or data from the `harrrshall/hinglish-tts` repo: its licence is
unclear and its word lists are tiny.

## Run it

1. In `/admin/tts-words` press the export link; save the file as `voice-words.csv`
   in the project folder.
2. One-time setup (needs Python 3.9 to 3.11; the model is a few hundred MB):
   ```
   python3 -m venv .venv-indicxlit
   source .venv-indicxlit/bin/activate
   pip install ai4bharat-transliteration
   ```
   If `pip install` fails on `fairseq`, and the dictionary will be updated (a Python 3.10
   venv usually fixes it).
3. `python3 scripts/indicxlit-candidates.py voice-words.csv`
4. Open `indicxlit-review.csv`, fill the last column (`y`, `n`, or your own spelling),
   and say so. The approved rows get added to the dictionary.

`--no-model` checks the file handling without the model. The CSV holds words fans
typed, so both CSV files are git-ignored and must never be committed.

## One-time setup, repeat run

- **Setup is once per computer.** The virtual environment (`.venv-indicxlit`) stays
  on that computer; it is not in git, so a second computer needs its own setup.
- **Running is repeated**, only when `/admin/tts-words` has collected enough new
  unknown words (say once a month, or after a busy stream week). Each run is steps 1,
  3 and 4 above, a few minutes.
- You do not need it on every computer. Pick one. The export is a download from the
  admin page, so it works from any computer's browser.

## On Windows 11 (personal laptop first, then the PC)

Same steps on both. Untested by we: the package is 2022-era and `fairseq` may
refuse to build natively on Windows, so use WSL, which is a real Linux inside Windows.

1. Open PowerShell as administrator, run `wsl --install -d Ubuntu`, restart when
   asked, then open "Ubuntu" from the Start menu and choose a username and password.
2. In Ubuntu:
   ```
   sudo apt update && sudo apt install -y git python3 python3-venv python3-pip build-essential
   git clone https://github.com/atulsharma568/Freetip.git   # use the repo's real URL
   cd Freetip
   python3 -m venv .venv-indicxlit
   source .venv-indicxlit/bin/activate
   pip install ai4bharat-transliteration
   ```
   If Ubuntu's Python is newer than 3.11 and the install fails, install Python 3.10
   (`sudo add-apt-repository ppa:deadsnakes/ppa`, then `sudo apt install python3.10
   python3.10-venv`) and create the venv with `python3.10 -m venv`.
3. Put `voice-words.csv` (downloaded in Windows, usually in Downloads) into the folder:
   `cp /mnt/c/Users/<your Windows name>/Downloads/voice-words.csv .`
4. `python3 scripts/indicxlit-candidates.py voice-words.csv`, then copy the result
   back out: `cp indicxlit-review.csv /mnt/c/Users/<your Windows name>/Downloads/`.
5. Open it in Excel, fill the last column, and send it back.

If the install ends with a numpy "size changed" error, run `pip install --upgrade numpy`.
Next time, only steps 3 to 5 are needed (after `source .venv-indicxlit/bin/activate`).
