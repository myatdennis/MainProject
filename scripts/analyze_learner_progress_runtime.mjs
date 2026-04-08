import 'dotenv/config';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const port = Number(process.env.LEARNER_PROGRESS_ANALYSIS_PORT || 8921);
const apiBase = `http://127.0.0.1:${port}`;
const analysisE2EMode = String(process.env.ANALYSIS_E2E_MODE || 'false').toLowerCase() === 'true';
const fixedLearnerId = process.env.ANALYSIS_LEARNER_ID || null;
const fixedLearnerEmail = process.env.ANALYSIS_LEARNER_EMAIL || null;

const requiredJwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const normalizedUrl = String(process.env.SUPABASE_URL || 'http://localhost').replace(/\/+$/, '');
const issuer = `${normalizedUrl}/auth/v1`;

if (!requiredJwtSecret) {
	throw new Error('Missing JWT secret. Set SUPABASE_JWT_SECRET or JWT_ACCESS_SECRET or JWT_SECRET.');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, p) => {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
	return Number(sorted[index].toFixed(2));
};

const createAuthHeaders = ({ userId, email, role, platformRole = null }) => {
	const token = jwt.sign(
		{
			sub: userId,
			email,
			role,
			app_metadata: { platform_role: platformRole },
			iss: issuer,
			aud: 'authenticated',
		},
		requiredJwtSecret,
		{ algorithm: 'HS256', expiresIn: '15m' },
	);

	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'x-user-id': userId,
		'x-user-role': role,
	};
};

const adminHeaders = () =>
	createAuthHeaders({
		userId: process.env.TEST_PLATFORM_ADMIN_ID || '00000000-0000-0000-0000-000000000001',
		email: process.env.TEST_PLATFORM_ADMIN_EMAIL || 'integration-admin@local',
		role: 'admin',
		platformRole: 'platform_admin',
	});

const learnerHeaders = (userId, email) =>
	createAuthHeaders({
		userId,
		email,
		role: 'member',
	});

const fetchJson = async (path, init = {}) => {
	const started = performance.now();
	const response = await fetch(`${apiBase}${path}`, init);
	const durationMs = Number((performance.now() - started).toFixed(2));
	const text = await response.text();
	let body = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}
	return { response, durationMs, body };
};

