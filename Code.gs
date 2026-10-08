/**
 * PublicWWW for Google Sheets
 *
 * Search the source code (HTML, JavaScript, CSS) of hundreds of millions of
 * websites from a spreadsheet:
 *
 *   =PUBLICWWW(A1)                  websites whose page source contains the query in A1
 *   =PUBLICWWW(A1, 50, "url,rank")  50 rows, only the url and rank columns
 *   =PUBLICWWW_COUNT(A1)            how many websites match
 *
 * The PublicWWW menu sets your API token, exports a whole query to a new sheet
 * and shows the quota left today.
 *
 * Docs: https://publicwww.com/docs/api/sheets/
 */

/** @OnlyCurrentDoc */

var PUBLICWWW_API = 'https://api.publicwww.com';
var PUBLICWWW_TOKEN_PROPERTY = 'PUBLICWWW_TOKEN';
var PUBLICWWW_COLUMNS = ['domain', 'url', 'rank'];
var PUBLICWWW_DEFAULT_ROWS = 10;
// A formula has 30 seconds to finish; bigger lists go through the menu export.
var PUBLICWWW_MAX_FORMULA_ROWS = 1000;
var PUBLICWWW_EXPORT_PAGE = 50000;
var PUBLICWWW_CACHE_SECONDS = 6 * 60 * 60;

// ------------------------------------------------------------------ formulas

/**
 * Websites whose page source contains the query, most popular first.
 *
 * In a formula a quote is written twice: =PUBLICWWW("""angular.min.js""")
 * searches for the exact string. Simpler: type "angular.min.js" (with the
 * quotes) into a cell and use =PUBLICWWW(A1).
 *
 * @param {string} query What to search for, in PublicWWW syntax.
 * @param {number} rows How many rows, 10 by default, up to 1000.
 * @param {string} columns Comma separated: domain, url, rank. All three by default.
 * @param {boolean} header TRUE to put the column names on the first row.
 * @return The matching websites, one per row.
 * @customfunction
 */
function PUBLICWWW(query, rows, columns, header) {
  query = publicwwwQuery_(query);
  rows = rows === undefined || rows === '' || rows === null ? PUBLICWWW_DEFAULT_ROWS : Math.floor(Number(rows));
  if (!(rows >= 1)) throw new Error('rows must be a number from 1 to ' + PUBLICWWW_MAX_FORMULA_ROWS + '.');
  if (rows > PUBLICWWW_MAX_FORMULA_ROWS) {
    throw new Error('A formula returns at most ' + PUBLICWWW_MAX_FORMULA_ROWS
      + ' rows. For more, use the menu PublicWWW > Export a query to a new sheet.');
  }
  var cols = publicwwwColumns_(columns);

  var data = publicwwwCached_(['search', query, rows, cols.join(',')], function () {
    return publicwwwGet_('/v1/search', { query: query, per_page: rows, columns: cols.join(',') });
  });

  var out = header === true ? [cols.slice()] : [];
  data.results.forEach(function (r) {
    out.push(cols.map(function (c) { return publicwwwCell_(r[c]); }));
  });
  if (out.length === 0) return [['']];   // nothing found: an empty cell, not an error
  return out;
}

/**
 * How many websites have the query in their page source.
 *
 * @param {string} query What to search for, in PublicWWW syntax.
 * @return The number of matching websites.
 * @customfunction
 */
function PUBLICWWW_COUNT(query) {
  query = publicwwwQuery_(query);
  var data = publicwwwCached_(['count', query], function () {
    return publicwwwGet_('/v1/search', { query: query, per_page: 1, columns: 'domain' });
  });
  return data.total;
}

// ---------------------------------------------------------------------- menu

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PublicWWW')
    .addItem('Set API token', 'publicwwwSetToken')
    .addItem('Export a query to a new sheet', 'publicwwwExport')
    .addItem('Account and quota', 'publicwwwAccount')
    .addToUi();
}

function publicwwwSetToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('PublicWWW API token',
    'Paste a token from https://publicwww.com/profile/api (a paid plan is needed for the API).\n'
    + 'It is kept in this spreadsheet\'s script properties: anyone who can edit the script can read it.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;

  var token = r.getResponseText().trim();
  if (!token) {
    PropertiesService.getScriptProperties().deleteProperty(PUBLICWWW_TOKEN_PROPERTY);
    ui.alert('The token is removed.');
    return;
  }
  var account;
  try {
    account = publicwwwGet_('/v1/account', {}, token);
  } catch (e) {
    ui.alert('That token did not work: ' + e.message);
    return;
  }
  PropertiesService.getScriptProperties().setProperty(PUBLICWWW_TOKEN_PROPERTY, token);
  ui.alert('Token saved. Plan: ' + account.plan + ', searches left today: '
    + Math.max(0, account.quota.searches.limit - account.quota.searches.used) + '.');
}

function publicwwwAccount() {
  var ui = SpreadsheetApp.getUi();
  var a;
  try {
    a = publicwwwGet_('/v1/account', {});
  } catch (e) {
    ui.alert(e.message);
    return;
  }
  ui.alert('PublicWWW account',
    'Plan: ' + a.plan + (a.plan_until ? ', paid until ' + new Date(a.plan_until * 1000).toISOString().slice(0, 10) : '') + '\n'
    + 'Searches today: ' + a.quota.searches.used + ' of ' + a.quota.searches.limit + '\n'
    + 'Searches with snippets today: ' + a.quota.snippets.used + ' of ' + a.quota.snippets.limit + '\n'
    + 'Rows per query: up to ' + a.limits.max_per_page + '\n'
    + 'The quota resets at midnight UTC.',
    ui.ButtonSet.OK);
}

function publicwwwExport() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Export a query',
    'What to search for, in PublicWWW syntax - for example "angular.min.js" with the quotes.\n'
    + 'Every row your plan covers goes to a new sheet.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var query = r.getResponseText().trim();
  if (!query) return;

  var sheet;
  try {
    var account = publicwwwGet_('/v1/account', {});
    var max = Math.max(1, account.limits.max_per_page);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.insertSheet(publicwwwSheetName_(ss, query));
    sheet.getRange(1, 1, 1, 3).setValues([PUBLICWWW_COLUMNS]).setFontWeight('bold');
    sheet.setFrozenRows(1);

    // Pages of equal size that fit the plan exactly: the API refuses a page
    // that reaches past the first max_per_page rows of a query.
    var pages = Math.ceil(max / PUBLICWWW_EXPORT_PAGE);
    var per = Math.floor(max / pages);
    var written = 0, total = 0, truncated = false, complete = true;
    for (var page = 1; page <= pages; page++) {
      var data = publicwwwGet_('/v1/search', { query: query, per_page: per, page: page, columns: PUBLICWWW_COLUMNS.join(',') }, null, true);
      total = data.total;
      truncated = truncated || data.truncated;
      complete = complete && data.index_complete !== false;
      var values = data.results.map(function (row) {
        return PUBLICWWW_COLUMNS.map(function (c) { return publicwwwCell_(row[c]); });
      });
      if (values.length) sheet.getRange(written + 2, 1, values.length, 3).setValues(values);
      written += values.length;
      if (written >= total || data.results.length < per) break;
    }

    var note = written + ' of ' + total + ' websites';
    if (total > written) note += ' (the plan covers the first ' + max + ' rows of a query)';
    if (truncated) note += '; some rows are beyond the ranks the plan discloses';
    if (!complete) note += '; part of the index did not answer, the list may be incomplete';
    sheet.getRange(1, 1).setNote(query + '\n' + note);
    ui.alert('Exported ' + note + '.');
  } catch (e) {
    ui.alert('Export stopped: ' + e.message);
  }
}

