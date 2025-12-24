#!/usr/bin/env node
/*
 * Check SSL / TLS details for a given host and port (default: 443).
 * Usage: node scripts/check_ssl.cjs the-huddle.co [443]
 */
const tls = require('tls');
const { promisify } = require('util');
const dns = require('dns');
const { argv } = require('process');

async function lookup(host) {
  try {
    const { address } = await promisify(dns.lookup)(host);
    return address;
  } catch (e) {
    return null;
  }
}

function printCertInfo(cert) {
  if (!cert) return console.log('No certificate received.');

  console.log('Subject CN:', cert.subject.CN || '(none)');
  console.log('Issuer:', cert.issuer.CN || '(unknown)');
  console.log('Valid from:', cert.valid_from);
  console.log('Valid to:', cert.valid_to);
  console.log('SANs:', (cert.subjectaltname || '').replace(/DNS:/g, '').trim());
  console.log('Fingerprint (sha256):', cert.fingerprint256);
  if (cert.raw) {
    // show serial number if available
    console.log('Serial Number:', cert.serialNumber);
  }
}

async function main() {
  const host = argv[2];
  const port = parseInt(argv[3] || '443', 10);
  if (!host) {
    console.error('Usage: node scripts/check_ssl.cjs <host> [port]');
    process.exit(2);
  }

  console.log(`Checking ${host}:${port}`);
  const ip = await lookup(host);
  if (ip) console.log('Resolved IP:', ip);

  const options = {
    host,
    port,
    servername: host,
    rejectUnauthorized: false,
    timeout: 5000,
  };

  const socket = tls.connect(options, function () {
    const cert = this.getPeerCertificate(true);
    console.log('\n--- TLS Connection OK ---');
    console.log('Protocol:', this.getProtocol());
    printCertInfo(cert);
    this.end();
    process.exit(0);
  });

  socket.on('error', (err) => {
    console.error('\nTLS error:', err.message);
    process.exit(1);
  });
  socket.on('timeout', () => {
    console.error('\nTLS error: timeout');
    socket.destroy();
    process.exit(1);
  });
}

main();
