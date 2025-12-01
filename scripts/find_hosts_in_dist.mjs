#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const HOSTS_TO_CHECK = [
	'api.the-huddle.co',
	'the-huddle.co',
	'the-huddle.herokuapp.com',
	'VITE_API_BASE_URL',
	'VITE_API_URL',
];

function exitWithError(msg) {
	console.error(msg);
	process.exitCode = 1;
}

if (!fs.existsSync(DIST_DIR)) {
	exitWithError(`[find_hosts_in_dist] Directory not found: ${DIST_DIR}`);
	process.exit(1);
}

const results = [];
function scanFile(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		HOSTS_TO_CHECK.forEach(host => {
			if (content.includes(host)) {
				results.push({ file: filePath, host });
			}
		});
	} catch (e) {
		console.warn('[find_hosts_in_dist] Failed to read', filePath, e.message);
	}
}

function walk(dir) {
	const items = fs.readdirSync(dir, { withFileTypes: true });
	for (const item of items) {
		const fullPath = path.join(dir, item.name);
		if (item.isDirectory()) walk(fullPath);
		else scanFile(fullPath);
	}
}

walk(DIST_DIR);

if (results.length > 0) {
	console.error('[find_hosts_in_dist] Found deprecated host references in dist:');
	results.forEach(r => {
		console.error(` - ${r.host} referenced in ${path.relative(process.cwd(), r.file)}`);
	});
	console.error('\nThis usually indicates an old build or a hard-coded API base URL.\n' +
		'Ensure VITE_API_BASE_URL is set correctly during build, clear caches, and rebuild.');
	process.exit(2);
} else {
	console.log('[find_hosts_in_dist] No deprecated host references found.');
}