// ------------------------------------------------------------------ internals

function publicwwwQuery_(query) {
  if (Array.isArray(query)) query = query.map(function (row) { return row.join(' '); }).join('\n');
  query = String(query === undefined || query === null ? '' : query).trim();
  if (!query) throw new Error('The query is empty.');
  return query;
}

function publicwwwColumns_(columns) {
  if (columns === undefined || columns === null || columns === '') return PUBLICWWW_COLUMNS.slice();
  var cols = String(columns).split(',').map(function (c) { return c.trim().toLowerCase(); }).filter(String);
  cols.forEach(function (c) {
    if (PUBLICWWW_COLUMNS.indexOf(c) < 0) throw new Error('Unknown column "' + c + '". Use: ' + PUBLICWWW_COLUMNS.join(', ') + '.');
  });
  if (!cols.length) throw new Error('columns is empty.');
  return cols;
}

function publicwwwCell_(v) {
  return v === null || v === undefined ? '' : v;   // an unranked website has no rank
}

function publicwwwToken_() {
  var t = PropertiesService.getScriptProperties().getProperty(PUBLICWWW_TOKEN_PROPERTY);
  if (!t) throw new Error('No API token yet: use the menu PublicWWW > Set API token.');
  return t;
}

// One GET to the API. Errors come back as {"error": {"code", "message"}} with a
// status code; they are thrown so the cell shows #ERROR! with the reason.
// mayWait: on "too many requests" sleep as told and repeat - for the export,
// which makes many requests in a row; a formula has no time to wait.
function publicwwwGet_(path, params, token, mayWait) {
  var qs = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  var resp, code;
  for (var attempt = 0; ; attempt++) {
    resp = UrlFetchApp.fetch(PUBLICWWW_API + path + (qs ? '?' + qs : ''), {
      method: 'get',
      headers: { Authorization: 'Bearer ' + (token || publicwwwToken_()) },
      muteHttpExceptions: true
    });
    code = resp.getResponseCode();
    if (!(mayWait && code === 429 && attempt < 5)) break;
    var h = resp.getHeaders(), wait = 0;
    Object.keys(h).forEach(function (k) { if (k.toLowerCase() === 'retry-after') wait = Number(h[k]); });
    if (!(wait > 0 && wait <= 60)) break;   // quota_exceeded waits till midnight: no point
    Utilities.sleep(wait * 1000);
  }
  var body;
  try {
    body = JSON.parse(resp.getContentText());
  } catch (e) {
    throw new Error('PublicWWW answered ' + code + ' with something that is not JSON.');
  }
  if (code !== 200) {
    var err = body && body.error ? body.error : { code: 'http_' + code, message: 'HTTP ' + code };
    var msg = err.code + ': ' + err.message;
    if (err.retry_after && err.code === 'too_many_requests') msg += ' Retry in ' + err.retry_after + ' s.';
    throw new Error(msg);
  }
  if (body.query_note) throw new Error('The query was not run: ' + body.query_note);
  return body;
}

// The same formula is recalculated whenever the sheet is reopened or a
// referenced cell changes. Answers are kept for six hours so that does not
// spend the account's requests and daily searches again.
function publicwwwCached_(keyParts, fetch) {
  var cache = CacheService.getScriptCache();
  var key = 'pww:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(keyParts)));
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var data = fetch();
  var s = JSON.stringify(data);
  if (s.length < 100000) {   // the cache takes values up to 100 KB
    try { cache.put(key, s, PUBLICWWW_CACHE_SECONDS); } catch (e) { /* not cached, still answered */ }
  }
  return data;
}

function publicwwwSheetName_(ss, query) {
  var base = query.replace(/[\[\]\*\?\/\\:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'PublicWWW';
  var name = base, n = 2;
  while (ss.getSheetByName(name)) name = base + ' (' + (n++) + ')';
  return name;
}
