"""Outline the user's local Segoe UI fonts for exploratory logo lockups.

This is an artifact preparation script, not an application dependency. Install
fonttools into tmp/logo-tools to run it; no font files are copied or distributed.
"""

from pathlib import Path
import math
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tmp" / "logo-tools"))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = ROOT / "output" / "brand"
INK = "#15171c"
ROUND = sys.argv[1] if len(sys.argv) > 1 else "v2"


def outlined(text, font_name, size, x, baseline):
    font = TTFont(Path("C:/Windows/Fonts") / font_name)
    glyphs = font.getGlyphSet()
    mapping = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    paths = []
    position = x
    for char in text:
        name = mapping[ord(char)]
        pen = SVGPathPen(glyphs)
        transform = TransformPen(pen, (scale, 0, 0, -scale, position, baseline))
        glyphs[name].draw(transform)
        if pen.getCommands():
            data = re.sub(r"-?\d+(?:\.\d+)?", lambda match: f"{float(match.group()):.2f}".rstrip("0").rstrip("."), pen.getCommands())
            paths.append(f'<path fill="{INK}" d="{data}"/>')
        position += glyphs[name].width * scale
    font.close()
    return "".join(paths), position


def symbol(path):
    root = ET.parse(path).getroot()
    return "".join(ET.tostring(child, encoding="unicode") for child in root if child.tag.endswith("path"))


for key in ("a", "b", "c"):
    mark = symbol(OUT / f"concept-{key}-{ROUND}.svg")
    name = "Reshi" if key != "c" else "eshi"
    x = 288 if key != "c" else (356 if ROUND == "v2" else 348)
    paths, end = outlined(name, "segoeuib.ttf", 110, x, 132)
    if key == "c":
        # The custom open r shares the wordmark's x-height and baseline.
        # It is intentionally separate from the standard Segoe UI body type.
        offset_y = 42.8 if ROUND == "v2" else 34
        paths = f'<g transform="translate(264 {offset_y}) scale(.44)">{mark}</g>' + paths
    descriptor, descriptor_end = outlined("Resume Studio", "seguisb.ttf", 43, 288, 195)
    width = math.ceil(max(end, descriptor_end) + 32)
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 256" '
           f'role="img" aria-labelledby="title"><title id="title">Reshi Resume Studio concept {key.upper()}</title>'
           f'<g id="symbol">{mark}</g><g id="wordmark">{paths}{descriptor}</g></svg>')
    (OUT / f"concept-{key}-lockup-{ROUND}.svg").write_text(doc, encoding="utf-8")

print("Wrote three outlined exploratory lockups; no fonts embedded.")
