#!/usr/bin/env python3
"""Build the stripped font subsets used by the OG image renderer.

The browser gets Monaspace straight from @fontsource. The OG renderer cannot:
`next/og` uses Satori, whose opentype parser rejects Monaspace's GSUB table
("lookupType: 6 - substFormat: 1 is not yet supported") — that lookup *is*
texture-healing, the contextual kerning that makes Monaspace readable as body
text. It has no meaning in a 1200x630 static render anyway.

So this script produces OG-only copies with GSUB/GPOS removed and the glyph
set reduced to Latin-1 plus the punctuation the card actually uses. Output
lands in lib/og-fonts/ and is committed — the build must not depend on Python.

Regenerate after bumping @fontsource/monaspace-*:

    cd frontend && pip install fonttools brotli && python3 scripts/build-og-fonts.py
"""

import pathlib
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "lib" / "og-fonts"

# Latin-1 printable, plus the bullet, dashes and quotes a marketing string
# realistically picks up. Subsetting to the exact current copy would turn any
# future wording tweak into tofu.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026]
)

FACES = [
    ("monaspace-neon", 400),
    ("monaspace-krypton", 400),
    ("monaspace-krypton", 700),
]


def build(family: str, weight: int) -> None:
    src = (
        ROOT
        / "node_modules"
        / "@fontsource"
        / family
        / "files"
        / f"{family}-latin-{weight}-normal.woff"
    )
    font = TTFont(src)

    for table in ("GSUB", "GPOS"):
        if table in font:
            del font[table]

    subsetter = subset.Subsetter(
        subset.Options(layout_features=[], notdef_outline=True, drop_tables=[])
    )
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)

    font.flavor = None  # write a bare TTF; Satori reads it happily
    dest = OUT / f"{family}-{weight}.ttf"
    font.save(dest)
    print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for family, weight in FACES:
        build(family, weight)
