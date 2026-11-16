# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Araara7/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Araara7/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: a Node 22 program that reads a frozen DefiLlama snapshot of 758 protocols, scores every pre-token protocol by implied value, and writes a ranked board plus a static dashboard with a farm plan for each row. No network, standard library only, fully deterministic — two runs produce byte-identical output.

## The model (radar-2)

Every row is scored by one function of the snapshot's own figures — no protocol name is ever special-cased:

```
implied = round( tvl_usd × category_multiple × growth × decline × maturity × chains )
```

- **category_multiple** — how much token value a dollar of TVL supports in that category (perpetuals 0.38, DEXs 0.32, RWA 0.30, yield 0.27, curators 0.27, lending 0.24, staking 0.22, bridges 0.14, default 0.25). The table is stated in the dashboard so the reader can disagree with it.
- **growth** — `1 + clamp(change_7d, −60, 120) / 100 × 0.6`, so a protocol growing 50% in a week scores 1.30× and one shrinking 50% scores 0.70×.
- **decline** — an extra `1 + change_7d / 100 × 0.3` when TVL is falling, so a shrinking protocol is penalised twice: once for the growth it lost, once for the direction.
- **maturity** — `0.5 + 0.5 × √(min(age_days, 1095) / 1095)`: value accrues fast in the first year with no token, then saturates. Age is the time since DefiLlama first listed the protocol; an unknown age uses 365 days.
- **chains** — `1 + 0.03 × min(chains − 1, 5)`: a protocol live on several chains earns up to 1.15× for diversification.

The board covers all 40 watchlist protocols plus every other pre-token protocol below the $50M floor that could plausibly launch a token of its own — 183 rows. Wrapped, staked and bridged products of tokens that already trade, centralised exchanges and versioned pools are left out on purpose: they are not protocols waiting on a launch of their own. Live-token protocols are set aside in their own view with their market caps shown, never mixed into the ranking.

## The farm plan

Every row carries an 8-step plan generated from its own record — category, chain, TVL and age — naming the action, the capital, the gas cost and the time for each step, including a second qualifying action and an unwind plan. No plan is a slogan: the numbers change with the protocol.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Requires Node 22.18 or later. Reads the snapshot, writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the output directory, then `dossier.json`. Run it twice and the outputs are byte-identical.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r0ep5n4y&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
