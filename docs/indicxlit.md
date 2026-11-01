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

Same steps on both. Tested on the personal laptop on 2026-11-01 (the steps below
include every problem hit there). We use WSL, a real Linux inside Windows, because
`fairseq` may refuse to build natively on Windows.

1. Open PowerShell as administrator, run `wsl --install -d Ubuntu`, and restart when
   asked. If "Ubuntu" is not in the Start menu, search for it, look in Windows
   Terminal's down-arrow list, or run `wsl -l -v` then `wsl -d Ubuntu` in PowerShell.
   (`wsl --update` saying "already installed" only means WSL itself is there; if no
   distribution is listed, run the install command again.) The first start asks you to
   choose a Linux username and password.
2. Get the repo into Ubuntu's **own disk** (`~`), never under `/mnt/c/...`: the Windows
   drive cannot hold a proper Python environment.
   - The repo is **private**, so `git clone` asks for a username and password. Make a
     read-only token: GitHub > Settings > Developer settings > Fine-grained tokens >
     Generate new token, only the Freetip repo, Contents: Read-only, short expiry.
     Use the GitHub username as the username and the token as the password (nothing
     shows as you paste). Never save the token in a file or paste it in chat.
   - If you already cloned under `/mnt/c`, copy it instead: `cp -r /mnt/c/Users/<your
     Windows name>/Freetip ~/Freetip`.
3. In Ubuntu (Ubuntu's own Python can be too new, for example 3.14, so `uv` installs
   Python 3.10 for us):
   ```
   sudo apt update && sudo apt install -y git build-essential curl
   curl -LsSf https://astral.sh/uv/install.sh | sh
   source ~/.local/bin/env
   cd ~/Freetip
   uv venv --python 3.10 .venv-indicxlit
   source .venv-indicxlit/bin/activate
   uv pip install torch --index-url https://download.pytorch.org/whl/cpu
   uv pip install ai4bharat-transliteration
   ```
   The torch line is optional: it keeps the install small (the plain package pulls
   several GB of NVIDIA GPU libraries that this CPU-only helper never uses). If it
   errors, skip it and run only the last line.
4. Check the install finished (inside `~/Freetip`, with the environment active, the
   prompt starts with `(.venv-indicxlit)`):
   `python3 -c "import ai4bharat.transliteration; print('ok')"` must print `ok`. If it
   errors, redo step 3. Stopping the install half way (Ctrl+C) is safe: just run the
   two `uv pip install` lines again. The first real run may also download the model
   files, which takes a few minutes.
5. Get the word list: it is not made by the install. Sign in as the owner, open
   `/admin/tts-words` on the live site and download the export; it lands in Windows
   Downloads as `voice-words.csv`. If the log is still empty (few tips so far) there
   is nothing to do yet; stop and come back another day. Then copy it in:
   `cp /mnt/c/Users/<your Windows name>/Downloads/voice-words.csv .`
6. `python3 scripts/indicxlit-candidates.py voice-words.csv`, then copy the result
   back out: `cp indicxlit-review.csv /mnt/c/Users/<your Windows name>/Downloads/`.
7. Open it in Excel, fill the last column, and send it back.

Problems seen: `error: externally-managed-environment` means the venv was not made
properly (usually because the folder was on `/mnt/c`, or Python is too new); redo
step 2 and 3. A numpy "size changed" error: `uv pip install --upgrade numpy`.
Next time, only steps 5 to 7 are needed (after `source .venv-indicxlit/bin/activate`
inside `~/Freetip`).
