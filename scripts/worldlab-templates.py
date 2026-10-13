#!/usr/bin/env python3
"""Erzeugt die Zeichenvorlagen für den Baukasten der Erdkarte (Prototyp „eine Welt“).

Aufruf: python3 scripts/worldlab-templates.py
Ergebnis: public/worldlab/vorlagen/<art>/{wand-erdgeschoss,wand-obergeschoss,dach}.png

Die Vorlagen haben schon das richtige Format (16 Pixel je Meter, ein Geschoss
hoch, ein Wandabschnitt breit). Sie zeigen ein Meterraster und Platzhalter für
Fenster, Tür und Sockel. Zum Zeichnen eine Vorlage kopieren, übermalen und nach
public/worldlab/blocks/<art>/ legen. Maße müssen zu lib/worldlab/blocks.ts passen.
"""
from pathlib import Path
from PIL import Image, ImageDraw

PX = 16  # Pixel je Meter
ROOT = Path(__file__).resolve().parent.parent / 'public' / 'worldlab' / 'vorlagen'

# Blockart: Geschosshöhe (m), Abschnittsbreite (m), Wandfarbe, Dachfarbe – wie in blocks.ts
KINDS = {
    'house':  (3.0, 3, 0xf4ead6, 0xb8553a),
    'row':    (3.0, 3, 0xefe6d8, 0x9c4a36),
    'hall':   (4.0, 6, 0xd9dee0, 0x8d979c),
    'factory': (5.0, 6, 0xc9d0d4, 0x7a8288),
    'church': (3.5, 4, 0xe9e2d2, 0x5f6e7a),
    'shed':   (2.5, 3, 0xcdbfa6, 0x7d6a55),
}


def rgb(color, factor=1.0):
    return tuple(min(255, round(((color >> s) & 255) * factor)) for s in (16, 8, 0))


def grid(draw, w, h, color):
    for x in range(0, w, PX):
        draw.line([(x, 0), (x, h - 1)], fill=color)
    for y in range(h - 1, -1, -PX):
        draw.line([(0, y), (w - 1, y)], fill=color)


