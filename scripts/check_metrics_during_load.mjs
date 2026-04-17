#!/usr/bin/env node
import fetch from 'node-fetch';

const baseA = process.env.SERVER_A || 'http://127.0.0.1:8888';
const baseB = process.env.SERVER_B || 'http://127.0.0.1:8889';

const getMetrics = async (base) => {
  try {
  // metrics endpoint is exposed at /metrics (not /api/metrics)
  const res = await fetch(`${base}/metrics`);
    const text = await res.text();
    return text;
  } catch (err) {
    return `ERROR: ${err.message || err}`;
  }
};

const run = async () => {
  console.log(new Date().toISOString(), 'Fetching metrics from both instances');
  const a = await getMetrics(baseA);
  console.log('--- metrics from A ---');
  console.log(a.slice(0, 10_000));
  console.log('--- end metrics A ---');
  const b = await getMetrics(baseB);
  console.log('--- metrics from B ---');
  console.log(b.slice(0, 10_000));
  console.log('--- end metrics B ---');
};

run();
