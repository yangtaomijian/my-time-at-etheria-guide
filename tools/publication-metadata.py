"""Generate canonical names only for an explicitly selected HTTPS origin."""
from html import escape, unescape
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as et
import os
import json
import re
import struct

public = Path("public")
files = sorted(list(public.glob('*.html')) + list((public/'en').glob('*.html')))
assert len(files) == 13, 'Expected the curated 7+6 pages'
index = [public/'search.json',public/'en'/'search.json']
for p in index:
    assert p.is_file(),p
config = json.loads(Path("publication.json").read_text())
origin = config["origin"]
repository = config["repository"]
if not re.fullmatch(r"[a-z0-9-]+/[a-z0-9-]+", repository):
    raise SystemExit("Invalid approved repository name.")
requested = os.environ.get("ETHERIA_SITE_URL")
if requested is not None and requested.strip().rstrip("/") != origin:
    raise SystemExit("The workflow origin must match publication.json.")
if os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REPOSITORY") != repository:
    raise SystemExit("This workflow must run in the approved GitHub repository.")
parts = urlsplit(origin)
if parts.scheme != "https" or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", parts.netloc) or "." not in parts.netloc or any((parts.path,parts.fragment,parts.query)):
    raise SystemExit("ETHERIA_SITE_URL must be an HTTPS origin (no path or query).")
hostname=parts.netloc
origin="https://"+hostname
share_path = "assets/social/etheria-guide.png"
share_bytes = (public/share_path).read_bytes()
assert share_bytes.startswith(b"\x89PNG\r\n\x1a\n") and share_bytes[12:16] == b"IHDR"
width, height = struct.unpack(">II", share_bytes[16:24])
assert (width, height) == (1200, 630), (width, height)
share_url = origin + "/" + share_path
icon_path = "assets/brand/favicon.svg"
icon = et.parse(public/icon_path).getroot()
assert icon.tag == "{http://www.w3.org/2000/svg}svg"
assert (icon.get("width"), icon.get("height"), icon.get("viewBox")) == ("16", "16", "0 0 16 16")
assert not (public/"en"/icon_path).exists()
et.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
namespace="{http://www.sitemaps.org/schemas/sitemap/0.9}"
sitemap=et.Element(namespace+"urlset")
urls=[]
for page in files:
    path = page.relative_to(public).as_posix()
    canonical = origin + "/" + (path.removesuffix("index.html") if page.name == "index.html" else path)
    urls.append(canonical)
    document=page.read_text()
    assert document.count("</head>")==1 and 'rel="canonical"' not in document and 'property="og:url"' not in document, page
    title = re.search(r'<title>(.*?)</title>', document, re.S)
    description = re.search(r'<meta name="description" content="([^"]*)">', document)
    assert title and description, page
    locale = 'en_US' if path.startswith('en/') else 'zh_CN'
    if page.name == 'index.html':
        # The homepage page title already identifies both the game and scope.
        site_suffix = 'My Time at Etheria Guide' if locale == 'en_US' else 'Etheria · 全汉化版攻略'
        marker = ' – ' + site_suffix
        compiled_title = title[1]
        if compiled_title.endswith(marker):
            document = document[:title.start(1)] + compiled_title.removesuffix(marker) + document[title.end(1):]
            title = re.search(r'<title>(.*?)</title>', document, re.S)
    alt = ("My Time at Etheria player guide. A glowing blue crystal in an illustrated nighttime forest."
           if locale == "en_US" else "《My Time at Etheria》玩家攻略。夜色森林插画中，一簇蓝色水晶发光。")
    graph = {
        'url': canonical, 'type': 'website',
        'title': unescape(title[1]), 'description': unescape(description[1]), 'locale': locale,
        'image': share_url, 'image:type': 'image/png', 'image:width': str(width),
        'image:height': str(height), 'image:alt': alt,
    }
    tag = f'<link rel="canonical" href="{escape(canonical)}">\n'
    icon_href = ("../" if locale == "en_US" else "./") + icon_path
    assert (page.parent/icon_href).resolve() == (public/icon_path).resolve()
    assert not re.search(r'<link[^>]*\brel=["\'](?:shortcut )?icon["\']', document), page
    tag += f'<link rel="icon" type="image/svg+xml" href="{escape(icon_href)}">\n'
    tag += ''.join(f'<meta property="og:{key}" content="{escape(value)}">\n' for key,value in graph.items())
    twitter = {
        'card': 'summary_large_image', 'title': graph['title'], 'description': graph['description'],
        'image': share_url, 'image:alt': alt,
    }
    tag += ''.join(f'<meta name="twitter:{key}" content="{escape(value)}">\n' for key,value in twitter.items())
    page.write_text(document.replace("</head>",tag+"</head>",1))
    et.SubElement(et.SubElement(sitemap,namespace+"url"),namespace+"loc").text=canonical
et.ElementTree(sitemap).write(public/"sitemap.xml",encoding="utf-8",xml_declaration=True)
(public/"robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {origin}/sitemap.xml\n")
assert len(set(urls))==13
tree = et.parse(public/"sitemap.xml")
assert [loc.text for loc in tree.findall('.//'+namespace+'loc')]==urls
for page,c in zip(files,urls):
    text = page.read_text()
    assert text.count(f'<link rel="canonical" href="{escape(c)}">')==1,page
    assert text.count(f'<meta property="og:image" content="{escape(share_url)}">')==1,page
    assert text.count(f'<meta name="twitter:image" content="{escape(share_url)}">')==1,page
    relative_icon = ("../" if page.parent.name == "en" else "./") + icon_path
    assert text.count(f'<link rel="icon" type="image/svg+xml" href="{relative_icon}">')==1,page
print(f"Verified {len(urls)} canonicals, one language-complete sitemap, robots, Open Graph and favicon for {hostname}")