def wall(kind, storey_m, bay_m, wall_color, ground):
    w, h = round(bay_m * PX), round(storey_m * PX)
    img = Image.new('RGB', (w, h), rgb(wall_color))
    d = ImageDraw.Draw(img)
    grid(d, w, h, rgb(wall_color, 0.93))
    cx = w // 2
    if ground:
        # Sockel 0,5 m
        d.rectangle([0, h - PX // 2, w - 1, h - 1], fill=rgb(wall_color, 0.78))
    if kind == 'hall':
        if ground:
            # Tor 4 m breit, 3 m hoch (über dem Sockel)
            d.rectangle([cx - 2 * PX, h - round(3.5 * PX), cx + 2 * PX - 1, h - PX // 2 - 1], fill=rgb(wall_color, 0.7), outline=(70, 80, 90))
        else:
            # Fensterband 1 m hoch, 1 m unter der Oberkante, bis auf 0,5 m Rand
            d.rectangle([PX // 2, PX, w - 1 - PX // 2, 2 * PX], fill=(120, 150, 170), outline=(70, 80, 90))
    else:
        win_w, win_h = round(1.2 * PX), round(1.4 * PX)
        top = round(0.7 * PX)
        if ground and kind != 'shed':
            # Tür 1 m × 2,2 m statt Fenster – wiederholt sich mit jedem Abschnitt;
            # wer keine Tür in jedem Abschnitt will, zeichnet hier ein Fenster.
            d.rectangle([cx - PX // 2, h - round(2.2 * PX) - PX // 2, cx + PX // 2 - 1, h - PX // 2 - 1], fill=rgb(wall_color, 0.55), outline=(70, 60, 50))
        else:
            d.rectangle([cx - win_w // 2, top, cx + win_w // 2 - 1, top + win_h], fill=(120, 150, 170), outline=(70, 60, 50))
    # Abschnittsgrenze markieren: Wo das Bild aneinanderstößt
    d.line([(0, 0), (0, h - 1)], fill=rgb(wall_color, 0.8))
    d.line([(0, 0), (w - 1, 0)], fill=rgb(wall_color, 0.8))
    return img


def factory_wall(storey_m, bay_m, wall_color, ground):
    """Wellblech mit senkrechten Sicken, Fensterband oben, im Erdgeschoss ein Rolltor."""
    w, h = round(bay_m * PX), round(storey_m * PX)
    img = Image.new('RGB', (w, h), rgb(wall_color))
    d = ImageDraw.Draw(img)
    for x in range(0, w, 4):  # Sicken alle 25 cm
        d.line([(x, 0), (x, h - 1)], fill=rgb(wall_color, 0.88))
        d.line([(x + 1, 0), (x + 1, h - 1)], fill=rgb(wall_color, 1.06))
    # Fensterband: 1,25 m hoch, 0,5 m unter der Oberkante, durchgehend (nahtlos)
    top = PX // 2
    d.rectangle([0, top, w - 1, top + round(1.25 * PX)], fill=(118, 146, 164))
    for x in range(0, w, PX):
        d.line([(x, top), (x, top + round(1.25 * PX))], fill=(70, 80, 90))
    d.line([(0, top), (w - 1, top)], fill=(70, 80, 90))
    d.line([(0, top + round(1.25 * PX)), (w - 1, top + round(1.25 * PX))], fill=(70, 80, 90))
    if ground:
        # Rolltor 4 m breit, 3 m hoch, mit Lamellen; Sockel 0,5 m
        cx = w // 2
        d.rectangle([0, h - PX // 2, w - 1, h - 1], fill=rgb(wall_color, 0.72))
        gx0, gx1, gy0 = cx - 2 * PX, cx + 2 * PX - 1, h - 3 * PX
        d.rectangle([gx0, gy0, gx1, h - 1], fill=(148, 154, 158), outline=(70, 80, 90))
        for y in range(gy0 + 3, h - 1, 3):
            d.line([(gx0 + 1, y), (gx1 - 1, y)], fill=(122, 128, 132))
    return img


def factory_roof(roof_color):
    """Sheddach von oben: alle 4 m eine Reihe Oberlichter, dazwischen die geneigte Dachfläche."""
    size = 4 * PX
    img = Image.new('RGB', (size, size), rgb(roof_color))
    d = ImageDraw.Draw(img)
    glass = round(0.9 * PX)
    for y in range(size):
        if y < glass:
            # Oberlicht (Glas, zum First hin heller)
            d.line([(0, y), (size - 1, y)], fill=(150 + y, 176 + y, 190 + y // 2))
        else:
            # Dachfläche: vom First (hell) zur Kehle (dunkel)
            t = (y - glass) / (size - glass)
            d.line([(0, y), (size - 1, y)], fill=rgb(roof_color, 1.12 - 0.32 * t))
    d.line([(0, glass), (size - 1, glass)], fill=rgb(roof_color, 0.6))
    d.line([(0, size - 1), (size - 1, size - 1)], fill=rgb(roof_color, 0.55))
    for x in range(0, size, PX // 2):  # Sprossen der Oberlichter
        d.line([(x, 0), (x, glass - 1)], fill=(90, 104, 114))
    return img


def roof(roof_color):
    size = 4 * PX
    img = Image.new('RGB', (size, size), rgb(roof_color))
    d = ImageDraw.Draw(img)
    # Ziegelreihen alle 0,5 m, Ziegel 0,5 m breit, versetzt
    for row, y in enumerate(range(0, size, PX // 2)):
        d.line([(0, y), (size - 1, y)], fill=rgb(roof_color, 0.75))
        offset = (row % 2) * PX // 4
        for x in range(offset, size, PX // 2):
            d.line([(x, y), (x, y + PX // 2 - 1)], fill=rgb(roof_color, 0.85))
    return img


def main():
    for kind, (storey_m, bay_m, wall_color, roof_color) in KINDS.items():
        out = ROOT / kind
        out.mkdir(parents=True, exist_ok=True)
        if kind == 'factory':
            factory_wall(storey_m, bay_m, wall_color, True).save(out / 'wand-erdgeschoss.png')
            factory_wall(storey_m, bay_m, wall_color, False).save(out / 'wand-obergeschoss.png')
            factory_roof(roof_color).save(out / 'dach.png')
        else:
            wall(kind, storey_m, bay_m, wall_color, True).save(out / 'wand-erdgeschoss.png')
            wall(kind, storey_m, bay_m, wall_color, False).save(out / 'wand-obergeschoss.png')
            roof(roof_color).save(out / 'dach.png')
        print(kind, f'{round(bay_m * PX)} × {round(storey_m * PX)} px Wand, 64 × 64 px Dach')


if __name__ == '__main__':
    main()
