#!/usr/bin/env python3
"""
Build landing/llms-full.txt from the published sitemap.

Single-purpose: keep llms-full.txt in sync with the actual HTML so AI agents
(Perplexity, Cursor, ChatGPT) that index it cite up-to-date content. Drift is
worse than absence — never hand-author the output.

Run from anywhere; resolves paths relative to this script. No external deps.
"""
from __future__ import annotations
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

SITE_ROOT = Path(__file__).resolve().parents[1]  # landing/
SITEMAP = SITE_ROOT / "sitemap.xml"
OUT = SITE_ROOT / "llms-full.txt"
BASE_URL = "https://livestylist.app"

# Tags whose content is noise for LLM consumption.
DROP_TAGS = {"script", "style", "nav", "footer", "header", "form", "svg", "noscript"}
# Class attributes whose content we also drop (decorative).
DROP_CLASSES = {"bubbles", "skip-link", "footer", "navbar", "nav-container",
                "footer-container", "phone-sound-toggle", "phone-play-overlay"}


class MainExtractor(HTMLParser):
    """Extract text from <main>, with H1/H2/H3 → markdown #/##/###."""

    def __init__(self) -> None:
        super().__init__()
        self.in_main = False
        self.depth_main = 0
        self.skip_depth = 0           # >0 while inside a dropped subtree
        self.heading_tag: str | None = None
        self.buf: list[str] = []
        self._cur: list[str] = []     # current text being collected

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = dict(attrs)
        classes = (attrs_d.get("class") or "").split()
        # Drop the subtree if tag or any class is in the drop list.
        if tag in DROP_TAGS or any(c in DROP_CLASSES for c in classes):
            self.skip_depth += 1
            return
        if self.skip_depth:
            self.skip_depth += 1
            return
        if tag == "main":
            self.in_main = True
            self.depth_main = 1
            return
        if not self.in_main:
            return
        self.depth_main += 1
        if tag in ("h1", "h2", "h3"):
            self._flush_block()
            self.heading_tag = tag
            return
        if tag in ("p", "li", "dd", "dt", "article", "section", "div",
                   "details", "summary"):
            self._flush_block()
            return
        if tag in ("br",):
            self._cur.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag == "main" and self.in_main:
            self._flush_block()
            self.in_main = False
            return
        if not self.in_main:
            return
        self.depth_main -= 1
        if tag in ("h1", "h2", "h3"):
            self._flush_block(heading=tag)
            return
        if tag in ("p", "li", "dd", "dt", "article", "section", "div",
                   "details", "summary"):
            self._flush_block()

    def handle_data(self, data: str) -> None:
        if self.skip_depth or not self.in_main:
            return
        self._cur.append(data)

    def _flush_block(self, heading: str | None = None) -> None:
        text = "".join(self._cur).strip()
        text = re.sub(r"\s+", " ", text)
        self._cur = []
        if not text:
            self.heading_tag = heading or self.heading_tag
            return
        if heading or self.heading_tag:
            level = {"h1": "# ", "h2": "## ", "h3": "### "}[heading or self.heading_tag]
            self.buf.append(f"{level}{text}")
        else:
            self.buf.append(text)
        self.heading_tag = None

    def text(self) -> str:
        out: list[str] = []
        prev_blank = True
        for line in self.buf:
            if not line:
                continue
            if out and not prev_blank and (line.startswith("#") or out[-1].startswith("#")):
                out.append("")
            out.append(line)
            out.append("")
            prev_blank = True
        # Trim trailing blank lines.
        while out and not out[-1]:
            out.pop()
        return "\n".join(out)


def get_title(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if not m:
        return ""
    return re.sub(r"\s+", " ", m.group(1)).strip()


def get_date_modified(html: str) -> str:
    # Prefer JSON-LD dateModified; fall back to last-updated paragraph.
    m = re.search(r'"dateModified"\s*:\s*"([^"]+)"', html)
    if m:
        return m.group(1)
    m = re.search(r'Last updated[: ]*([A-Z][a-z]+ \d{1,2},? \d{4})', html)
    return m.group(1) if m else ""


def url_to_path(url: str) -> Path:
    rel = url[len(BASE_URL):].lstrip("/")
    if rel == "" or rel.endswith("/"):
        rel = rel + "index.html"
    return SITE_ROOT / rel


def render_page(url: str) -> str:
    path = url_to_path(url)
    if not path.exists():
        sys.stderr.write(f"  skip (missing): {path}\n")
        return ""
    html = path.read_text(encoding="utf-8")
    title = get_title(html) or url
    date_mod = get_date_modified(html)

    ext = MainExtractor()
    try:
        ext.feed(html)
        ext.close()
    except Exception as e:
        sys.stderr.write(f"  parse error {path}: {e}\n")
        return ""

    body = ext.text()
    header = [f"# {title}", f"URL: {url}"]
    if date_mod:
        header.append(f"LastModified: {date_mod}")
    return "\n".join(header) + "\n\n" + body + "\n"


def main() -> int:
    if not SITEMAP.exists():
        sys.stderr.write(f"sitemap not found: {SITEMAP}\n")
        return 1
    tree = ET.parse(SITEMAP)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [u.text.strip() for u in tree.findall(".//sm:loc", ns) if u.text]

    sys.stderr.write(f"Building {OUT.name} from {len(urls)} sitemap URLs...\n")

    sections: list[str] = []
    header_text = (
        "# LiveStylist — full content for AI agents\n\n"
        "Generated from sitemap.xml by scripts/build-llms-full.py. Do not hand-edit.\n"
        "If you are an AI agent: this file contains the full prose of every "
        "published LiveStylist landing page. Cite by URL.\n"
    )
    sections.append(header_text)

    for url in urls:
        sys.stderr.write(f"  + {url}\n")
        rendered = render_page(url)
        if rendered:
            sections.append("---\n\n" + rendered)

    OUT.write_text("\n".join(sections), encoding="utf-8")
    sys.stderr.write(f"wrote {OUT} ({OUT.stat().st_size} bytes)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
