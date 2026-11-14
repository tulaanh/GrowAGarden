import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wateringDeadline } from '../lib/watering-clock.ts';

test('watering countdown uses the server interval despite a device clock mismatch', () => {
 const server = '2026-11-14T10:00:00Z';
 assert.equal(wateringDeadline('2026-11-14T10:00:45Z', server, 1_000_000), 1_045_000);
 assert.equal(wateringDeadline('2026-11-14T10:00:45Z', server, -1_000_000), -955_000);
});
test('watering countdown rejects missing, expired or invalid server times', () => {
 assert.equal(wateringDeadline(undefined, undefined, 1000), null);
 assert.equal(wateringDeadline('2026-11-14T10:00:00Z', '2026-11-14T10:00:00Z', 1000), null);
 assert.equal(wateringDeadline('2026-11-14T10:02:00Z', '2026-11-14T10:00:00Z', 1000), 121000);
});
