#!/bin/sh
set -eu
cd "$(dirname "$0")"
quarto render .
(cd en && quarto render .)
# Each locale is built as a website so its own runtime and search stay local.
python3 -B tools/assemble-preview.py

python3 -B tools/publication-metadata.py

python3 -B tools/inject-discussions.py
