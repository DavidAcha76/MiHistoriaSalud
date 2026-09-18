const { networkInterfaces } = require('node:os');

function getLanAddress() {
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !/tailscale|vethernet|virtual|vmware|docker|loopback|^tun|^tap|^utun|^bridge/i.test(name))
    .flatMap(([, addresses]) => addresses || [])
    .filter((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'));
  return candidates.find(({ address }) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address))?.address
    || candidates[0]?.address;
}

module.exports = { getLanAddress };
if (require.main === module) console.log(getLanAddress() || '127.0.0.1');
