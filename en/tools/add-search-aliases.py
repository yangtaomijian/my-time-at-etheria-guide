"""Use task wording to take players directly to the corresponding action."""
import json
from pathlib import Path

site = Path("_site")
index = site / "search.json"
entries = json.loads(index.read_text())
topics = [
    ("journey", "lemuria-next", "Blue House Key: find Clyde", "Blue House Key · Clyde in the castle · no Our New Home quest"),
    ("journey", "four-wheels-cart", "First minecart: four Wheels", "first minecart · mine cart · missing wheel · Wheels"),
    ("journey", "second-cart", "Second minecart: four more Wheels", "second minecart · deeper mine · mine cart by the ore piles"),
    ("journey", "emerald-next", "Regull Port: what to do after the four residents", "cannot board · talked to four residents · Q15 · ship captain"),
    ("journey", "home-cooking", "Gali Root and Fried Meat", "Gali Root · Fried Meat · Our New Home"),
    ("quests", "perfect-recipe-3", "The Perfect Recipe 3", "Perfect Recipe 3 · four Poultry Meat · Windmill Village"),
    ("journey", "ruins-rest", "Forgotten Ruins: Camping Kit and core recipes", "Camping Kit Recipe · Magishard Recipes · Beginner Core Recipes · Grilled Meat Recipe · Piko Juice Recipe"),
    ("journey", "judah", "Judah: summons and rewards", "Judah · Vengeful Spirit · Skeleton Soldier · Guardian Soulstone"),
    ("journey", "catalyst", "Catalyst Demon: barrier and regeneration", "Catalyst Demon · Regenerate · Echo Drops · Silence · 5,000 BP"),
    ("equipment", "snowbell-materials", "Snowbell Village merchant: ores and essences", "Snowbell merchant · Snowbell shop · Mythril Ore · Diamond Ore · Light Essence · 450 Gold"),
    ("equipment", "barrier-cores", "Su Barrier and protection cores", "Su Barrier · 100 AP · barrier · shields"),
    ("equipment", "mythril-refining", "Mythril Crystal and refining", "mythril ore · mythril bar · mythril crystal · eight ore"),
    ("exploration", "arena-special", "Special Challenge: earn 400 medals", "Special Challenge · 400 medals · arena · The King's Request"),
    ("memories", "ending", "Memory Stone: save, replay, or sail back", "Memory Stone · Memory 1 · Memory 2 · Memory 3 · after the ending"),
]
for name, anchor, title, text in topics:
    page = site / f"{name}.html"
    if not page.exists() or f'id="{anchor}"' not in page.read_text():
        raise RuntimeError(f"Missing search target: {name}#{anchor}")
    target = f"{name}.html#{anchor}"
    entries.append({"href": target, "title": title, "section": "", "text": text, "objectID": target + "-task-alias"})
index.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
