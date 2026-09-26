# Pool Signal

A read-only, live Solana market dashboard powered by [Solami Blur](https://solami.dev/docs/blur). It watches one token mint through a filtered WebSocket subscription and shows a rolling five-minute view of observed swaps, USD volume, buy/sell pressure, liquidity removals, price points, source transactions, and feed health.

The central design choice is **visible uncertainty**: a silent or interrupted feed does not imply a silent market. Metrics describe events this browser received, not an authoritative historical index.

## Run

Requirements: a modern browser and a [Solami](https://solami.dev/) API key with the `DataApi` permission. The Data API permission must be assigned to the key through a role; a key with “No roles” receives HTTP 403 on Blur even if it can use RPC.

1. Clone this repository.
2. Run `npm run serve` and open `http://127.0.0.1:8765`, or host the static files on any HTTPS static site.
3. Paste your Solami API key into the form. The default token is the [JUP mint](https://discuss.jup.ag/t/jup-minting-and-accountability/464); replace it with any Solana token mint.
4. Click **Connect live**. Wait for a matching swap. Open its Solscan transaction link to inspect the underlying chain record.
5. Optional: click **Record 2-minute live demo** while connected. The browser renders only public market data to a canvas and downloads a 125-second WebM video. It does not record the desktop, your key, or browser tabs.

There are **no environment variables** or backend secrets. The key is held only in the current browser connection and sent directly to `wss://ws.solami.dev/data/subscribe` as required by Solami's API. It is cleared from the input after connecting, never placed in local storage or a shareable page URL, and never committed. As with any browser API key, someone with access to your browser's network inspector can see their own connection URL. Use a dedicated, least-privilege key and revoke it when no longer needed.

## What it calculates

- WebSocket filter: `chain=solana`, `address=<mint>`, and `type=swap,liquidity,surge,radar,metadata`.
- The five-minute window is based on provider event time when valid; malformed or future timestamps fall back to receipt time. Old events fall outside the live window.
- Swap volume sums valid nonnegative `volume_usd` decimal strings for buy and sell events. Unknown-side or unpriced swaps remain in the swap count but not USD volume.
- Buy/sell ratio is buy USD volume divided by sell USD volume. When no sell volume is observed, it is shown as unavailable instead of infinity.
- Liquidity removals count `liquidity` events with `kind=remove`; this is an alert to inspect source context, not a judgment that a token is unsafe.
- The price trace uses valid positive `price_usd` points from observed swaps. It does not interpolate gaps.
- Transaction links are shown only for syntactically valid Solana signatures. All event text is rendered with `textContent`.
- A closed connection increments the session's gap counter and marks the observed totals incomplete. Reconnecting starts a new observation window.

## Verify

Run `npm test` for the arithmetic, timestamp, and deduplication checks. For live verification, a browser with a valid `DataApi` key must show **LIVE**, then signed source events; the dashboard should update on matching mainnet activity. A connection badge by itself does not prove data was received.

## Limits

This is not a full-chain indexer, trading bot, token safety score, or financial advice. Browser tabs can sleep, WebSockets can drop, and some events may arrive late or without a usable USD price. The dashboard never sends a transaction or requests a wallet signature.

## License

MIT. See [LICENSE](LICENSE).
