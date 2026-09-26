import test from 'node:test';
import assert from 'node:assert/strict';
import { decimal, eventTime, eventId, windowMetrics, pricePoints, WINDOW_MS } from './metrics.js';

const now = 1_700_000_000_000;
test('decimal strings and missing values are distinct', () => {
  assert.equal(decimal('12.75'), 12.75);
  assert.equal(decimal(null), null);
  assert.equal(decimal('not-a-number'), null);
});
test('rolling window excludes expired events and ignores unpriced swaps in USD totals', () => {
  const events = [
    {at:now-1000,event:{type:'swap',side:'buy',volume_usd:'20'}},
    {at:now-2000,event:{type:'swap',side:'sell',volume_usd:'10'}},
    {at:now-3000,event:{type:'swap',side:'buy',volume_usd:null}},
    {at:now-4000,event:{type:'liquidity',kind:'remove'}},
    {at:now-WINDOW_MS-1,event:{type:'swap',side:'buy',volume_usd:'999'}}
  ];
  assert.deepEqual(windowMetrics(events,now),{buy:20,sell:10,volume:30,swaps:3,removals:1,ratio:2});
});
test('no sell observations do not become an infinite buy/sell ratio', () => {
  assert.equal(windowMetrics([{at:now,event:{type:'swap',side:'buy',volume_usd:'5'}}],now).ratio,null);
});
test('timestamp and chart retain only valid current price observations', () => {
  assert.equal(eventTime({block_time:now/1000},now),now);
  assert.equal(eventTime({block_time:(now+120000)/1000},now),now);
  assert.deepEqual(pricePoints([{at:now,event:{type:'swap',price_usd:'1.2'}},{at:now,event:{type:'swap',price_usd:'NaN'}},{at:now-WINDOW_MS-1,event:{type:'swap',price_usd:'3'}}],now),[1.2]);
});
test('signed swap ids distinguish different pools within one transaction', () => {
  assert.notEqual(eventId({type:'swap',signature:'abc',pool:'one'}),eventId({type:'swap',signature:'abc',pool:'two'}));
  assert.equal(eventId({type:'surge'}),null);
});
