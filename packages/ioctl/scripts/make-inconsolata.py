# Makes the Consolas substitute in src/pages/pptx/fonts from Inconsolata's
# variable font (https://github.com/google/fonts/tree/main/ofl/inconsolata):
# its SemiExpanded width, whose characters are 0.55em wide like Consolas's, in
# regular and bold. Inconsolata has no italic, so the italics are slanted copies.
#
# Usage: python make-inconsolata.py 'Inconsolata[wdth,wght].ttf' out-dir
# (needs fonttools)
import math
import sys
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SLANT = 10  # degrees

source, out = sys.argv[1:3]


def slant(font):
    glyphs = font.getGlyphSet()
    glyf = font['glyf']
    skew = math.tan(math.radians(SLANT))
    for name in font.getGlyphOrder():
        pen = TTGlyphPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (1, 0, skew, 1, 0, 0)))
        glyf[name] = pen.glyph()
        glyf[name].recalcBounds(glyf)
    font['post'].italicAngle = -SLANT
    font['hhea'].caretSlopeRise, font['hhea'].caretSlopeRun = 1000, round(1000 * skew)


def rename(font, style):
    family = 'Inconsolata SemiExpanded'
    names = {1: family, 2: style, 3: f'{family} {style}', 4: f'{family} {style}', 6: f"InconsolataSemiExpanded-{style.replace(' ', '')}"}
    table = font['name']
    table.names = [n for n in table.names if n.nameID not in (16, 17, 21, 22, 25) and n.nameID < 256]
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


for style, weight, italic in (('Regular', 400, False), ('Bold', 700, False), ('Italic', 400, True), ('Bold Italic', 700, True)):
    font = instancer.instantiateVariableFont(TTFont(source), {'wdth': 112.5, 'wght': weight})
    for table in ('STAT', 'MVAR', 'HVAR'):
        if table in font:
            del font[table]
    if italic:
        slant(font)
    os2 = font['OS/2']
    os2.usWeightClass = weight
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b1 if italic else 0) | (0b100000 if weight == 700 else 0) | (0 if italic or weight == 700 else 0b1000000)
    font['head'].macStyle = (0b10 if italic else 0) | (0b1 if weight == 700 else 0)
    rename(font, style)
    font.save(f"{out}/Inconsolata-{style.replace(' ', '')}.ttf")
    print(style, font['hmtx']['a'][0], font['post'].italicAngle)
