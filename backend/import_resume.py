"""Explicit one-time local import: python -m backend.import_resume --docx ..."""

import argparse
from pathlib import Path
from .main import initial_import, migrate

parser = argparse.ArgumentParser()
parser.add_argument("--docx", required=True, type=Path)
parser.add_argument("--pdf", type=Path)
args = parser.parse_args()
migrate()
initial_import(args.docx, args.pdf)
print("Resume imported locally. Existing master and original source files are preserved.")
