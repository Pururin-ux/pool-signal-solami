export const WINDOW_MS = 5 * 60 * 1000;

export function decimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function eventTime(event, receivedAt) {
  const seconds = decimal(event.block_time ?? event.trigger_time);
  if (seconds === null || seconds <= 0) return receivedAt;
  const milliseconds = seconds * 1000;
  // Some providers can return delayed or malformed timestamps. Never let a
  // future timestamp keep an event permanently inside the rolling window.
  return milliseconds <= receivedAt + 30_000 ? milliseconds : receivedAt;
}

export function eventId(event) {
  if (typeof event.signature !== 'string' || !event.signature) return null;
  return [event.type, event.signature, event.pool ?? '', event.mint ?? '', event.side ?? '', event.slot ?? '', event.base_amount ?? '', event.quote_amount ?? '', event.kind ?? ''].join(':');
}

export function windowMetrics(events, now) {
  let buy = 0, sell = 0, swaps = 0, removals = 0;
  const cutoff = now - WINDOW_MS;
  for (const item of events) {
    if (item.at < cutoff || item.at > now + 30_000) continue;
    const event = item.event;
    if (event.type === 'swap') {
      swaps++;
      const usd = decimal(event.volume_usd);
      if (usd !== null && usd >= 0) {
        if (event.side === 'buy') buy += usd;
        else if (event.side === 'sell') sell += usd;
      }
    } else if (event.type === 'liquidity' && event.kind === 'remove') {
      removals++;
    }
  }
  return { buy, sell, volume: buy + sell, swaps, removals, ratio: sell > 0 ? buy / sell : null };
}

export function pricePoints(events, now, maxPoints = 60) {
  return events.filter(item => item.at >= now - WINDOW_MS && item.event.type === 'swap')
    .map(item => decimal(item.event.price_usd))
    .filter(price => price !== null && price > 0).slice(-maxPoints);
}
