"""Install the production Etheria discussion consumer after publication metadata."""
from pathlib import Path
import re
import os

if os.environ.get("ETHERIA_DISCUSSION_ENABLED") != "1":
    print("Etheria discussions disabled; no comment markup injected.")
    raise SystemExit(0)
sitekey = os.environ.get("ETHERIA_DISCUSSION_TURNSTILE_SITEKEY", "")
if not re.fullmatch(r"0x[A-Za-z0-9]{18,60}", sitekey) or sitekey.startswith(("0x4AAAAABUILDQA", "0xTEST")):
    raise SystemExit("Etheria discussions require the approved Etheria Turnstile public sitekey.")
config = f'<meta name="etheria-discussion-sitekey" content="{sitekey}">\n'

checked = 0
for locale, root in [('zh-CN', Path('public')), ('en', Path('public/en'))]:
    names = ['journey', 'quests', 'exploration', 'equipment', 'memories']
    if locale == 'zh-CN':
        names.append('gm-differences')
    for slug in names:
        page = root / (slug + '.html')
        html = page.read_text()
        assert html.count('</head>') == html.count('</body>') == 1
        assert '<meta name="etheria-discussion-sitekey"' not in html
        head = config
        head += '<link rel="stylesheet" href="./assets/discussion/style.css">\n'
        footer = ''.join(f'<script src="./assets/discussion/{name}.js"></script>\n'
                         for name in ('transport','runtime','ui'))
        page.write_text(html.replace('</head>', head + '</head>').replace('</body>',footer + '</body>'))
        checked += 1
    assert not any('etheria-discussion-sitekey' in p.read_text() for p in root.glob('*.html') if p.stem not in names)
assert checked == 11
print('Etheria comment component: 6 Chinese + 5 English body pages, no home mounts.')

for language, root in [('zh-Hans', Path('public')), ('en', Path('public/en'))]:
    chinese = language == 'zh-Hans'
    title, back, about = ('全站讨论', '攻略首页', '查看各攻略页的最新讨论。') if chinese else (
        'Guide discussions', 'Guide home', 'Recent discussions across the guide.')
    entry = '查看全站讨论' if chinese else 'View all discussions'
    invitation = '攻略有误或想补充，欢迎留言。' if chinese else 'Found a mistake or have something to add? Leave a comment.'
    homepage = root / 'index.html'
    home = homepage.read_text()
    assert home.count('</main>') == home.count('</body>') == 1
    hub_boot = '<script src="./assets/discussion/transport.js"></script>\n<script src="./assets/discussion/hub.js"></script>\n'
    homepage.write_text(home.replace('</head>', config + '</head>').replace('</main>', f'<p data-etheria-hub-link hidden><a href="./discussions.html">{entry}</a> · {invitation}</p>\n</main>')
                            .replace('</body>', hub_boot + '</body>'))
    # Use the same full reading shell as the home page, without its article or SEO
    # metadata. Keeping it outside Quarto's render set excludes the hub from search.
    lead = f'''<section class="level1 kt-ordinary-page etheria-discussion-hub" data-etheria-hub>
<nav aria-label="{back}" class="etheria-hub-breadcrumb"><a href="./">{back}</a></nav>
<h1>{title}</h1>
<p class="etheria-hub-lead">{about}</p>
<p role="status" class="etheria-hub-status"></p><ol></ol><button type="button" class="btn btn-outline-secondary" hidden></button>
</section>
'''
    hub, changed = re.subn(r'(<main[^>]+id="quarto-document-content"[^>]*>)[\s\S]*?</main>',
                           lambda match: match[1] + '\n' + lead + '</main>', home)
    assert changed == 1
    hub = hub.replace('<a class="nav-link active" href="./index.html" aria-current="page">', '<a class="nav-link" href="./index.html">')
    hub = re.sub(r'<title>.*?</title>', f'<title>{title} | My Time at Etheria</title>', hub, count=1)
    hub = re.sub(r'(?m)^<(?:link rel="canonical"|meta (?:property="og:[^"]+"|name="(?:description|twitter:[^"]+)"))[^>]*>\n', '', hub)
    hub = hub.replace('</head>', config + '<meta name="robots" content="noindex,nofollow">\n<link rel="stylesheet" href="./assets/discussion/hub.css">\n</head>')
    hub = hub.replace('</body>', hub_boot + '</body>')
    assert '<link rel="canonical"' not in hub and 'og:title' not in hub
    (root / 'discussions.html').write_text(hub)
print('Etheria discussion hubs: Chinese and English, production HTTPS only, no search indexing.')
