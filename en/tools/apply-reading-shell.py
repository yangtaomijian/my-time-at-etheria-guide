import html
import unicodedata
#!/usr/bin/env python3
"""Attach the stable KT reading shell to this bounded Quarto preview."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("index", "journey", "quests", "exploration", "equipment", "memories")


def display_len(s):
 s=html.unescape(re.sub('<[^>]+>','',s)).strip()
 return sum(1.65 if unicodedata.east_asian_width(c) in 'WF' else 1 for c in s)
def profile(t):
 hs=re.findall(r'<th\b[^>]*>(.*?)</th>',t,re.S)
 rows=[re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S) for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',t,re.S)]
 rows=[r for r in rows if r]
 if not hs or not rows or any(len(r)!=len(hs) for r in rows):return hs,rows,False,[]
 col=[sorted(display_len(x) for x in c) for c in zip(*rows)]
 metric=[(round(c[int(.8*(len(c)-1))]),round(c[-1])) for c in col]
 n=len(hs)
 compact= (n==2 and sum(x[0] for x in metric)<=118 and max(x[1] for x in metric)<=155) or (n==3 and sum(x[0] for x in metric)<=83 and max(x[1] for x in metric)<=100) or (n==4 and sum(x[0] for x in metric)<=62 and max(x[1] for x in metric)<=62)
 return hs,rows,compact,metric

def wrap_table(match, page):
    table = match[0]
    heads, rows, compact, _ = profile(table)
    sequence_headers = {
        ('顺序', '石块与方向', '站位、滑行与停点'),
        ('顺序', '推哪块、推向哪里', '站位与结果'),
        ('顺序', '推哪块、怎么推', '然后去做什么'),
        ('Step', 'Push', 'Where to stand'),
        ('Step', 'Stone', 'Move and follow up'),
    }
    if tuple(heads) in sequence_headers:
        roles = dict(table='table', thead='rowgroup', tbody='rowgroup', tr='row', th='columnheader', td='cell')
        table = re.sub(r'<(table|thead|tbody|tr|th|td)\b', lambda tag: f'<{tag[1]} role="{roles[tag[1]]}"', table)
        return '<div class="etheria-table etheria-table-sequence">' + table + '</div>'
    # Recipe tables continue to work with the equipment finder in either mode;
    # keep all seven groups as cards so switching category feels consistent.
    if len(heads) == 4 and heads[1] in ('配方位置／顺路时期', 'Recipe location') and heads[2] in ('每件成品的材料', 'Materials per item'):
        compact = False
    if not compact:
        compact_records = ' etheria-exploration-record' if page == 'exploration' else ''
        return '<div class="kt-adaptive-records etheria-table' + compact_records + '">' + table + '</div>'
    numeric = len(heads)==4 and all(all(re.fullmatch(r'[-–—+/%×.0-9\s,]+', html.unescape(re.sub('<[^>]+>','', v))) for v in row[1:]) for row in rows)
    ordinal_headers = {'顺序', '第几次切换', 'Order', 'Light', 'Step'}
    ordinal = len(heads) in (2, 3) and heads[0] in ordinal_headers and all(
        re.fullmatch(r'[1-9][0-9]?', html.unescape(re.sub('<[^>]+>', '', row[0])).strip()) for row in rows
    )
    modifier = (' etheria-table-numeric' if numeric else '') + (f' etheria-table-ordinal etheria-table-ordinal-{len(heads)}' if ordinal else '')
    quest_table_classes = {
        ('材料', '数量', '可沿哪条旅程补齐'): 'materials',
        ('交接站', '在哪里找收信人', '交谈后去哪里'): 'messenger',
        ('当前形态', '会被吸收、为敌人回血的属性', '对应弱点'): 'forms',
        ('Material', 'Amount', 'Where to get it'): 'materials',
        ('Stop', 'Where to look', 'Next stop'): 'messenger',
        ('Form', 'Absorbs', 'Weak to'): 'forms',
    }
    if (quest_table := quest_table_classes.get(tuple(heads))):
        modifier += f' etheria-table-quest-{quest_table}'
    if page == 'exploration':
        exploration_tables = {
            ('顺序', '颜色', '相对位置'): 'water',
            ('Order', 'Color', 'Location'): 'water',
            ('开关', '在哪里找', '怎样连接'): 'fire',
            ('Switch', 'Directions'): 'fire-en',
            ('商品', '每份价格', '买到什么、适合怎样查看'): 'shop',
            ('商品', '每份价格', '买到什么、接下来做什么'): 'shop',
            ('When', 'Item', 'Medals'): 'shop-en',
        }
        if (exploration_table := exploration_tables.get(tuple(heads))):
            modifier += f' etheria-exploration-table-{exploration_table}'
    if page == 'journey':
        mobile_columns = {
            ('Switch', 'How to reach it'): 'switch',
            ('Area', 'Route'): 'area',
            ('What to make', 'Ingredients'): 'recipe',
            ('Position', 'Target color', 'Taps from yellow'): 'torches',
            ('Room', 'Entrance'): 'room',
            ('Block', 'Activation mechanism'): 'block',
            ('Supplies used', 'First battle', 'Second battle', 'Total'): 'supplies',
        }
        if (mobile_profile := mobile_columns.get(tuple(heads))):
            modifier += f' etheria-journey-columns etheria-journey-columns-{mobile_profile}'
            if mobile_profile == 'supplies':
                roles = dict(table='table', thead='rowgroup', tbody='rowgroup', tr='row', th='columnheader', td='cell')
                table = re.sub(r'<(table|thead|tbody|tr|th|td)\b', lambda tag: f'<{tag[1]} role="{roles[tag[1]]}"', table)
    return '<div class="etheria-table etheria-table-compact' + modifier + '">' + table + '</div>'

def once(text, old, new, page):
    if text.count(old) != 1:
        raise ValueError(f"{page}: expected one {old[:60]!r}, found {text.count(old)}")
    return text.replace(old, new, 1)


def enhance(text, page):
    if 'data-etheria-reading-shell="1"' in text:
        return text
    text = once(text, '<body class="', '<body data-etheria-reading-shell="1" class="', page)
    # Ownership changes before Quarto initializes, preventing a cloned margin TOC.
    has_toc = 'id="TOC"' in text
    if has_toc:
        text = once(text, 'id="quarto-margin-sidebar"', 'id="kt-page-toc-panel"', page)
        aside = '<div id="kt-page-toc-panel" class="sidebar margin-sidebar">'
        text = once(text, aside,
            '<div id="kt-page-toc-backdrop" aria-hidden="true"></div>\n' + aside +
            '\n<button id="kt-page-toc-close" type="button" aria-label="Close">Close</button>', page)
        text = once(text, '<nav id="TOC" role="doc-toc" class="toc-active">',
            '<nav id="TOC" role="doc-toc" class="toc-active" aria-label="On this page">', page)
    else:
        text = once(text, 'class="quarto-container ', 'class="etheria-no-toc quarto-container ', page)

    toggler = re.search(r'<button class="navbar-toggler"[^>]*>.*?</button>', text, re.S)
    if not toggler:
        raise ValueError(f"{page}: navbar toggler missing")
    button = toggler[0].replace(' data-bs-toggle="collapse"', '').replace(' data-bs-target="#navbarCollapse"', '')
    button = button.replace(' role="menu"', '').replace('aria-label="Toggle navigation"', 'aria-label="Open navigation"')
    brand = ('<div id="kt-publication-brand"><span class="kt-brand-name">Etheria</span>'
             '<span class="kt-brand-edition">Official FINAL</span></div>')
    text = once(text, toggler[0], button + '\n' + brand, page)
    collapse = '<div class="collapse navbar-collapse" id="navbarCollapse">'
    toolbar = ('<div id="kt-global-nav-toolbar"><span id="kt-global-nav-title">Navigation</span>'
        '<button id="kt-global-nav-close" type="button" aria-label="Close navigation" title="Close navigation">'
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" '
        'stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/>'
        '</svg></button></div>')
    text = once(text, collapse, collapse.replace('id="navbarCollapse"',
        'id="navbarCollapse" role="navigation" aria-label="Navigation"') + toolbar, page)
    end = '</div> <!-- /navcollapse -->'
    text = once(text, end, end + '\n<div id="kt-global-nav-backdrop" aria-hidden="true"></div>', page)
    native = re.search(r'<a\b[^>]*class="quarto-color-scheme-toggle[^>]*>.*?</a>', text, re.S)
    if not native:
        raise ValueError(f"{page}: native appearance toggle missing")
    text = once(text, native[0], '<div id="kt-theme-controls" role="group" aria-label="Appearance">' +
        native[0] + '<button id="kt-theme-auto" type="button" aria-label="Follow system appearance" '
        'title="Follow system appearance" aria-pressed="true">Auto</button></div>', page)
    controls = ''
    if has_toc:
        controls += ('<button id="kt-page-toc-trigger" type="button" aria-controls="kt-page-toc-panel" '
            'aria-expanded="false" aria-label="On this page">Contents</button>')
    controls += ('<button id="kt-search-launcher" type="button" aria-haspopup="dialog" '
        'aria-label="Search" title="Search"><svg class="kt-search-icon" viewBox="0 0 24 24" '
        'width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" '
        'stroke-linecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.5"/>'
        '<path d="m16 16 4.25 4.25"/></svg></button>')
    text = once(text, '<div class="quarto-navbar-tools">', '<div class="quarto-navbar-tools">' + controls, page)

    title_block = re.search(r'<header id="title-block-header"[^>]*>.*?</header>', text, re.S)
    if not title_block:
        raise ValueError(f"{page}: title block missing")
    title = re.search(r'<h1\b[^>]*>(.*?)</h1>', title_block[0], re.S)
    if not title:
        raise ValueError(f"{page}: title missing")
    subtitle = re.search(r'<p class="subtitle">(.*?)</p>', title_block[0], re.S)
    crumb = ('<nav class="kt-page-breadcrumb" aria-label="Breadcrumb"><ol>'
        '<li><a href="index.html">Guide home</a></li>'
        f'<li aria-current="page">{title[1]}</li></ol></nav>') if page != 'index' else ''
    # Keep the authored body and anchors; only the title wrapper changes.
    header = ('<header id="title-block-header" class="quarto-title-block"></header>\n'
        '<section class="level1 kt-ordinary-page">' + crumb + '<h1>' + title[1] + '</h1>')
    if subtitle:
        header += '<p>' + subtitle[1] + '</p>'
    text = once(text, title_block[0], header, page)
    text = once(text, '</main> <!-- /main -->', '</section>\n</main> <!-- /main -->', page)
    text = re.sub(r'(<table class="[^"]*\btable\b[^"]*">.*?</table>)',
        lambda match: wrap_table(match, page), text, flags=re.S)
    for stylesheet in ('assets/architecture.css', 'assets/shared/kt-components.css'):
        version = hashlib.sha256((ROOT / stylesheet).read_bytes()).hexdigest()[:12]
        text = once(text, f'href="{stylesheet}"', f'href="{stylesheet}?v={version}"', page)
    # Match complete link-only rows, never paragraphs that just contain links.
    nav_link = r'<a\b[^>]*>[^<]+</a>'
    text = re.sub(r'<p>(\s*' + nav_link + r'(?:\s*·\s*' + nav_link + r')+\s*)</p>',
                  r'<p class="etheria-inline-links">\1</p>', text)
    # Same native TOC, drawer and appearance behavior as the ordinary KT pages.
    scripts = ['kt-theme.js', 'kt-page-toc.js', 'kt-global-nav.js', 'kt-mobile-header.js', 'kt-adaptive-tables.js']
    stage_script = ''
    if page == 'journey':
        stage_version = hashlib.sha256((ROOT / 'assets/journey-stages.js').read_bytes()).hexdigest()[:12]
        stage_script = f'\n<script src="assets/journey-stages.js?v={stage_version}"></script>'
    finder_script = ''
    module_name = {'equipment': 'body-finders', 'exploration': 'exploration-cards'}.get(page)
    if module_name:
        style = 'equipment-details' if page == 'equipment' else 'guide-content-cards'
        stylesheet = f'<link rel="stylesheet" href="assets/body-finders.css">\n<link rel="stylesheet" href="assets/{style}.css">\n'
        text = once(text, '</head>', stylesheet + '</head>', page)
        version = hashlib.sha256((ROOT / f'assets/{module_name}.js').read_bytes()).hexdigest()[:12]
        finder_script += f'<script src="assets/{module_name}.js?v={version}"></script>\n'
    if page == 'quests':
        text = once(text, '</head>', '<link rel="stylesheet" href="assets/guide-content-cards.css">\n</head>', page)
    if page == 'quests':
        details_version = hashlib.sha256((ROOT / 'assets/quest-details.js').read_bytes()).hexdigest()[:12]
        finder_script += f'<script src="assets/quest-details.js?v={details_version}"></script>\n'
    text = once(text, '</body>', finder_script + '\n'.join(
        f'<script src="assets/shared/{name}"></script>' for name in scripts) +
        stage_script + '\n<script src="assets/reading-shell.js"></script>\n</body>', page)
    return text



if __name__ == '__main__':
    for name in PAGES:
        path = ROOT / '_site' / f'{name}.html'
        path.write_text(enhance(path.read_text(), name))
    print(f'Etheria reading shell: {len(PAGES)} pages')
