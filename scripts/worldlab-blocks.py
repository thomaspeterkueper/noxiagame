#!/usr/bin/env python3
"""Zeichnet die Fassaden- und Dachbilder für den Baukasten der Erdkarte.

Aufruf: python3 scripts/worldlab-blocks.py
Ergebnis: public/worldlab/blocks/<art>/{wand-erdgeschoss,wand-obergeschoss,dach}.png

Regeln aus docs/workstreams/world-map-zeichenvorlage.md: 16 Pixel je Meter,
von vorn und flach, ohne seitliche Schatten, nahtlos (Wände nach rechts,
Obergeschoss zusätzlich nach oben, Dach in beide Richtungen). Maße müssen zu
lib/worldlab/blocks.ts passen. Die Bilder sind vollständig errechnet – wer ein
Stück von Hand nachzeichnen will, übermalt die erzeugte Datei.
"""
from pathlib import Path
from PIL import Image, ImageDraw

PX = 16
ROOT = Path(__file__).resolve().parent.parent / 'public' / 'worldlab' / 'blocks'


def rgb(color, factor=1.0):
    return tuple(max(0, min(255, round(((color >> s) & 255) * factor))) for s in (16, 8, 0))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def noise(x, y, seed=0):
    """Fester Zufallswert 0..1 je Pixel – ohne Nachbarschaft, daher an jedem Rand nahtlos."""
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 0xFFFF


def grain(img, amount=0.035, seed=0):
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            f = 1 + (noise(x, y, seed) - .5) * 2 * amount
            px[x, y] = tuple(max(0, min(255, round(c * f))) for c in px[x, y])
    return img


def window(d, x0, y0, w, h, frame, glass, bars=(1, 1), sill=None):
    """Fenster mit Rahmen, Sprossen und Bank. Glas oben etwas heller (Himmel), nicht seitlich."""
    d.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=frame)
    gx0, gy0, gx1, gy1 = x0 + 2, y0 + 2, x0 + w - 3, y0 + h - 3
    for y in range(gy0, gy1 + 1):
        t = (y - gy0) / max(1, gy1 - gy0)
        d.line([(gx0, y), (gx1, y)], fill=mix(mix(glass, (255, 255, 255), .28), glass, t))
    cols, rows = bars
    for i in range(1, cols + 1):
        x = gx0 + round((gx1 - gx0 + 1) * i / (cols + 1)) - 1
        d.line([(x, gy0), (x, gy1)], fill=frame)
        d.line([(x + 1, gy0), (x + 1, gy1)], fill=frame)
    for i in range(1, rows + 1):
        y = gy0 + round((gy1 - gy0 + 1) * i / (rows + 1))
        d.line([(gx0, y), (gx1, y)], fill=frame)
    if sill:
        d.rectangle([x0 - 2, y0 + h, x0 + w + 1, y0 + h + 1], fill=sill)


def plaster_wall(w, h, color, plinth=None, plinth_h=8, seed=1):
    img = Image.new('RGB', (w, h), rgb(color))
    grain(img, .03, seed)
    d = ImageDraw.Draw(img)
    if plinth:
        d.rectangle([0, h - plinth_h, w - 1, h - 1], fill=plinth)
        d.line([(0, h - plinth_h), (w - 1, h - plinth_h)], fill=mix(plinth, (0, 0, 0), .18))
        px = img.load()
        for y in range(h - plinth_h + 1, h):
            for x in range(w):
                f = 1 + (noise(x, y, seed + 7) - .5) * .12
                px[x, y] = tuple(max(0, min(255, round(c * f))) for c in px[x, y])
    return img, d


# ── Wohnhaus ───────────────────────────────────────────────────────────────
def house(ground):
    w, h = 48, 48
    img, d = plaster_wall(w, h, 0xf4ead6, plinth=(176, 164, 146) if ground else None, seed=11)
    frame, glass, shutter = (250, 248, 242), (104, 138, 162), (86, 116, 92)
    top = 9 if ground else 10
    ww, wh = 18, 22
    x0 = (w - ww) // 2
    # Fensterläden links und rechts, dazwischen das Fenster – außen bleibt glatte Wand
    for sx in (x0 - 6, x0 + ww + 1):
        d.rectangle([sx, top, sx + 4, top + wh - 1], fill=shutter)
        for y in range(top + 2, top + wh - 1, 3):
            d.line([(sx + 1, y), (sx + 3, y)], fill=mix(shutter, (0, 0, 0), .22))
    window(d, x0, top, ww, wh, frame, glass, bars=(1, 1), sill=(214, 204, 186))
    if not ground:
        # Schmales Gesims am Geschossfuß – wiederholt sich je Geschoss
        d.line([(0, h - 1), (w - 1, h - 1)], fill=(224, 213, 192))
    return img


