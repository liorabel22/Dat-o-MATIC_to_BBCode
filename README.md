# Dat-o-MATIC → BBCode Generator (PS3)

This project is a small Python utility that generates ready-to-use
BBCode for PlayStation 3 DLCs uploads by pulling verified metadata
directly from **Dat-o-MATIC (No-Intro)**.

It was created to eliminate repetitive manual work when uploading PS3
DLCs and to ensure that all releases are consistently verified and
accurately documented.

------------------------------------------------------------------------

## Why this exists

When uploading PS3 DLCs, I usually include a BBCode block that
contains:

-   The exact theme name
-   Game / Title ID
-   A verification link to Dat-o-MATIC
-   Cryptographic checksums (CRC32 / MD5 / SHA-1)
-   A short usage note (PS3 / RPCS3)

Manually recreating this block for every upload is time-consuming,
repetitive, and error-prone.\
This script automates the process by taking a Dat-o-MATIC **record URL**
and generating the BBCode automatically.

------------------------------------------------------------------------

## Features

-   Extracts the official title directly from Dat-o-MATIC
-   Extracts the Game ID / Title ID
-   Extracts PKG hashes (CRC32 / MD5 / SHA-1)
-   Automatically links to the Dat-o-MATIC record
-   Omits the RAP section entirely if no `.rap` file exists
-   Produces clean, tracker-ready BBCode output

------------------------------------------------------------------------

## Example Output

    [align=center][b]Ar nosurge - Umareizuru Hoshi e Inoru Uta (Japan) (Theme)[/b]
    Game ID: [b]JP0103-NPJB00573_00-INIDYCUSTOMTHEME[/b]

    Verified against No-Intro Checksums [url=https://datomatic.no-intro.org/index.php?page=show_record&s=446&n=00135]Datomatic - Sony - PlayStation 3 (PSN) (Themes)[/url]
    PKG - CRC32: [b]1b0cf1cd[/b] | MD5: [b]8215520ae45f5649ebd028f74f3b9fb9[/b] | SHA-1: [b]903f8495f6ce458306835cbad55d5c4e7f1d076c[/b]
    RAP - CRC32: [b]2c2afbd5[/b] | MD5: [b]21cc29e5b3399fb1c37079accea0a176[/b] | SHA-1: [b]d20a196325e4020da0ef1f5d895214a5ae47daee[/b]
    To use these files, install them on a modified PS3 or RPCS3[/align]

------------------------------------------------------------------------

## Requirements

-   Python 3.10+
-   Internet access (Dat-o-MATIC is queried live)

### Python dependencies

    pip install requests beautifulsoup4 lxml

------------------------------------------------------------------------

## Usage

    python datomatic_to_bbcode.py "<datomatic record url>"

Example:

    python datomatic_to_bbcode.py "https://datomatic.no-intro.org/index.php?page=show_record&s=446&n=00135"

The generated BBCode is printed to stdout and can be pasted directly
into a tracker upload or forum post.

------------------------------------------------------------------------

## How it works

1.  Fetches the Dat-o-MATIC record page
2.  Parses the HTML using BeautifulSoup
3.  Extracts:
    -   Title from `tr.romname_section`
    -   Game ID from labeled table fields
    -   File hashes from table rows containing `.pkg` / `.rap`
4.  Builds BBCode conditionally:
    -   PKG section is mandatory
    -   RAP section is included only if a real `.rap` file exists
5.  Outputs a clean BBCode block

------------------------------------------------------------------------

## Notes

-   Designed specifically for PS3 on Dat-o-MATIC
-   Relies on Dat-o-MATIC's current HTML structure
-   If the site layout changes, selectors may need updating

------------------------------------------------------------------------

## License

Provided as-is for personal and archival use.\
Feel free to adapt it to your own workflow.

------------------------------------------------------------------------

## Acknowledgments

-   No-Intro / Dat-o-MATIC for maintaining a reliable verification
    database
-   The preservation community for keeping this data accessible
