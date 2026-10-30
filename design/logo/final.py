# DOKuTOR "stethoscope u" logo, final versions.
# Every letter is drawn as a stroked path on one grid, so the logo looks the same
# everywhere and needs no font. Run: python3 final.py
import pathlib

BLUE = "#0f62fe"
INK = "currentColor"
W = 16  # stroke width of every letter and of the stethoscope ear piece
TUBE = 8  # the thinner tube down to the chest piece
CAP_TOP, BASE = 48, 112  # centre lines; with the stroke the letters span 40..120


def letters(ink: str, accent: str) -> str:
    s = f'stroke-width="{W}" fill="none"'
    return f'''
  <g stroke="{ink}" {s} stroke-linejoin="miter">
    <path d="M28 {CAP_TOP} V{BASE} H50 A32 32 0 0 0 50 {CAP_TOP} Z"/>
    <ellipse cx="144" cy="80" rx="30" ry="32"/>
    <path d="M208 40 V120 M252 {CAP_TOP} L214 82 L254 {BASE + 8}" stroke-linecap="butt"/>
    <path d="M366 {CAP_TOP} H426 M396 {CAP_TOP} V120"/>
    <ellipse cx="482" cy="80" rx="30" ry="32"/>
    <path d="M546 120 V{CAP_TOP} H570 A16 16 0 0 1 570 80 H546 M564 80 L592 120"/>
  </g>
  {stethoscope_u(280, accent)}
'''


def stethoscope_u(x: int, color: str) -> str:
    """Lower-case u as a stethoscope: two ear tips, the tube, and a chest piece below the baseline."""
    r = 26
    return f'''<g stroke="{color}" stroke-width="{W}" fill="none" stroke-linecap="round">
    <path d="M{x} 62 V{BASE - r} A{r} {r} 0 0 0 {x + 2 * r} {BASE - r} V62"/>
  </g>
  <g stroke="{color}" stroke-width="{TUBE}" fill="none" stroke-linecap="round">
    <path d="M{x + r} {BASE + 2} C{x + r - 2} 130 {x + 6} 132 {x + 8} 148 S{x + 30} 174 {x + 50} 160 S{x + 74} 144 {x + 89} 159"/>
  </g>
  <circle cx="{x}" cy="54" r="9" fill="{color}"/>
  <circle cx="{x + 2 * r}" cy="54" r="9" fill="{color}"/>
  <circle cx="{x + 96}" cy="166" r="11" fill="none" stroke="{color}" stroke-width="{TUBE}"/>'''


def svg(w: int, h: int, body: str, title: str = "DOKuTOR") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def icon(size: int = 512, bg: str = BLUE, fg: str = "#fff", radius: int = 112) -> str:
    """App icon: the stethoscope u alone, centred on a rounded square."""
    u = stethoscope_u(0, fg)
    # The u with its tube spans about x -9..111 and y 45..181; scale it to fill the square.
    return svg(
        size,
        size,
        f'<rect width="{size}" height="{size}" rx="{radius}" fill="{bg}"/>'
        f'<g transform="translate({size * 0.5 - 51 * 2.8} {size * 0.5 - 113 * 2.8}) scale(2.8)">{u}</g>',
        "DOKuTOR icon",
    )


out = pathlib.Path(__file__).parent / "final"
out.mkdir(exist_ok=True)
files = {
    "dokutor-wordmark.svg": svg(620, 200, letters("#161616", BLUE)),
    "dokutor-wordmark-on-dark.svg": svg(620, 200, letters("#f4f4f4", "#78a9ff")),
    "dokutor-wordmark-mono.svg": svg(620, 200, letters(INK, INK)),
    "dokutor-icon.svg": icon(),
    "dokutor-icon-on-white.svg": icon(bg="#fff", fg=BLUE),
}
for name, markup in files.items():
    (out / name).write_text(markup)

# Preview at the sizes the app will use.
inline = {k: v.replace("<svg ", '<svg style="width:100%;height:auto" ', 1) for k, v in files.items()}
(out / "preview.html").write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DOKuTOR logo</title>
<style>
  body {{ margin: 0; padding: 24px 16px 48px; font-family: 'IBM Plex Sans', Arial, sans-serif; background: #f4f4f4; color: #161616; }}
  h1 {{ font-weight: 400; margin: 0 0 20px; }} h2 {{ font-size: 15px; margin: 28px 0 10px; }}
  .row {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }}
  .box {{ padding: 24px; background: #fff; border: 1px solid #e0e0e0; }} .dark {{ background: #161616; border-color: #161616; }}
  .big {{ width: min(100%, 560px); }} .header {{ display: flex; align-items: center; height: 48px; padding: 0 16px; background: #fff; border-bottom: 1px solid #e0e0e0; width: min(100%, 560px); }}
  .header .mark {{ height: 22px; width: auto; }} .ico {{ display: inline-block; }}
  code {{ font-size: 12px; color: #6f6f6f; }}
</style></head><body>
<h1>DOKuTOR – stethoscope u</h1>
<h2>Wordmark</h2>
<div class="row"><div class="box big">{inline["dokutor-wordmark.svg"]}</div><div class="box dark big">{inline["dokutor-wordmark-on-dark.svg"]}</div></div>
<h2>In the app header (22 px high)</h2>
<div class="header">{files["dokutor-wordmark.svg"].replace("<svg ", '<svg class="mark" style="height:22px;width:auto" ', 1)}</div>
<h2>App icon and favicon sizes</h2>
<div class="row">
  <div class="ico" style="width:128px">{inline["dokutor-icon.svg"]}</div>
  <div class="ico" style="width:64px">{inline["dokutor-icon.svg"]}</div>
  <div class="ico" style="width:32px">{inline["dokutor-icon.svg"]}</div>
  <div class="ico" style="width:16px">{inline["dokutor-icon.svg"]}</div>
  <div class="ico" style="width:64px">{inline["dokutor-icon-on-white.svg"]}</div>
</div>
<h2>Single colour (follows the text colour)</h2>
<div class="row"><div class="box big" style="color:#161616">{inline["dokutor-wordmark-mono.svg"]}</div><div class="box dark big" style="color:#f4f4f4">{inline["dokutor-wordmark-mono.svg"]}</div></div>
<p><code>design/logo/final/</code>: {", ".join(files)}</p>
</body></html>
''')
print("written", ", ".join(files))