def tile_roof(base, w=64, h=64, tile_w=8, row_h=8, seed=3):
    """Ziegeldach: Reihen waagerecht, je Reihe um halbe Ziegelbreite versetzt, unten rund."""
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    for y in range(h):
        row = y // row_h
        ry = y % row_h
        for x in range(w):
            tx = (x + (tile_w // 2 if row % 2 else 0)) % tile_w
            col = ((x + (tile_w // 2 if row % 2 else 0)) // tile_w) % (w // tile_w)
            tone = 1 + (noise(col, row % (h // row_h), seed) - .5) * .22
            # oben hell (liegt frei), unten Schattenkante der überlappenden Reihe
            f = tone * (1.08 - ry / row_h * .2)
            if ry == row_h - 1:
                f *= .62
            # runde Unterkante: Ecken der vorletzten Zeile dunkel
            if ry == row_h - 2 and tx in (0, tile_w - 1):
                f *= .7
            if tx == 0 and ry < row_h - 1:
                f *= .86
            px[x, y] = rgb(base, f)
    return grain(img, .025, seed + 1)


# ── Zeile / Mehrfamilienhaus ───────────────────────────────────────────────
def row(ground):
    w, h = 48, 48
    img, d = plaster_wall(w, h, 0xefe6d8, plinth=(150, 146, 140) if ground else None, plinth_h=9, seed=21)
    frame, glass = (246, 246, 244), (96, 126, 152)
    ww, wh = 20, 26
    x0, top = (w - ww) // 2, (8 if ground else 9)
    # Fasche um das Fenster
    d.rectangle([x0 - 2, top - 2, x0 + ww + 1, top + wh + 1], fill=(250, 246, 238))
    window(d, x0, top, ww, wh, frame, glass, bars=(1, 2), sill=(198, 192, 182))
    if not ground:
        d.line([(0, h - 1), (w - 1, h - 1)], fill=(214, 205, 190))
        d.line([(0, h - 2), (w - 1, h - 2)], fill=(236, 228, 214))
    return img


# ── Halle ──────────────────────────────────────────────────────────────────
def hall(ground):
    w, h = 96, 64
    base = 0xd9dee0
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    for y in range(h):
        for x in range(w):
            rib = x % 8
            px[x, y] = rgb(base, 1.05 if rib in (1, 2) else .9 if rib == 0 else .97 if rib == 7 else 1.0)
    grain(img, .015, 31)
    d = ImageDraw.Draw(img)
    if ground:
        d.rectangle([0, h - 8, w - 1, h - 1], fill=(158, 160, 158))
        d.line([(0, h - 8), (w - 1, h - 8)], fill=(120, 124, 124))
        # Sektionaltor 3 m breit, 3 m hoch, mittig – links und rechts 1,5 m Wand
        gx0, gy0, gx1, gy1 = 24, h - 8 - 48, 71, h - 9
        d.rectangle([gx0 - 2, gy0 - 2, gx1 + 2, gy1], fill=(96, 104, 110))
        for y in range(gy0, gy1 + 1):
            seg = (y - gy0) % 12
            c = (70, 96, 118) if seg else (48, 68, 86)
            if seg == 1:
                c = (92, 120, 142)
            d.line([(gx0, y), (gx1, y)], fill=c)
        # Sichtfenster in der zweiten Sektion
        for i in range(3):
            d.rectangle([gx0 + 6 + i * 14, gy0 + 15, gx0 + 13 + i * 14, gy0 + 20], fill=(150, 178, 196), outline=(40, 58, 74))
    else:
        # Lichtband 1 m hoch mit Pfosten jeden Meter, 0,5 m Rand
        d.rectangle([8, 14, w - 9, 33], fill=(84, 96, 104))
        for y in range(16, 32):
            t = (y - 16) / 15
            d.line([(10, y), (w - 11, y)], fill=mix((176, 200, 214), (112, 146, 168), t))
        for x in range(8 + 16, w - 9, 16):
            d.line([(x, 14), (x, 33)], fill=(84, 96, 104))
            d.line([(x + 1, 14), (x + 1, 33)], fill=(84, 96, 104))
        d.line([(0, h - 1), (w - 1, h - 1)], fill=(186, 192, 195))
    return img


def sheet_roof(base=0x8d979c, w=64, h=64):
    """Trapezblech: Rippen zum First hin (senkrecht im Bild), Stoß der Tafeln alle 4 m."""
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    for y in range(h):
        for x in range(w):
            rib = x % 8
            f = 1.1 if rib in (2, 3) else .84 if rib == 0 else .94 if rib in (1, 7) else 1.0
            if y == h - 1:
                f *= .8
            if y == 0:
                f *= 1.06
            px[x, y] = rgb(base, f)
    return grain(img, .02, 41)


# ── Fabrik ─────────────────────────────────────────────────────────────────
def factory(ground):
    """Wellblech (Sicken alle 25 cm), Geschoss 5 m. Unten Rolltor 4 m, oben durchgehendes Fensterband."""
    w, h = 96, 80
    base = 0xc9d0d4
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    for y in range(h):
        for x in range(w):
            rib = x % 4
            px[x, y] = rgb(base, 1.07 if rib == 1 else .86 if rib == 3 else 1.0)
    grain(img, .015, 61)
    d = ImageDraw.Draw(img)
    if ground:
        d.rectangle([0, h - 8, w - 1, h - 1], fill=(150, 152, 150))
        d.line([(0, h - 8), (w - 1, h - 8)], fill=(116, 120, 120))
        # Rolltor 4 m breit, 3,5 m hoch, mittig; Lamellen alle 0,25 m
        gx0, gy0, gx1, gy1 = 16, h - 8 - 56, 79, h - 9
        d.rectangle([gx0 - 2, gy0 - 3, gx1 + 2, gy1], fill=(82, 90, 96))
        for y in range(gy0, gy1 + 1):
            c = (132, 140, 146) if (y - gy0) % 4 else (104, 112, 118)
            d.line([(gx0, y), (gx1, y)], fill=c)
        # Gelb-schwarze Anfahrschutz-Pfosten neben dem Tor
        for x0 in (gx0 - 6, gx1 + 3):
            for y in range(h - 8 - 16, h - 8):
                d.line([(x0, y), (x0 + 2, y)], fill=(222, 178, 40) if (y // 3) % 2 else (40, 40, 40))
    else:
        # Fensterband 1,25 m hoch, 0,5 m unter der Oberkante, durchgehend; Pfosten jeden Meter
        y0, y1 = 8, 28
        d.rectangle([0, y0, w - 1, y1], fill=(80, 92, 100))
        for y in range(y0 + 2, y1 - 1):
            t = (y - y0) / (y1 - y0)
            d.line([(0, y), (w - 1, y)], fill=mix((172, 196, 210), (108, 140, 162), t))
        for x in range(0, w, 16):
            d.line([(x, y0), (x, y1)], fill=(80, 92, 100))
    return img


def shed_roof(base=0x7a8288, w=64, h=64):
    """Sheddach von oben: alle 4 m eine Reihe Oberlichter (oben im Bild = zum First), dazwischen geneigtes Blech."""
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    glass = 14
    for y in range(h):
        for x in range(w):
            if y < glass:
                g = mix((178, 204, 218), (120, 152, 172), y / glass)
                px[x, y] = g if x % 8 else (84, 98, 108)
            else:
                t = (y - glass) / (h - glass)
                rib = x % 8
                f = (1.14 - .34 * t) * (1.05 if rib in (2, 3) else .9 if rib == 0 else 1.0)
                px[x, y] = rgb(base, f)
    d = ImageDraw.Draw(img)
    d.line([(0, glass), (w - 1, glass)], fill=rgb(base, .55))
    d.line([(0, h - 1), (w - 1, h - 1)], fill=rgb(base, .5))
    return grain(img, .02, 71)


# ── Kirche ─────────────────────────────────────────────────────────────────
def church(ground):
    w, h = 64, 56
    base = 0xe9e2d2
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    block_w, block_h = 16, 8
    for y in range(h):
        r = y // block_h
        for x in range(w):
            sx = x + (block_w // 2 if r % 2 else 0)
            c = (sx // block_w) % (w // block_w)
            f = 1 + (noise(c, r, 51) - .5) * .1
            if y % block_h == block_h - 1 or sx % block_w == 0:
                f *= .86  # Fuge
            px[x, y] = rgb(base, f)
    grain(img, .025, 52)
    d = ImageDraw.Draw(img)
    if ground:
        d.rectangle([0, h - 10, w - 1, h - 1], fill=(168, 160, 144))
        d.line([(0, h - 10), (w - 1, h - 10)], fill=(126, 120, 108))
        d.line([(0, h - 11), (w - 1, h - 11)], fill=(206, 198, 180))
    # Spitzbogenfenster, mittig
    ww = 16
    x0 = (w - ww) // 2
    top, bottom = (6, h - 16) if ground else (6, h - 8)
    stone, glass = (150, 142, 126), (58, 84, 122)
    arch = 10
    for y in range(top, bottom + 1):
        if y < top + arch:
            t = (top + arch - y) / arch
            half = round((ww / 2) * (1 - t * t) ** .5)
        else:
            half = ww // 2
        if half <= 0:
            continue
        cx = x0 + ww // 2
        d.line([(cx - half, y), (cx + half - 1, y)], fill=stone)
        if half > 2:
            tone = (y - top) / (bottom - top)
            d.line([(cx - half + 2, y), (cx + half - 3, y)], fill=mix(mix(glass, (255, 255, 255), .25), glass, tone))
    cx = x0 + ww // 2
    d.line([(cx - 1, top + 5), (cx - 1, bottom - 2)], fill=stone)
    d.line([(cx, top + 5), (cx, bottom - 2)], fill=stone)
    for y in range(top + arch + 6, bottom - 3, 9):
        d.line([(x0 + 2, y), (x0 + ww - 3, y)], fill=stone)
    d.rectangle([x0 - 2, bottom + 1, x0 + ww + 1, bottom + 2], fill=(198, 190, 172))
    return img


def slate_roof(base=0x5f6e7a, w=64, h=64):
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    sw, sh = 8, 8
    for y in range(h):
        r = y // sh
        for x in range(w):
            sx = x + (sw // 2 if r % 2 else 0)
            c = (sx // sw) % (w // sw)
            f = 1 + (noise(c, r % (h // sh), 61) - .5) * .26
            ry = y % sh
            f *= 1.06 - ry / sh * .14
            if ry == sh - 1:
                f *= .6
            if sx % sw == 0:
                f *= .8
            px[x, y] = rgb(base, f)
    return grain(img, .02, 62)


# ── Schuppen / Garage ──────────────────────────────────────────────────────
def shed(ground):
    w, h = 48, 40
    base = 0xcdbfa6
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    board = 6
    for y in range(h):
        for x in range(w):
            b = (x // board) % (w // board)
            f = 1 + (noise(b, 0, 71) - .5) * .16
            f *= 1 + (noise(x, y // 5, 72) - .5) * .05  # Maserung in Längsrichtung
            if x % board == 0:
                f *= .72  # Fuge zwischen den Brettern
            px[x, y] = rgb(base, f)
    d = ImageDraw.Draw(img)
    if ground:
        d.rectangle([0, h - 4, w - 1, h - 1], fill=(120, 112, 100))
        # kleines Fenster mit dunklem Rahmen, mittig
        window(d, 16, 9, 16, 14, (92, 76, 58), (92, 120, 138), bars=(1, 0), sill=(92, 76, 58))
    else:
        d.line([(0, h - 1), (w - 1, h - 1)], fill=(150, 138, 118))
    return img


def felt_roof(base=0x7d6a55, w=64, h=64):
    """Dachpappe in Bahnen: Überlappung alle 1 m waagerecht, Nagelreihe darüber."""
    img = Image.new('RGB', (w, h), rgb(base))
    px = img.load()
    for y in range(h):
        ry = y % 16
        for x in range(w):
            f = 1.04 - ry / 16 * .1
            if ry == 15:
                f *= .66
            if ry == 2 and x % 8 == 4:
                f *= .7
            px[x, y] = rgb(base, f)
    return grain(img, .06, 81)


IMAGES = {
    'house': (house(True), house(False), tile_roof(0xb8553a, seed=3)),
    'row': (row(True), row(False), tile_roof(0x9c4a36, seed=5)),
    'hall': (hall(True), hall(False), sheet_roof()),
    'factory': (factory(True), factory(False), shed_roof()),
    'church': (church(True), church(False), slate_roof()),
    'shed': (shed(True), shed(False), felt_roof()),
}


def main():
    for kind, (ground, upper, roof) in IMAGES.items():
        folder = ROOT / kind
        folder.mkdir(parents=True, exist_ok=True)
        ground.save(folder / 'wand-erdgeschoss.png', optimize=True)
        upper.save(folder / 'wand-obergeschoss.png', optimize=True)
        roof.save(folder / 'dach.png', optimize=True)
        print(kind, ground.size, upper.size, roof.size)


if __name__ == '__main__':
    main()
