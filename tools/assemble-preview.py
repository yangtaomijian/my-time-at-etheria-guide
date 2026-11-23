"""Combine two allowlisted Quarto outputs under one origin."""
from pathlib import Path
from tempfile import TemporaryDirectory
from shutil import copy2, rmtree
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import os

ROOT = Path.cwd()
CN = set('index journey quests exploration equipment memories gm-differences'.split())
EN = CN - {'gm-differences'}
PUBLIC_ASSETS = {'.js', '.css', '.svg', '.woff2', '.woff', '.txt'}
RUNTIME = {'.js', '.css', '.html', '.svg', '.woff2', '.woff', '.txt', '.png', '.gif'}

def export(src, dest, pages):
    expected = {f'{n}.html' for n in pages} | {'search.json'}
    for name in expected:
        dst = dest / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        copy2(src / name, dst)
    for rel, extensions in [('assets', PUBLIC_ASSETS), ('site_libs', RUNTIME)]:
        for f in sorted((src / rel).rglob('*')):
            if not f.is_file() or f.name.startswith('.'):
                continue
            if f.relative_to(src).as_posix().startswith('assets/discussion/') and os.environ.get('ETHERIA_DISCUSSION_ENABLED') != '1':
                continue
            approved_share_card = dest.name != "en" and f.relative_to(src).as_posix() == "assets/social/etheria-guide.png"
            if f.suffix not in extensions and not approved_share_card:
                print('Excluded:', f.relative_to(src))
                continue
            dst = dest / f.relative_to(src)
            dst.parent.mkdir(parents=True, exist_ok=True)
            copy2(f, dst)
    search = json.loads((dest / 'search.json').read_text())
    assert {e['href'].split('#')[0] for e in search} == {n+'.html' for n in pages}, dest
    print(f'{dest.name}: {len(pages)} pages; {len(search)} search results')

class HTML(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.anchors=set()
    def handle_starttag(self, tag, pairs):
        for k,v in pairs:
            if k=='id' and v: self.anchors.add(v)
            if k in {'href','src'} and v: self.refs.append(v)
            if k=='srcset' and v: self.refs.extend(x.strip().split()[0] for x in v.split(','))

def verify(out):
    pages={}
    for f in list(out.glob('*.html'))+list((out/'en').glob('*.html')):
        s=f.read_text(); p=HTML(); p.feed(s); pages[f]=p
        assert ('lang="en"' if f.parent.name=='en' else 'lang="zh-Hans"') in s
        assert '<meta name="quarto:offset" content="./">' in s
        assert 'nav-language' not in s and 'language-control' not in s
        if f.parent.name=='en':
            assert not any(x in s for x in ('gm-differences','Q66','全汉化')),f
    n=0
    for f,p in pages.items():
        refs = p.refs + ([e['href'] for e in json.loads((f.parent/'search.json').read_text())] if f.name=='index.html' else [])
        for x in refs:
            u=urlsplit(x)
            if u.scheme or u.netloc or x=='#': continue
            t=(f.parent/unquote(u.path)).resolve() if u.path else f
            assert t.exists(), (f,x)
            if t in pages and u.fragment: assert unquote(u.fragment) in pages[t].anchors,(f,x)
            assert (t.is_relative_to(out/'en') if f.parent.name=='en' else not t.is_relative_to(out/'en')),(f,x)
            n+=1
    print(f'{len(pages)} pages, {n} checked local references')
    assert not any(f.suffix in {'.zip','.scss','.qmd','.py'} or f.name.startswith('.') for f in out.rglob('*') if f.is_file())

with TemporaryDirectory(prefix='.assemble-',dir=ROOT) as work:
    preview=Path(work)/'preview'
    export(ROOT/'_site',preview,CN)
    export(ROOT/'en'/'_site',preview/'en',EN)
    verify(preview)
    dst=ROOT/'public'
    if dst.exists(): rmtree(dst)
    preview.rename(dst)
