/* Token Radar's dashboard: one static page, no network. The data it renders comes from ../data.js
 * (window.RADAR), written by main.ts from the same board as board.json, and every row is recomputed
 * here from the snapshot's own figures, so the page and the board show the same arithmetic.
 *
 * Two views: Board (the ranked pre-token protocols) and Live token (the protocols that already trade,
 * shown with the market's own value, never ranked into the board). A row opens a detail view with the
 * whole calculation and an eight-step farm plan.
 */
(function () {
  'use strict';
  var DATA = window.RADAR;
  var M = DATA.model;
  var ROWS = DATA.rows;
  var LIVE = DATA.live;

  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied', dir: 'desc', selected: null };
  var MAX_AGE_DAYS = 1095;

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(2) + '%';
    return '<span class="' + (n > 0 ? 'pos' : n < 0 ? 'neg' : '') + '">' + s + '</span>';
  }
  function fmtMult(n) { return n.toFixed(2) + '×'; }
  function fmtAge(age) {
    if (age === null || age === undefined) return '—';
    if (age < 365) return Math.round(age) + 'd';
    return (age / 365).toFixed(1) + 'y';
  }
  function fmtGrowth(g) { return (g >= 0 ? '+' : '') + g.toFixed(1) + '%'; }

  function categoryMultiple(category) {
    for (var i = 0; i < DATA.category_table.length; i++) {
      if (DATA.category_table[i].category === category) return DATA.category_table[i].multiple;
    }
    return M.default_multiple;
  }

  /* The same function main.ts runs, from the same constants: the page recomputes every row's implied
   * value from the snapshot figures and says so when it does not match board.json. */
  function impliedOf(row) {
    var growthPct = Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growthPct / 100) * M.growth_weight;
    var declineMult = growthPct < 0 ? 1 + (growthPct / 100) * M.decline_weight : 1;
    var age = row.age_days === null || row.age_days === undefined ? M.unknown_age_days : row.age_days;
    var maturityMult = M.maturity_floor + (1 - M.maturity_floor) * Math.sqrt(Math.min(Math.max(age, 0), MAX_AGE_DAYS) / MAX_AGE_DAYS);
    var chainMult = 1 + M.chain_step * Math.min(Math.max(row.chains.length - 1, 0), M.chain_cap);
    var multiple = categoryMultiple(row.category);
    var implied = Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * declineMult * maturityMult * chainMult));
    return { implied: implied, multiple: multiple, growthPct: growthPct, growthMult: growthMult, declineMult: declineMult, maturityMult: maturityMult, chainMult: chainMult, age: age };
  }
  function checksOut(row) { return impliedOf(row).implied === row.implied_value_usd; }

  /* The farm plan, derived from the protocol's own record: category, chain, TVL and age. */
  function capitalFor(row) {
    if (row.tvl_usd >= 5e9) return 250;
    if (row.tvl_usd >= 1e9) return 150;
    if (row.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    if (c.indexOf('lend') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1) return 'Supply $' + capital + ' of USDC to ' + row.name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') !== -1 || c.indexOf('yield') !== -1 || c.indexOf('leveraged farm') !== -1) return "Provide $" + capital + " of liquidity to " + row.name + "'s main pool on " + chain + " and keep the position open.";
    if (c.indexOf('bridge') !== -1) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + row.name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') !== -1 || c.indexOf('restak') !== -1) return 'Stake $' + capital + " of the chain's staking asset through " + row.name + ' and keep the receipt.';
    if (c.indexOf('perpetual') !== -1 || c.indexOf('derivative') !== -1) return 'Deposit $' + capital + ' of USDC as margin on ' + row.name + ' and open one small hedge.';
    if (c.indexOf('prediction') !== -1) return 'Fund $' + capital + ' and place one market position on ' + row.name + '.';
    if (c.indexOf('curator') !== -1 || c.indexOf('allocator') !== -1) return 'Deposit $' + capital + ' into a ' + row.name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') !== -1) return 'Mint or deposit $' + capital + ' of the stable asset through ' + row.name + ' on ' + chain + '.';
    if (c.indexOf('rwa') !== -1) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') !== -1) return 'Buy $' + capital + ' of cover from ' + row.name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + row.name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(row, second) {
    var c = (row.category || '').toLowerCase();
    if (c.indexOf('lend') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1) return 'Borrow $' + second + ' against the deposit and repay it within the week, so the protocol records borrowing as well as supply.';
    if (c.indexOf('dex') !== -1 || c.indexOf('yield') !== -1 || c.indexOf('leveraged farm') !== -1) return 'Swap $' + second + ' of USDC through the pool once, so the protocol records trading volume as well as liquidity.';
    if (c.indexOf('bridge') !== -1) return 'Bridge $' + second + ' back the other way, so the protocol records a return trip.';
    if (c.indexOf('staking') !== -1 || c.indexOf('restak') !== -1) return 'Delegate a second, smaller stake of $' + second + ' from the same wallet a week later.';
    if (c.indexOf('perpetual') !== -1 || c.indexOf('derivative') !== -1) return 'Close the hedge and open a fresh one half its size, so the protocol records a second trade.';
    if (c.indexOf('prediction') !== -1) return 'Settle the first position and place a second one of $' + second + '.';
    if (c.indexOf('curator') !== -1 || c.indexOf('allocator') !== -1) return 'Move $' + second + ' into a second vault of the same curator.';
    if (c.indexOf('stable') !== -1) return 'Redeem $' + second + ' of the stable asset and mint it again, so the protocol records a second mint.';
    if (c.indexOf('rwa') !== -1) return 'Claim the yield the position accrued and redeposit $' + second + ' of it.';
    if (c.indexOf('insurance') !== -1) return 'Renew the cover for a second period of $' + second + '.';
    return 'Make a second deposit of $' + second + ' a week later from the same wallet.';
  }
  function farmSteps(row) {
    var chain = row.chains.length ? row.chains[0] : 'its main chain';
    var capital = capitalFor(row);
    var second = Math.max(25, Math.floor(capital / 2));
    var hold = row.age_days === null || row.age_days === undefined ? 30 : row.age_days < 180 ? 60 : row.age_days < 365 ? 45 : 30;
    var gas = capital >= 150 ? 8 : 4;
    function step(text, cost, time) {
      var s = text + ' Cost: ' + cost + '. Time: ' + time + '.';
      if (s.length > 600) s = s.slice(0, 596) + '...';
      return s;
    }
    return [
      step('Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'),
      step(actionFor(row, capital, chain), '$' + capital + ' of capital and about $' + gas + ' of gas', '15 minutes to set up'),
      step(secondActionFor(row, second), '$' + second + ' for the second action and about $3 of gas', '10 minutes'),
      step('Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', 'about $2 of gas a week', '10 minutes a week'),
      step('Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'),
      step("Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", 'no fee to check, and never pay to claim', '10 minutes'),
      step('To unwind, withdraw the position in two parts a day apart and keep $' + gas + ' of gas aside for both transactions.', 'about $' + gas + ' of gas to exit', '20 minutes across two days'),
      step('Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes'),
    ];
  }

  /* The page's state in the URL hash, so a detail view, a filter or a search is a link. */
  function readHash() {
    var params = new URLSearchParams((location.hash || '').slice(1));
    state.q = params.get('q') || '';
    state.category = params.get('category') || 'all';
    state.chain = params.get('chain') || 'all';
    state.tab = params.get('tab') === 'live' ? 'live' : 'board';
    state.selected = params.get('p') || null;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = '#' + params.toString();
    if (location.hash !== next) history.replaceState(null, '', next);
  }

  function categories() {
    var out = [];
    ROWS.forEach(function (r) {
      if (r.category && out.indexOf(r.category) === -1) out.push(r.category);
    });
    return out.sort();
  }
  function chains() {
    var out = [];
    ROWS.forEach(function (r) {
      r.chains.forEach(function (c) {
        if (out.indexOf(c) === -1) out.push(c);
      });
    });
    return out.sort();
  }
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return ROWS.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }
  function sortedRows(rows) {
    var arr = rows.slice();
    var key = state.sort;
    arr.sort(function (a, b) {
      var va, vb;
      if (key === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (key === 'growth') { va = a.change_7d === null ? 0 : a.change_7d; vb = b.change_7d === null ? 0 : b.change_7d; }
      else if (key === 'age') { va = a.age_days === null ? 0 : a.age_days; vb = b.age_days === null ? 0 : b.age_days; }
      else { va = a.implied_value_usd; vb = b.implied_value_usd; }
      if (va === vb) return a.slug < b.slug ? -1 : 1;
      return state.dir === 'desc' ? (va > vb ? -1 : 1) : (va < vb ? -1 : 1);
    });
    return arr;
  }
  function sortKey() { return state.dir === 'desc' ? ' ↓' : ' ↑'; }

  function headerHtml() {
    return '<header class="top"><div class="brand"><span class="mark" aria-hidden="true"></span><span class="brand-name">Token Radar</span></div>' +
      '<div class="top-meta"><span>Snapshot ' + esc(DATA.as_of) + '</span><span>Source ' + esc(DATA.source) + '</span><span>Model ' + esc(DATA.model_version) + '</span></div></header>';
  }
  function ledeHtml() {
    var top = ROWS[0];
    var growthTop = sortedRows(ROWS).filter(function (r) { return r.change_7d !== null; }).sort(function (a, b) { return b.change_7d - a.change_7d; })[0];
    return '<section class="lede"><h1>The radar for the next token launch</h1>' +
      '<p>' + ROWS.length + ' pre-token protocols, ranked by what a launch would be worth — from the snapshot\u2019s own figures, not from a name list. ' +
      'Every row shows its arithmetic and an eight-step farm plan. ' +
      (top ? 'The strongest signal is <strong>' + esc(top.name) + '</strong> at ' + fmtUsd(top.implied_value_usd) + ' implied value. ' : '') +
      (growthTop ? 'The fastest mover is <strong>' + esc(growthTop.name) + '</strong>, up ' + growthTop.change_7d.toFixed(1) + '% in seven days.' : '') + '</p>' +
      '<div class="facts">' +
      '<div class="fact"><span>Protocols ranked</span><b>' + ROWS.length + '</b></div>' +
      '<div class="fact"><span>Watchlist covered</span><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b></div>' +
      '<div class="fact"><span>Early radar</span><b>' + DATA.early_size + '</b></div>' +
      '<div class="fact"><span>Watchlist floor</span><b>' + fmtUsd(DATA.floor_usd) + '</b></div>' +
      '</div></section>';
  }
  function controlsHtml() {
    var cats = categories();
    var chs = chains();
    var opt = function (v, label, current) {
      return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(label) + '</option>';
    };
    var catOpts = '<option value="all">All categories</option>' + cats.map(function (c) { return opt(c, c, state.category); }).join('');
    var chainOpts = '<option value="all">All chains</option>' + chs.map(function (c) { return opt(c, c, state.chain); }).join('');
    return '<section class="controls" aria-label="Filter the board">' +
      '<div class="field"><label for="q">Search</label><input id="q" type="search" value="' + esc(state.q) + '" placeholder="Name or slug" autocomplete="off"></div>' +
      '<div class="field"><label for="category">Category</label><select id="category">' + catOpts + '</select></div>' +
      '<div class="field"><label for="chain">Chain</label><select id="chain">' + chainOpts + '</select></div>' +
      '<div class="tabs" role="group" aria-label="View"><button type="button" data-tab="board" aria-pressed="' + (state.tab === 'board') + '">Board</button><button type="button" data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live token</button></div>' +
      '<span class="count" id="count"></span>' +
      '</section>';
  }
  function boardTableHtml(rows) {
    var max = ROWS.length ? ROWS[0].implied_value_usd : 1;
    var th = function (key, label) {
      return '<th scope="col"><button type="button" data-sort="' + key + '">' + label + (state.sort === key ? sortKey() : '') + '</button></th>';
    };
    var body = rows.map(function (r) {
      var width = Math.max(2, (r.implied_value_usd / max) * 100);
      return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || '—') + ' · ' + esc(r.chains.join(', ') || '—') + '</span></td>' +
        '<td class="implied num"><div class="bar"><i style="width:' + width.toFixed(1) + '%"></i></div>' + fmtUsd(r.implied_value_usd) + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td><span class="status">Pre-token</span></td>' +
        '</tr>';
    }).join('');
    return '<section class="panel"><div class="table-wrap"><table>' +
      '<caption class="sub">The ranked board. Rank is the implied value, strongest first; clicking a row opens its arithmetic and farm plan.</caption>' +
      '<thead><tr><th scope="col">#</th>' + th('name', 'Protocol') + th('implied', 'Implied value') + th('tvl', 'TVL') + th('growth', '7d') + th('age', 'Age') + '<th scope="col">Status</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table></div></section>';
  }
  function liveTableHtml() {
    var body = LIVE.map(function (r) {
      return '<tr><td class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || '—') + ' · ' + esc(r.chains.join(', ') || '—') + '</span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + (r.mcap_usd === null ? '—' : fmtUsd(r.mcap_usd)) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
        '<td><span class="status live">Live token</span></td></tr>';
    }).join('');
    return '<section class="panel"><h2>Live token — what already trades</h2>' +
      '<p class="sub">These protocols have a token, so the board shows the market\u2019s own value instead of a model\u2019s. They are never ranked into the pre-token board; a launch cannot be found where one already happened.</p>' +
      '<div class="table-wrap"><table><thead><tr><th scope="col">Protocol</th><th scope="col" class="num">TVL</th><th scope="col" class="num">Market cap</th><th scope="col" class="num">7d</th><th scope="col">Status</th></tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }
  function modelPanelHtml() {
    var table = DATA.category_table.map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td>' + c.multiple.toFixed(2) + '</td></tr>';
    }).join('');
    return '<section class="panel"><h2>How the model works</h2>' +
      '<p class="sub">One function scores every row, from the snapshot\u2019s own figures. No protocol name is special-cased, so any row can be recomputed by hand from this page.</p>' +
      '<div class="formula">implied = round( TVL × category × growth × decline × maturity × chains )<br>' +
      'growth&nbsp;&nbsp;&nbsp;= 1 + clamp(7d change, −60%, +120%) × 0.60<br>' +
      'decline&nbsp;= 1 + 7d change × 0.30 when TVL is falling, else 1<br>' +
      'maturity = 0.5 + 0.5 × √( min(age, 1095 days) / 1095 )<br>' +
      'chains&nbsp;&nbsp;&nbsp;= 1 + 0.03 × min(chains − 1, 5)</div>' +
      '<table class="cat-table"><thead><tr><th scope="col">Category</th><th scope="col">Multiple</th></tr></thead><tbody>' + table +
      '<tr><td>Any other category</td><td>' + M.default_multiple.toFixed(2) + '</td></tr></tbody></table>' +
      '<div class="note">What the board leaves out, on purpose: wrapped, staked and bridged products of tokens that already trade, centralised exchanges and versioned pools. They are not protocols waiting on a launch of their own.</div>' +
      '</section>';
  }
  function emptyHtml() {
    return '<section class="panel empty"><h2>Nothing matches</h2><p class="sub">Loosen the search or the filters — the whole board is still one click away.</p><button type="button" class="button primary" id="reset">Clear the search and filters</button></section>';
  }

  /* The detail view: the whole calculation, then the farm plan. */
  function detailHtml(row) {
    var v = impliedOf(row);
    var match = checksOut(row);
    var steps = farmSteps(row).map(function (s) {
      var text = s;
      var cost = '';
      var at = s.indexOf(' Cost: ');
      if (at !== -1) { text = s.slice(0, at); cost = s.slice(at + 7).replace(/\. Time: /, ' · '); }
      return '<li><b>' + esc(text) + '</b><span class="cost">' + esc(cost) + '</span></li>';
    }).join('');
    return '<div class="detail-head"><div><p class="sub">Rank ' + row.rank + ' · ' + esc(row.category || '—') + ' · ' + esc(row.chains.join(', ') || '—') + '</p>' +
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="sub">' + (match ? 'Recomputed here from the snapshot — matches board.json.' : 'Recomputed here — differs from board.json, read the board.') + '</p></div>' +
      '<button type="button" class="close" data-close>Close</button></div>' +
      '<section class="detail-section"><h3>The arithmetic</h3><div class="equation">' +
      '<div><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
      '<div><span>Category multiple</span><b>' + fmtMult(v.multiple) + '</b></div>' +
      '<div><span>7d change</span><b>' + fmtGrowth(row.change_7d === null ? 0 : row.change_7d) + '</b></div>' +
      '<div><span>Growth</span><b>' + fmtMult(v.growthMult) + '</b></div>' +
      '<div><span>Decline</span><b>' + fmtMult(v.declineMult) + '</b></div>' +
      '<div><span>Maturity (' + fmtAge(v.age) + ')</span><b>' + fmtMult(v.maturityMult) + '</b></div>' +
      '<div><span>Chains (' + row.chains.length + ')</span><b>' + fmtMult(v.chainMult) + '</b></div>' +
      '<div class="total"><span>Implied value</span><b>' + fmtUsd(row.implied_value_usd) + '</b></div>' +
      '</div></section>' +
      '<section class="detail-section"><h3>Farm plan — eight steps</h3><ol class="steps">' + steps + '</ol></section>';
  }
  var dialog = null;
  function openDetail(slug) {
    var row = null;
    ROWS.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'detail';
      dialog.addEventListener('close', function () {
        if (state.selected) { state.selected = null; writeHash(); render(); }
      });
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = detailHtml(row);
    if (!dialog.open) dialog.showModal();
    var close = dialog.querySelector('[data-close]');
    if (close) close.addEventListener('click', function () { dialog.close(); });
  }
  function closeDetail() {
    if (dialog && dialog.open) dialog.close();
  }

  function render() {
    var root = document.getElementById('board');
    var filtered = filteredRows();
    var shown = state.tab === 'live' ? LIVE : sortedRows(filtered);
    var html = '<div class="shell">' + headerHtml() + ledeHtml() + controlsHtml();
    if (state.tab === 'live') html += liveTableHtml();
    else if (shown.length === 0) html += emptyHtml();
    else html += boardTableHtml(shown);
    html += modelPanelHtml();
    html += '</div>';
    root.innerHTML = html;
    root.setAttribute('aria-busy', 'false');
    var count = document.getElementById('count');
    if (count) count.textContent = state.tab === 'live' ? LIVE.length + ' live-token protocols' : shown.length + ' of ' + ROWS.length + ' rows';
    var q = document.getElementById('q');
    if (q && document.activeElement !== q) q.value = state.q;
  }
  function onInput() {
    var q = document.getElementById('q');
    if (q) state.q = q.value;
    writeHash();
    render();
    var next = document.getElementById('q');
    if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
  }
  function onChange(e) {
    var t = e.target;
    if (t.id === 'category') state.category = t.value;
    if (t.id === 'chain') state.chain = t.value;
    writeHash();
    render();
  }
  function onClick(e) {
    var t = e.target;
    var tab = t.closest ? t.closest('[data-tab]') : null;
    if (tab) {
      state.tab = tab.getAttribute('data-tab');
      writeHash();
      render();
      return;
    }
    var sort = t.closest ? t.closest('[data-sort]') : null;
    if (sort) {
      var key = sort.getAttribute('data-sort');
      if (state.sort === key) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
      else { state.sort = key; state.dir = key === 'name' ? 'asc' : 'desc'; }
      render();
      return;
    }
    if (t.id === 'reset') {
      state.q = ''; state.category = 'all'; state.chain = 'all';
      writeHash();
      render();
      return;
    }
    var row = t.closest ? t.closest('tr[data-slug]') : null;
    if (row) {
      state.selected = row.getAttribute('data-slug');
      writeHash();
      openDetail(state.selected);
      render();
    }
  }
  document.addEventListener('input', function (e) { if (e.target.id === 'q') onInput(); });
  document.addEventListener('change', onChange);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  window.addEventListener('hashchange', function () {
    readHash();
    render();
    if (state.selected) openDetail(state.selected);
  });

  readHash();
  render();
  if (state.selected) openDetail(state.selected);
})();
