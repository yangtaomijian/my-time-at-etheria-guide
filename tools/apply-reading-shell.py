import html
import unicodedata
#!/usr/bin/env python3
"""Attach the stable KT reading shell to this bounded Quarto preview."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("index", "journey", "quests", "exploration", "equipment", "memories", "gm-differences")


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
    if tuple(heads) == ('从哪里出发', '选哪个出口', '到哪里、可以做什么'):
        modifier += ' etheria-table-cave-branches'
    if tuple(heads) == ('大厅出口', '房内要做什么', '回来后接哪里'):
        modifier += ' etheria-table-fortress-exits'
    if tuple(heads) == ('选择', '接下来发生什么'):
        modifier += ' etheria-table-save-choice'
    if tuple(heads) == ('想做什么', '操作与提示'):
        modifier += ' etheria-table-assist-controls'
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
    if page == 'equipment' and tuple(heads) == ('准备升级的目标', '会消耗的旧武器', '需要注意的事项'):
        modifier += ' etheria-table-upgrade-notes'
    if page == 'exploration':
        exploration_tables = {
            ('顺序', '颜色', '相对位置'): 'water',
            ('Order', 'Color', 'Location'): 'water',
            ('开关', '在哪里找', '怎样连接'): 'fire',
            ('商品', '每份价格', '买到什么、适合怎样查看'): 'shop',
            ('商品', '每份价格', '买到什么、接下来做什么'): 'shop',
            ('When', 'Item', 'Medals'): 'shop-en',
        }
        if (exploration_table := exploration_tables.get(tuple(heads))):
            modifier += f' etheria-exploration-table-{exploration_table}'
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
            '\n<button id="kt-page-toc-close" type="button" aria-label="关闭">关闭</button>', page)
        text = once(text, '<nav id="TOC" role="doc-toc" class="toc-active">',
            '<nav id="TOC" role="doc-toc" class="toc-active" aria-label="本页目录">', page)
    else:
        text = once(text, 'class="quarto-container ', 'class="etheria-no-toc quarto-container ', page)

    toggler = re.search(r'<button class="navbar-toggler"[^>]*>.*?</button>', text, re.S)
    if not toggler:
        raise ValueError(f"{page}: navbar toggler missing")
    button = toggler[0].replace(' data-bs-toggle="collapse"', '').replace(' data-bs-target="#navbarCollapse"', '')
    button = button.replace(' role="menu"', '').replace('aria-label="展开或折叠导航栏"', 'aria-label="打开导航"')
    brand = ('<div id="kt-publication-brand"><span class="kt-brand-name">Etheria</span>'
             '<span class="kt-brand-edition">攻略 · 全汉化版</span></div>')
    text = once(text, toggler[0], button + '\n' + brand, page)
    collapse = '<div class="collapse navbar-collapse" id="navbarCollapse">'
    toolbar = ('<div id="kt-global-nav-toolbar"><span id="kt-global-nav-title">导航</span>'
        '<button id="kt-global-nav-close" type="button" aria-label="关闭导航" title="关闭导航">'
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" '
        'stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/>'
        '</svg></button></div>')
    text = once(text, collapse, collapse.replace('id="navbarCollapse"',
        'id="navbarCollapse" role="navigation" aria-label="导航"') + toolbar, page)
    end = '</div> <!-- /navcollapse -->'
    text = once(text, end, end + '\n<div id="kt-global-nav-backdrop" aria-hidden="true"></div>', page)
    native = re.search(r'<a\b[^>]*class="quarto-color-scheme-toggle[^>]*>.*?</a>', text, re.S)
    if not native:
        raise ValueError(f"{page}: native appearance toggle missing")
    text = once(text, native[0], '<div id="kt-theme-controls" role="group" aria-label="外观">' +
        native[0] + '<button id="kt-theme-auto" type="button" aria-label="跟随系统外观" '
        'title="跟随系统外观" aria-pressed="true">自动</button></div>', page)
    controls = ''
    if has_toc:
        controls += ('<button id="kt-page-toc-trigger" type="button" aria-controls="kt-page-toc-panel" '
            'aria-expanded="false" aria-label="本页目录">本页</button>')
    controls += ('<button id="kt-search-launcher" type="button" aria-haspopup="dialog" '
        'aria-label="搜索" title="搜索"><svg class="kt-search-icon" viewBox="0 0 24 24" '
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
    crumb = ('<nav class="kt-page-breadcrumb" aria-label="路径导航"><ol>'
        '<li><a href="index.html">攻略总览</a></li>'
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
    page_finders = {'equipment': 'body-finders', 'quests': 'quest-stage-cards', 'exploration': 'exploration-cards'}
    if page in page_finders:
        finder = page_finders[page]
        style_names = ('body-finders', 'equipment-details' if page == 'equipment' else 'guide-content-cards')
        styles = ''
        for name in style_names:
            asset = ROOT / f'assets/{name}.css'
            version = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
            styles += f'<link rel="stylesheet" href="assets/{name}.css?v={version}">\n'
        text = once(text, '</head>', styles + '</head>', page)
        # Index the original cells before adaptive mode adds mobile labels to them.
        asset = ROOT / f'assets/{finder}.js'
        version = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        finder_script = f'<script src="assets/{finder}.js?v={version}"></script>\n'
    if page == 'quests':
        details_version = hashlib.sha256((ROOT / 'assets/quest-details.js').read_bytes()).hexdigest()[:12]
        finder_script += f'<script src="assets/quest-details.js?v={details_version}"></script>\n'
    text = once(text, '</body>', finder_script + '\n'.join(
        f'<script src="assets/shared/{name}"></script>' for name in scripts) +
        stage_script + '\n<script src="assets/reading-shell.js"></script>\n</body>', page)
    return text


def add_search_aliases():
    """Route real player wording to the relevant passage, without replacing Quarto search."""
    built = ROOT / '_site'
    index = built / 'search.json'
    records = {entry['href']: entry for entry in json.loads(index.read_text())}
    titles = {
        'journey': '主线与解谜', 'quests': '支线任务', 'equipment': '装备与合成',
        'exploration': '探索与竞技场', 'memories': '剧情与回忆',
        'gm-differences': '版本与《女王驾到》',
    }
    aliases = (
        ('journey', 'lemuria-next', '拿到蓝色房屋钥匙后：大厅找克莱德 · Q6 → Q7',
         '蓝色房子的钥匙 · Blue House Key · 城堡里的 Clyde · Clyde in the castle'),
        ('journey', 'four-wheels-cart', '第一辆矿车：查漏第一批车轮 · Q12',
         '第一辆矿车 · 轮子 · First minecart · Wheels'),
        ('equipment', 'barrier-cores', '小水护盾 · 苏的护盾 · 屏障',
         '全汉化版小水花100 AP，可给我方全体上护盾，基础屏障300＋小水当前魔攻。岩石护盾是另一招。'),
        ('journey', 'home-cooking', '炸酥肉（煎肉）缺辛辣块茎 · 新家 Q9',
         '利莫里亚市场西摊不卖辛辣块茎（加利根）。到风车村物品店，花56金币买一份，再到新家厨房做炸酥肉。'),
        ('quests', 'perfect-recipe-3', '完美食谱3：四份家禽肉 · Q52',
         '完美食谱3／完美食谱 3。在风车村东侧物品店找阿丽莎·隆根，备四份家禽肉再回来交。'),
        ('quests', 'perfect-recipe-4', '完美食谱4：辛辣块茎 · 加利根 · Q53',
         '全汉化版去风车村买十份辛辣块茎，每份56金币。做完回利莫里亚下城区找迪娜。'),
        ('equipment', 'mythril-refining', '秘银水晶 · 钻石水晶 · 补矿与精炼',
         '秘银水晶和钻石水晶：10矿→1锭，5锭→1水晶。后段洞窟不要按英文原版反复住宿刷矿，可利用传送门成品。'),
        ('equipment', 'loyal-link', '忠诚连接（忠诚之绊）',
         '750奖牌换配方。全汉化版制作需要暗之精华，不用暗物质；另备疾风宝石、红色光环和秘银水晶。'),
        ('equipment', 'supplies', '露营套装 · 恢复与随身补给',
         '营火消耗露营套装×1；全汉化版自己合成不需要石头。雪铃村父子民居可买药。'),
        ('equipment', 'common-cores', '疗愈核心 · 修复核心 · 治疗核心 · 愈合核心',
         '核心：疗愈只给治疗；核心：修复给治疗与复活。后者的设计图要找蓝色史莱姆领奖。'),
        ('journey', 'arcius-late-tasks', '雪铃村补给 · 雪铃镇 · 东南宝箱',
         '雪铃村商人卖药，不卖光之精华或矿石。全汉化版村东南民居宝箱给水之碎片×2。'),
        ('quests', 'union-link', '联盟链接（结合之约）',
         '雪铃村接任务，再在榆树村单独战胜加雷特；欧米伽之愿和第三段回忆。'),
        ('quests', 'portal-repeat', '暗孢传送门 · 暗之精华 · 秘银来源',
         '全汉化版再战仍掉暗之精华×11、光之精华×10、秘银水晶×2、秘银锭×5、秘银矿×5。'),
        ('exploration', 'arena-special', '斗技场特别挑战（特殊挑战）',
         '接国王的请求后，在报名菜单选「特别挑战-费用900金币」，获胜给400奖牌。'),
        ('exploration', 'wind-reward', '风之古灵（远古之魂）',
         '风之秘境打倒远古之魂后，到北端存档点附近找淋淋，连聊三次。'),
        ('journey', 'catalyst', '诱惑恶魔（催化恶魔） · Q17',
         '全汉化版的诱惑恶魔会放地震。注意叠加的屏障，并按方向提示完成合击。'),
        ('memories', 'ending', '回忆之石（回忆石） · 内存1／2／3 · 存档回放',
         '通关保存后调查水晶，选回忆之石和「内存」条目。内存3要看完雪铃村第三段剧情。'),
        ('memories', 'third-scene-reward', '集结：灵魂毁灭（碎魂合击）',
         '看完雪铃村额外剧情才学会；平时用时四人各备300 AP。'),
        ('gm-differences', 'gm-main', '全汉化版与英文原版（Official FINAL）',
         '全汉化版 · 超级小黑 · 我的艾瑟瑞尔时光 · GM · GM版 · GM汉化版 · GM 汉化版 · 魔改版'),
        ('gm-differences', 'gm-queen', '女王驾到 Q66 · 淋淋四站 · 地才装备 · 核心：舞娘',
         '榆树村北边、风之秘境、绿谷废弃小屋、被污染的洞穴深处。每站三次交谈。'),
    )
    for page, anchor, section, terms in aliases:
        if not re.search(r'\sid="' + re.escape(anchor) + r'"', (built / f'{page}.html').read_text()):
            raise ValueError(f'Search alias target missing: {page}#{anchor}')
        href = f'{page}.html#{anchor}'
        old = records.get(href, {})
        records[href] = dict(old, objectID=href, href=href, title=titles[page],
                             section=section, text=' '.join((terms, old.get('text', ''))).rstrip())
    index.write_text(json.dumps(list(records.values()), ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    for name in PAGES:
        path = ROOT / '_site' / f'{name}.html'
        path.write_text(enhance(path.read_text(), name))
    add_search_aliases()
    print(f'Etheria reading shell: {len(PAGES)} pages')
