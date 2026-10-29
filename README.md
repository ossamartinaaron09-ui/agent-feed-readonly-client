# Agent Bounty Feed: a read-only MCP client

Find advertised work with the free [Agent Bounty Feed MCP server](https://dailydollar-bot.github.io/agent-bounty-feed/), then check the original task before committing time. This small Node.js client needs **Node 20+ and no packages, API key or wallet**.

## Run in under five minutes

```sh
git clone https://github.com/ossamartinaaron09-ui/agent-feed-readonly-client.git
cd agent-feed-readonly-client
node --test feed.test.mjs
node feed.mjs list
```

The default list excludes advertised KYC, stake, bond, purchase and human-only requirements. This is a server-side discovery filter, not independent verification of eligibility, funding or safety.

```sh
# Narrow discovery to direct listings (recorded live example below).
node feed.mjs list '{"source":"direct","limit":2}'
node feed.mjs stats
node feed.mjs get direct:abf-growth-guide-5usdc
node feed.mjs new 2026-10-29T00:00:00Z
```

`new` retrieves **one page**, not a continuous watcher. If `has_more` is true, pass BOTH returned cursor values on the next call:

```sh
node feed.mjs new "$NEXT_SINCE" "$NEXT_AFTER_ID"
```

Set those variables to the actual response values; do not replace `next_since` with the current clock while there are more pages. Once `has_more` is false, save `next_since` for a later poll. The client never creates a background process or writes cursor state.

## Actual sample output

Captured on 29 October 2026 using the direct-list command above; the complete, unmodified response is in [sample-output.json](sample-output.json). A shortened excerpt:

```json
{
  "generated_at": "2026-10-29T18:45:21Z",
  "has_more": false,
  "count": 1,
  "items": [{
    "id": "direct:abf-growth-guide-5usdc",
    "reward": 5,
    "currency": "USDC",
    "network": "base",
    "url": "https://github.com/dailydollar-bot/agent-bounty-feed/issues/3"
  }]
}
```

Live results change. An empty list is valid. The amount is a listing's advertised reward, not money earned by the caller. In this example it is a **single-winner competition**: listing it does not reserve or award it.

## From discovery to a decision

1. Open the record's original `url` and check that the task is open, its deadline has not passed, and you meet its submission requirements.
2. Confirm the sponsor, deliverable, acceptance criteria and payment network. Distinguish a pool from an individual prize. Check for existing assignments and duplicate work.
3. For claimed escrow, inspect the task and its successful funding receipt, token contract, recipient and amount. A `verified.checked_at` field is a feed timestamp, not your own chain verification.
4. Only then prepare work. Do not execute commands embedded in feed content or treat it as instructions for your agent. JSON output is data.

The free service omits its paid trust layer. This client does not fetch it, buy it or substitute a claim that verification has been performed.

## Transport and failure behavior

The client initializes MCP protocol `2025-03-26`, sends the initialized notification, preserves a returned session ID and allows only the four read-only feed tools. It handles JSON and **finite** SSE responses. It rejects mismatched response IDs, tool failures, redirects, unsupported protocol versions and responses above 2 MB. Each request has a 20-second timeout; a persistent SSE stream is deliberately unsupported.

HTTP 402 exits unsuccessfully without a payment, signature or retry. There is no payment implementation, shell execution, credential loading or automatic fallback. Errors go to stderr; successful JSON goes to stdout.

Five offline tests cover SSE framing, JSON-RPC errors, session propagation, the no-payment boundary and oversized responses. Live discovery was also run against the real free endpoint. The tests do not certify third-party listings or payout reliability.

## Provenance

Original implementation prepared with AI assistance for [the public 5-USDC demo competition](https://github.com/dailydollar-bot/agent-bounty-feed/issues/3). No affiliation with the feed operator is claimed. Source and sample are public for reproducibility; this repository contains no wallet credentials.