const waitForHealth = async () => {
	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${apiBase}/api/health`);
			if (res.ok || res.status === 503) return;
		} catch {
			// ignore
		}
		await wait(150);
	}
	throw new Error('Server did not become healthy in time');
};

const parseJsonLines = (rawLogs) => {
	const events = [];
	for (const line of rawLogs.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) continue;
		try {
			events.push(JSON.parse(trimmed));
		} catch {
			// ignore non-json lines
		}
	}
	return events;
};

const buildProgressPayload = ({ userId, courseId, lessonId, progressPercent, totalTimeSeconds }) => ({
	userId,
	courseId,
	lessonIds: [lessonId],
	lessons: [
		{
			lessonId,
			progressPercent,
			completed: progressPercent >= 100,
			positionSeconds: Math.max(0, Math.floor((progressPercent / 100) * 120)),
			lastAccessedAt: new Date().toISOString(),
		},
	],
	course: {
		percent: progressPercent,
		totalTimeSeconds,
		lastLessonId: lessonId,
		completedAt: progressPercent >= 100 ? new Date().toISOString() : null,
	},
});

const run = async () => {
	const stdoutChunks = [];
	const stderrChunks = [];

	const child = spawn(process.execPath, ['server/index.js'], {
		cwd: process.cwd(),
		env: {
			...process.env,
			PORT: String(port),
			NODE_ENV: analysisE2EMode ? 'test' : process.env.NODE_ENV || 'development',
			E2E_TEST_MODE: analysisE2EMode ? 'true' : 'false',
			DEV_FALLBACK: 'false',
			DEMO_MODE: 'false',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	child.stdout.on('data', (chunk) => stdoutChunks.push(chunk.toString()));
	child.stderr.on('data', (chunk) => stderrChunks.push(chunk.toString()));

	const stopServer = async () => {
		if (child.killed) return;
		child.kill('SIGTERM');
		await Promise.race([
			new Promise((resolve) => child.once('exit', resolve)),
			wait(3000),
		]);
		if (!child.killed) {
			child.kill('SIGKILL');
		}
	};

	try {
		await waitForHealth();

		const slug = `progress-analysis-${Date.now()}`;
		const moduleId = randomUUID();
		const lessonId = randomUUID();
		const learnerId = fixedLearnerId || randomUUID();
		const learnerEmail = fixedLearnerEmail || `analysis+${slug}@example.com`;

		const createCourseRes = await fetchJson('/api/admin/courses', {
			method: 'POST',
			headers: adminHeaders(),
			body: JSON.stringify({
					course: {
						title: `Progress Analysis ${slug}`,
						slug,
						status: 'draft',
						description:
							'This is a runtime analysis draft course used to validate learner progress save performance behavior.',
					},
				modules: [
					{
						id: moduleId,
						title: 'Analysis Module',
						lessons: [
							{
								id: lessonId,
								title: 'Analysis Lesson',
								type: 'text',
									content_json: {
										textContent:
											'Learner progress runtime analysis content body for validation of post-fix behavior and timings.',
									},
							},
						],
					},
				],
			}),
		});

		if (![200, 201].includes(createCourseRes.response.status)) {
			throw new Error(`Course create failed: ${JSON.stringify(createCourseRes.body)}`);
		}

		const courseId = createCourseRes.body?.data?.id;
		if (!courseId) {
			throw new Error(`Missing course id from create response: ${JSON.stringify(createCourseRes.body)}`);
		}

		const requestTraces = [];
		const progressEndpoint = '/api/learner/progress';

		for (let i = 0; i < 25; i += 1) {
			const percent = Math.min(100, (i + 1) * 4);
			const payload = buildProgressPayload({
				userId: learnerId,
				courseId,
				lessonId,
				progressPercent: percent,
				totalTimeSeconds: (i + 1) * 8,
			});
			const startedAt = Date.now();
			const res = await fetchJson(progressEndpoint, {
				method: 'POST',
				headers: learnerHeaders(learnerId, learnerEmail),
				body: JSON.stringify(payload),
			});
			requestTraces.push({
				startedAt,
				userId: learnerId,
				courseId,
				status: res.response.status,
				ok: res.response.ok,
				durationMs: res.durationMs,
						code: res.body?.code ?? null,
			});
			await wait(40);
		}

		for (let burst = 0; burst < 8; burst += 1) {
			const percent = Math.min(100, 70 + burst * 3);
			const burstCalls = Array.from({ length: 3 }).map(async () => {
				const payload = buildProgressPayload({
					userId: learnerId,
					courseId,
					lessonId,
					progressPercent: percent,
					totalTimeSeconds: 300 + burst,
				});
				const startedAt = Date.now();
				const res = await fetchJson(progressEndpoint, {
					method: 'POST',
					headers: learnerHeaders(learnerId, learnerEmail),
					body: JSON.stringify(payload),
				});
				return {
					startedAt,
					userId: learnerId,
					courseId,
					status: res.response.status,
					ok: res.response.ok,
					durationMs: res.durationMs,
							code: res.body?.code ?? null,
				};
			});

			const burstResults = await Promise.all(burstCalls);
			requestTraces.push(...burstResults);
			await wait(25);
		}

		await wait(500);
		await stopServer();

		const rawLogs = `${stdoutChunks.join('')}\n${stderrChunks.join('')}`;
		const jsonEvents = parseJsonLines(rawLogs);

		const timingEvents = jsonEvents.filter((event) => event?.message === 'learner_progress_snapshot_timing');
		const failureEvents = jsonEvents.filter((event) => event?.message === 'learner_progress_snapshot_failed');
		const detectSupportFailures = jsonEvents.filter((event) => {
			const haystack = JSON.stringify(event || {});
			return haystack.includes('detectCourseUuidSupport');
		});

		const successTimings = timingEvents.filter((event) => event?.event === 'success');
		const errorTimings = timingEvents.filter((event) => event?.event === 'error');
			const modeCounts = successTimings.reduce((acc, event) => {
				const mode = String(event?.mode || 'unknown');
				acc[mode] = (acc[mode] || 0) + 1;
				return acc;
			}, {});

		const totalMsValues = successTimings.map((event) => Number(event?.totalMs)).filter(Number.isFinite);
		const dbWriteMsValues = successTimings.map((event) => Number(event?.dbWriteMs)).filter(Number.isFinite);
		const snapshotInitMsValues = successTimings.map((event) => Number(event?.snapshotInitMs)).filter(Number.isFinite);
		const schemaDetectionMsValues = successTimings
			.map((event) => Number(event?.schemaDetectionMs))
			.filter(Number.isFinite);

		const schemaDetectionNonZero = schemaDetectionMsValues.filter((value) => value > 0).length;
		const snapshotInitNonTrivialThresholdMs = 10;
		const snapshotInitNonTrivialCount = snapshotInitMsValues.filter(
			(value) => value >= snapshotInitNonTrivialThresholdMs,
		).length;

		const requestCount = timingEvents.length;
		const successCount = successTimings.length;
		const failureCount = errorTimings.length;

		const sortedRequestTraces = [...requestTraces].sort((a, b) => a.startedAt - b.startedAt);
		let closeDuplicateCount = 0;
		const closeDuplicateThresholdMs = 20;
		for (let i = 1; i < sortedRequestTraces.length; i += 1) {
			const previous = sortedRequestTraces[i - 1];
			const current = sortedRequestTraces[i];
			if (previous.userId === current.userId && previous.courseId === current.courseId) {
				const delta = current.startedAt - previous.startedAt;
				if (delta <= closeDuplicateThresholdMs) {
					closeDuplicateCount += 1;
				}
			}
		}

		const output = {
			ok: true,
			generatedAt: new Date().toISOString(),
			requestGeneration: {
				generatedWrites: requestTraces.length,
				generatedSuccesses: requestTraces.filter((trace) => trace.ok).length,
				generatedFailures: requestTraces.filter((trace) => !trace.ok).length,
					statusCounts: requestTraces.reduce((acc, trace) => {
						const key = String(trace.status);
						acc[key] = (acc[key] || 0) + 1;
						return acc;
					}, {}),
					errorCodeCounts: requestTraces
						.filter((trace) => !trace.ok)
						.reduce((acc, trace) => {
							const key = String(trace.code || 'unknown');
							acc[key] = (acc[key] || 0) + 1;
							return acc;
						}, {}),
			},
			metrics: {
				requestCount,
				successCount,
				failureCount,
				totalMs: {
					p50: percentile(totalMsValues, 50),
					p95: percentile(totalMsValues, 95),
				},
				dbWriteMs: {
					p50: percentile(dbWriteMsValues, 50),
					p95: percentile(dbWriteMsValues, 95),
				},
				snapshotInitMs: {
					nonTrivialThresholdMs: snapshotInitNonTrivialThresholdMs,
					nonTrivialCount: snapshotInitNonTrivialCount,
					nonTrivialPct: requestCount ? Number(((snapshotInitNonTrivialCount / requestCount) * 100).toFixed(2)) : 0,
				},
				schemaDetectionMs: {
					nonZeroCount: schemaDetectionNonZero,
					appearsOnNormalRequests: schemaDetectionNonZero > 0,
				},
				duplicateSaves: {
					thresholdMs: closeDuplicateThresholdMs,
					closeDuplicateCount,
				},
				errors: {
					learnerProgressFailedEvents: failureEvents.length,
					detectCourseUuidSupportMentions: detectSupportFailures.length,
							firstFailure: failureEvents[0]
								? {
										failingFunction: failureEvents[0].failingFunction ?? null,
										dbErrorCode: failureEvents[0].dbErrorCode ?? null,
										dbErrorMessage: failureEvents[0].dbErrorMessage ?? null,
										dbErrorDetails: failureEvents[0].dbErrorDetails ?? null,
										dbErrorHint: failureEvents[0].dbErrorHint ?? null,
									}
								: null,
				},
						modeCounts,
			},
		};

		console.log(JSON.stringify(output, null, 2));
	} catch (error) {
		await stopServer();
		console.error(
			JSON.stringify(
				{
					ok: false,
					message: error instanceof Error ? error.message : String(error),
				},
				null,
				2,
			),
		);
		process.exitCode = 1;
	}
};

run();
