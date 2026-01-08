#!/usr/bin/env python3
import re
import sys
from dataclasses import dataclass
from typing import Optional, Dict

import requests
from bs4 import BeautifulSoup


@dataclass
class Hashes:
    crc32: Optional[str] = None
    md5: Optional[str] = None
    sha1: Optional[str] = None


def fetch_html(url: str) -> str:
    # Dat-o-MATIC sometimes dislikes "default" bot-like requests.
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.text


def soup_system_text_and_title(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")

    # Remove script/style to reduce noise
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    system = find_system_name(soup) or "Sony - PlayStation 3 (PSN) (Themes)"

    title = find_romname_header(soup)

    # Get a readable text blob
    text = soup.get_text("\n")
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()

    return text, title, system


def find_field(text: str, labels: list[str]) -> Optional[str]:
    """
    Tries multiple labels like ["Game ID", "Title ID", "Serial"] and returns the first match.
    """
    for label in labels:
        # Match patterns like:
        # "Game ID: ABCD12345"
        # "Game ID ABCD12345"
        m = re.search(rf"\b{re.escape(label)}\b\s*[:\-]?\s*([A-Za-z0-9._\-]+)", text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None

def has_any_hash(h: Hashes) -> bool:
    return any([h.crc32, h.md5, h.sha1])

def find_system_name(soup: BeautifulSoup) -> Optional[str]:
    h3 = soup.find("h3")
    if not h3:
        return None

    text = h3.get_text(" ", strip=True)
    return text


def extract_hashes_near(text: str, filename: str, endText: str) -> Hashes:
    """
    Search around where the filename appears for CRC32/MD5/SHA-1.
    """
    startIdx = text.lower().find(filename.lower())
    if startIdx == -1:
        startIdx = 0
    
    endIdx = text.lower().find(endText.lower(), startIdx)
    if endIdx == -1:
        endIdx = len(text)

    chunk = text[startIdx:endIdx]

    crc32 = None
    md5 = None
    sha1 = None

    m = re.search(r"\bCRC32\b\s*[:\-]?\s*([0-9a-fA-F]{8})\b", chunk)
    if m:
        crc32 = m.group(1).lower()

    m = re.search(r"\bMD5\b\s*[:\-]?\s*([0-9a-fA-F]{32})\b", chunk)
    if m:
        md5 = m.group(1).lower()

    m = re.search(r"\bSHA[- ]?1\b\s*[:\-]?\s*([0-9a-fA-F]{40})\b", chunk)
    if m:
        sha1 = m.group(1).lower()

    return Hashes(crc32=crc32, md5=md5, sha1=sha1)


def find_first_file_with_ext(text: str, ext: str) -> Optional[str]:
    """
    Finds the first occurrence of something ending with .pkg / .rap.
    Uses a permissive filename pattern (Dat-o-MATIC often has spaces, brackets, parentheses).
    """
    # Capture a "filename-ish" token ending with .ext
    # This tries to avoid swallowing whole paragraphs.
    pattern = rf"([^\n\r<>\"']+?\.{re.escape(ext)})\b"
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None
    return m.group(1).strip()


def build_bbcode(
    header: str,
    game_id: str,
    url: str,
    system_name: str,
    pkg: Hashes,
    rap: Hashes,
) -> str:
    link_text = f"Datomatic - {system_name}" if system_name else "Datomatic"

    def fmt(h: Hashes) -> str:
        return (
            f"CRC32: [b]{h.crc32}[/b] | "
            f"MD5: [b]{h.md5}[/b] | "
            f"SHA-1: [b]{h.sha1}[/b]"
        )

    lines = [
        f"[align=center][b]{header}[/b]",
        f"Game ID: [b]{game_id}[/b]",
        "",
        f"Verified against No-Intro Checksums [url={url}]{link_text}[/url]",
        f"PKG - {fmt(pkg)}",
    ]

    # ⬇️ ONLY add RAP section if hashes actually exist
    if has_any_hash(rap):
        lines.append(f"RAP - {fmt(rap)}")

    lines.append("To use these files, install them on a modified PS3 or RPCS3[/align]")

    return "\n".join(lines)

def find_romname_header(soup: BeautifulSoup) -> str | None:
    tr = soup.find("tr", class_="romname_section")
    if not tr:
        return None

    td = tr.find("td")
    if not td:
        return None

    # Get visible text, strip &nbsp; and whitespace
    text = td.get_text(" ", strip=True)
    text = text.replace("\xa0", "").strip()

    return text if text else None


def main():
    if len(sys.argv) < 2:
        print("Usage: python datomatic_to_bbcode.py '<datomatic url>'", file=sys.stderr)
        sys.exit(1)

    end_text = "The dump"
    url = sys.argv[1].strip()
    html = fetch_html(url)
    text, title, system = soup_system_text_and_title(html)

    # Header: prefer a clean page title; otherwise fall back.
    header = title or "Dat-o-MATIC Record"

    # Game ID: try multiple likely labels
    game_id = (
        find_field(text, ["Game ID", "Title ID", "TitleID", "Serial", "Product Code"])
        or "N/A"
    )

    pkg_file = find_first_file_with_ext(text, "pkg")
    rap_file = find_first_file_with_ext(text, "rap")
    if not rap_file:
        rap_file = end_text  # To limit search scope

    pkg_hash = extract_hashes_near(text, pkg_file, rap_file) if pkg_file else Hashes()
    rap_hash = extract_hashes_near(text, rap_file, end_text) if rap_file else Hashes()

    out = build_bbcode(
        header=header,
        game_id=game_id,
        url=url,
        system_name=system,
        pkg=pkg_hash,
        rap=rap_hash,
    )
    print(out)


if __name__ == "__main__":
    main()
