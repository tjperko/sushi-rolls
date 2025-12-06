#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCE = path.join(__dirname, '..', 'data', 'menu.csv');
const SOURCE = process.env.MENU_FEED_URL || process.env.FEED_URL || process.argv[2] || DEFAULT_SOURCE;
const OUTPUT_PATH = path.resolve(process.env.MENU_OUTPUT_PATH || process.argv[3] || path.join(__dirname, '..', 'data', 'menu.json'));

async function readSource(source) {
  const isRemote = /^https?:\/\//i.test(source);

  if (isRemote) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status} ${response.statusText}) for ${source}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const asText = await response.text();
    const isCsv = contentType.includes('text/csv') || source.toLowerCase().endsWith('.csv');
    return parseFeed(asText, isCsv);
  }

  const absolutePath = path.resolve(source);
  const text = await fs.promises.readFile(absolutePath, 'utf8');
  const isCsv = source.toLowerCase().endsWith('.csv');
  return parseFeed(text, isCsv);
}

function parseFeed(raw, isCsv) {
  if (isCsv) {
    return parseCsv(raw);
  }

  try {
    const payload = JSON.parse(raw);
    return normalizePayload(payload);
  } catch (error) {
    throw new Error(`Unable to parse feed JSON: ${error.message}`);
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    throw new Error('CSV feed is empty');
  }

  const headers = splitCsvLine(lines.shift()).map(header => header.trim());
  const rows = lines.map(splitCsvLine);

  const items = rows.map(row => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = row[index] ?? '';
    });
    return entry;
  });

  return normalizePayload({ items });
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(value => value.trim());
}

function normalizePayload(payload) {
  if (!payload) {
    throw new Error('Feed payload was empty');
  }

  const items = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    throw new Error('No menu items found in feed');
  }

  const updatedAt = payload.updatedAt || payload.lastUpdated || payload.meta?.updatedAt || latestUpdatedAt(items) || new Date().toISOString();

  const normalizedItems = items.map(item => ({
    name: (item.name || '').trim(),
    sku: (item.sku || '').trim(),
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
    pill: (item.pill || '').trim(),
    description: (item.description || '').trim(),
    image: (item.image || '').trim(),
    imageAlt: item.imageAlt ? item.imageAlt.trim() : undefined,
  }));

  return { updatedAt, items: normalizedItems };
}

function latestUpdatedAt(items = []) {
  const timestamps = items
    .map(item => item.updatedAt || item.lastUpdated)
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date));

  if (!timestamps.length) return null;

  return new Date(Math.max(...timestamps.map(date => date.getTime()))).toISOString();
}

async function main() {
  try {
    const result = await readSource(SOURCE);
    await fs.promises.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.promises.writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`✅ Wrote ${result.items.length} menu items to ${OUTPUT_PATH}`);
    console.log(`ℹ️  Feed last updated at ${result.updatedAt}`);
  } catch (error) {
    console.error('❌ Unable to fetch menu data:', error.message);
    process.exitCode = 1;
  }
}

main();
