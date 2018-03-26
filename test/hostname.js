import assert from 'assert';
import { getClientId } from '../lib/clientId';

suite('hostname');

test('level 2', () => {
  assert.equal(getClientId('abc.example.com', 2), 'abc');
  assert.equal(getClientId('example.com', 2), null);
});

test('level 3', () => {
  assert.equal(getClientId('tunnel.example.com', 3), null);
  assert.equal(getClientId('abc.tunnel.example.com', 3), 'abc');
});
