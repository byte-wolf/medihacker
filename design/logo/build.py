# Generates the DOKuTOR logo concepts (SVG) and a preview page.
# Text is drawn with textLength so letter positions do not depend on the installed font.
import pathlib

BLUE = "#0f62fe"
BLUE_LIGHT = "#d0e2ff"
RED = "#da1e28"
GREY = "#8d8d8d"
FONT = "font-family=\"'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif\""
INK = "currentColor"

def word(x, y, text, length, size=96, weight=600, fill=INK, extra=""):
    return f'<text x="{x}" y="{y}" {FONT} font-size="{size}" font-weight="{weight}" fill="{fill}" textLength="{length}" lengthAdjust="spacingAndGlyphs" {extra}>{text}</text>'

def svg(w, h, body, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'

logos = {}

# 1 – Stethoscope "u": the lower-case u is the stethoscope tube, with ear tips and a chest piece.
logos["1-stethoscope-u"] = ("Stethoscope u", "The lower-case u of DOKuTOR is a stethoscope.", svg(600, 180, f'''
  {word(20, 118, "DOK", 186)}
  <g fill="none" stroke="{BLUE}" stroke-width="13" stroke-linecap="round">
    <path d="M226 46 V88 a34 34 0 0 0 68 0 V46"/>
    <path d="M260 122 C260 150 292 156 304 140"/>
  </g>
  <circle cx="226" cy="40" r="8" fill="{BLUE}"/>
  <circle cx="294" cy="40" r="8" fill="{BLUE}"/>
  <circle cx="311" cy="132" r="15" fill="{BLUE}"/>
  <circle cx="311" cy="132" r="6" fill="#fff"/>
  {word(330, 118, "TOR", 196)}
''', "DOKuTOR"))

# 2 – Document doctor: a page with a folded corner, a medical cross and one highlighted source line.
icon2 = f'''
  <path d="M20 18 h70 l30 30 v104 a8 8 0 0 1 -8 8 h-92 a8 8 0 0 1 -8 -8 v-126 a8 8 0 0 1 8 -8 z" fill="{BLUE}"/>
  <path d="M90 18 v22 a8 8 0 0 0 8 8 h22 z" fill="{BLUE_LIGHT}"/>
  <path d="M52 52 h16 v16 h16 v16 h-16 v16 h-16 v-16 h-16 v-16 h16 z" fill="#fff"/>
  <rect x="28" y="116" width="76" height="8" rx="4" fill="#fff" opacity=".55"/>
  <rect x="28" y="132" width="52" height="10" rx="5" fill="#ffd94d"/>
'''
logos["2-document-doctor"] = ("Document doctor", "A patient document with a medical cross and one highlighted line: every fact links to its source.", svg(640, 180, f'''
  {icon2}
  {word(150, 118, "DOK", 176)}
  {word(330, 118, "u", 52, fill=BLUE)}
  {word(386, 118, "TOR", 196)}
''', "DOKuTOR"))

# 3 – Highlighted cross: lines of text where the highlighted pieces form a medical cross.
cells = []
for row in range(5):
    for col in range(5):
        x, y = 16 + col * 26, 22 + row * 26
        on = (row == 2) or (col == 2)
        cells.append(f'<rect x="{x}" y="{y}" width="22" height="12" rx="6" fill="{BLUE if on else "#c6c6c6"}"/>')
logos["3-highlight-cross"] = ("Highlighted cross", "Lines of a document; the highlighted pieces form a medical cross.", svg(620, 180, f'''
  {"".join(cells)}
  {word(170, 118, "DOK", 176)}
  {word(350, 118, "u", 52, weight=400, fill=BLUE)}
  {word(406, 118, "TOR", 196)}
''', "DOKuTOR"))

# 4 – DOK or DOC: the K and the C stand on top of each other – German and English in one word.
logos["4-dok-doc"] = ("DOK or DOC", "K for German, C for English: both readings in one word.", svg(640, 200, f'''
  {word(20, 132, "DO", 124)}
  {word(150, 92, "K", 46, size=58, fill=BLUE)}
  <line x1="148" y1="104" x2="200" y2="104" stroke="{GREY}" stroke-width="3" stroke-dasharray="4 5"/>
  {word(150, 152, "C", 46, size=58, fill=RED)}
  {word(210, 132, "u", 56, weight=400)}
  {word(270, 132, "TOR", 196)}
  <text x="20" y="184" {FONT} font-size="20" fill="{GREY}" letter-spacing="2">DOKTOR · DOCTOR · DOCUMENTS</text>
''', "DOKuTOR"))

# 5 – Ask the doc: a speech bubble with a cross – the question bar is the main feature.
logos["5-ask-bubble"] = ("Ask the doc", "A speech bubble with a medical cross: ask a question, get a sourced answer.", svg(640, 180, f'''
  <path d="M18 30 a18 18 0 0 1 18 -18 h96 a18 18 0 0 1 18 18 v70 a18 18 0 0 1 -18 18 h-58 l-28 26 v-26 h-10 a18 18 0 0 1 -18 -18 z" fill="{BLUE}"/>
  <path d="M74 36 h16 v16 h16 v16 h-16 v16 h-16 v-16 h-16 v-16 h16 z" fill="#fff"/>
  {word(170, 118, "DOK", 176)}
  {word(350, 118, "u", 52, fill=BLUE)}
  {word(406, 118, "TOR", 196)}
''', "DOKuTOR"))

# 6 – Mascot: a friendly document wearing round glasses and a stethoscope.
logos["6-mascot"] = ("Dr. Document mascot", "A friendly patient document with glasses and a stethoscope, for the login page or the video.", svg(660, 200, f'''
  <path d="M30 14 h78 l34 34 v128 a10 10 0 0 1 -10 10 h-102 a10 10 0 0 1 -10 -10 v-152 a10 10 0 0 1 10 -10 z" fill="#fff" stroke="#161616" stroke-width="6" stroke-linejoin="round"/>
  <path d="M108 14 v24 a10 10 0 0 0 10 10 h24" fill="none" stroke="#161616" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="58" cy="78" r="15" fill="none" stroke="#161616" stroke-width="5"/>
  <circle cx="98" cy="78" r="15" fill="none" stroke="#161616" stroke-width="5"/>
  <line x1="73" y1="78" x2="83" y2="78" stroke="#161616" stroke-width="5"/>
  <circle cx="58" cy="80" r="4" fill="#161616"/><circle cx="98" cy="80" r="4" fill="#161616"/>
  <path d="M62 106 q16 14 32 0" fill="none" stroke="#161616" stroke-width="5" stroke-linecap="round"/>
  <path d="M40 124 q38 44 76 0" fill="none" stroke="{BLUE}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="78" cy="160" r="11" fill="{BLUE}"/><circle cx="78" cy="160" r="4" fill="#fff"/>
  {word(180, 128, "DOK", 176)}
  {word(360, 128, "u", 52, fill=BLUE)}
  {word(416, 128, "TOR", 196)}
''', "DOKuTOR"))

out = pathlib.Path(__file__).parent
cards = []
for slug, (name, note, markup) in logos.items():
    (out / f"{slug}.svg").write_text(markup.replace("currentColor", "#161616"))
    cards.append(f'''<figure class="card"><div class="stage light">{markup}</div><div class="stage dark">{markup}</div>
<figcaption><strong>{name}</strong> – {note}<br><code>design/logo/{slug}.svg</code></figcaption></figure>''')

(out / "index.html").write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DOKuTOR logo concepts</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  body {{ margin: 0; padding: 24px 16px 48px; font-family: 'IBM Plex Sans', Arial, sans-serif; background: #f4f4f4; color: #161616; }}
  h1 {{ font-weight: 400; margin: 0 0 4px; }} p.lead {{ margin: 0 0 24px; color: #525252; }}
  .grid {{ display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); }}
  .card {{ margin: 0; background: #fff; border: 1px solid #e0e0e0; }}
  .stage {{ padding: 20px; display: flex; justify-content: center; }}
  .stage svg {{ width: 100%; height: auto; max-height: 150px; }}
  .light {{ background: #fff; color: #161616; }} .dark {{ background: #161616; color: #f4f4f4; }}
  figcaption {{ padding: 12px 16px 16px; font-size: 14px; line-height: 1.45; color: #393939; border-top: 1px solid #e0e0e0; }}
  code {{ font-size: 12px; color: #6f6f6f; }}
</style></head>
<body><h1>DOKuTOR – logo concepts</h1>
<p class="lead">Six simple directions, each on light and dark. Not used in the app yet.</p>
<div class="grid">{"".join(cards)}</div></body></html>
''')
print("written", len(logos), "logos")
