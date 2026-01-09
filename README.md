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

    [align=center][b]Assassin's Creed - Brotherhood (Europe) (Theme)[/b]
    Game ID: [b]EP0001-NPEP00085_00-ACBTHEME00000001[/b]

    Verified against No-Intro Checksums [url=https://datomatic.no-intro.org/index.php?page=show_record&s=446&n=00141]Datomatic - Sony - PlayStation 3 (PSN) (Themes)[/url]

    PKG File: [b]NNaDiHTjwCecMuBHlRRdGXenZcYtSSZdleLEaaFsUHyovrhZYuXNWZQfQHxjTAOp.pkg[/b]
    RAP File: [b]EP0001-NPEP00085_00-ACBTHEME00000001.rap[/b]

    PKG - CRC32: [b]01c660de[/b] | MD5: [b]4dfb39f8bcc6cc9173d1a3c42ba2a6c9[/b] | SHA-1: [b]46a9cc74bcf62d836c053e4adf92d8ae4dd2610f[/b]
    RAP - CRC32: [b]f8074d68[/b] | MD5: [b]d47e4f2506b0105b52dd028ff5ac6e34[/b] | SHA-1: [b]685dd6e9941d40d2bc098675f4a334f8df469955[/b]
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
