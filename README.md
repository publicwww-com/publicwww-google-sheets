# PublicWWW for Google Sheets

Search the source code (HTML, JavaScript, CSS) of hundreds of millions of websites
from a spreadsheet: which sites load a script, carry a tracking id, a widget or any
other fragment of code - ranked by popularity.

```
=PUBLICWWW(A1)                    websites whose page source contains the query in A1
=PUBLICWWW(A1, 50, "url,rank")    50 rows, only the url and rank columns
=PUBLICWWW_COUNT(A1)              how many websites match
```

A **PublicWWW** menu sets your token, exports a whole query to a new sheet and shows
the quota left today.

## Setup

1. Open a spreadsheet, then **Extensions > Apps Script**.
2. Replace the contents of `Code.gs` with [`Code.gs`](Code.gs) from this repository
   and save.
3. Reload the spreadsheet. A **PublicWWW** menu appears; choose **Set API token** and
   paste a token from your [profile page](https://publicwww.com/profile/api). The API
   needs a paid plan.
4. Google asks once to authorize the script: it reads and writes this spreadsheet
   only, and connects to `api.publicwww.com`.

The token is kept in the script's properties. Anyone who can edit the script of this
spreadsheet can read it - share edit access accordingly, or use a separate token
you can delete on the profile page.

## Writing the query

The query is the same as in the [PublicWWW search box](https://publicwww.com/docs/query-syntax/).
Quotes matter: `"angular.min.js"` with the quotes is the exact string, without them
it is several words. In a formula a quote is written twice -
`=PUBLICWWW("""angular.min.js""")` - so it is easier to type the query, quotes
included, into a cell and refer to it: `=PUBLICWWW(A1)`.

## Functions

`PUBLICWWW(query, [rows], [columns], [header])`

- `rows` - 10 by default, up to 1000 in a formula. For more, use the export.
- `columns` - any of `domain`, `url`, `rank`, comma separated. All three by default.
- `header` - `TRUE` puts the column names on the first row.

Each row is one website, the most popular first. `rank` is empty for a website that
has no popularity rank. Nothing found gives an empty cell.

`PUBLICWWW_COUNT(query)` - the number of matching websites.

A formula runs a search only when it is entered or its arguments change, and an
answer is kept for six hours, so reopening the sheet does not spend searches again.

## Export

**PublicWWW > Export a query to a new sheet** writes every row your plan covers for
the query into a new sheet, with the totals in a note on the first cell. A very large
export can run into Google's limit of six minutes per script run; for lists of
hundreds of thousands of rows the [API](https://publicwww.com/docs/api/) itself is the
better road.

## Errors

A problem shows as `#ERROR!` in the cell; hover over it for the reason:

| Error | What to do |
|---|---|
| `No API token yet` | PublicWWW > Set API token |
| `invalid_key` | The token was deleted - set a new one |
| `plan_required` | The API needs a paid plan |
| `too_many_requests` | More than 10 requests a minute - wait the seconds shown |
| `quota_exceeded` | The day's searches are used up; they reset at midnight UTC |

All codes: [API errors](https://publicwww.com/docs/api/errors/).

## See also

- [API documentation](https://publicwww.com/docs/api/) and its [OpenAPI description](https://api.publicwww.com/openapi.json)
- [MCP server](https://publicwww.com/docs/mcp/) - the same search for AI assistants
- API clients for [Python](https://github.com/publicwww-com/publicwww-api-python), [JavaScript](https://github.com/publicwww-com/publicwww-api-javascript), [PHP](https://github.com/publicwww-com/publicwww-api-php), [Go](https://github.com/publicwww-com/publicwww-api-go), [Ruby](https://github.com/publicwww-com/publicwww-api-ruby)

## License

MIT
