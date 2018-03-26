// @flow

const CHARS = 'abcdefghijklmnopqrstuvwxyz';

function isIpV4(hostname) {
  return /\d+\.\d+\.\d+\.\d+/.test(hostname);
}

export function getClientId(hostname /*: string */, level /*: number */ = 2) {
  if (isIpV4(hostname)) return null;
  const parts = hostname.split('.');
  return parts.slice(0, -level).join('.');
}

export function generateClientId() {
  let id = '';
  for (var i = 0; i < 10; ++i) {
    const rnd = Math.floor(Math.random() * CHARS.length);
    id += CHARS[rnd];
  }
  return id;
}
