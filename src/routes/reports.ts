/**
 * routes/reports.ts
 *
 * POST /api/reports/generate  (requireParent + ownership)
 *   - Rate-limited: 5 per child per day
 *   - Returns cached report if exists for same child+period+language
 *   - Returns { insufficient_data: true } if < 3 verified sessions
 *   - Otherwise builds prompt, calls watsonx, stores ai_reports row
 *
 * GET  /api/reports/:childId   (requireParent + ownership)
 *   - Returns latest report for the child (optional ?lang=en|hi)
 */

import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireParent } from '../middleware/authMiddleware';
import { assertOwnership } from '../lib/ownership';
import { buildReportInput } from '../services/reportBuilder';
import { generateReport } from '../services/watsonxService';

const router = Router();
router.use(requireParent);

// ── Rate limit: max 5 generate calls per child per day (in-memory, good enough for demo) ──

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_DAY = 5;

function checkRateLimit(childId: string): boolean {
  const now = Date.now();
  const key = childId;
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 86_400_000 });
    return true;
  }
  if (entry.count >= MAX_PER_DAY) return false;
  entry.count++;
  return true;
}

// ── GenerateSchema ─────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  child_id:   z.string().uuid(),
  period:     z.enum(['week', 'month']).default('month'),
  language:   z.enum(['en', 'hi']).default('en'),
});

// ── POST /api/reports/generate ─────────────────────────────────────────────────

router.post('/generate', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const parse = GenerateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: parse.error.errors[0]?.message ?? 'Validation error' });
    return;
  }

  const { child_id, period, language } = parse.data;

  if (!await assertOwnership(parentId, child_id, res)) return;

  // Rate limit
  if (!checkRateLimit(child_id)) {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Report generation limit reached for today (5 per child per day).' },
    });
    return;
  }

  const now = new Date();
  const periodStart = new Date(now);
  if (period === 'week') {
    periodStart.setDate(periodStart.getDate() - 7);
  } else {
    periodStart.setDate(periodStart.getDate() - 30);
  }

  // Fetch child age
  const child = await prisma.child.findUnique({
    where: { id: child_id },
    select: { age: true },
  });
  if (!child) { res.status(404).json({ error: 'Child not found' }); return; }

  // Check for existing cached report in the same period window (within 1 hour)
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const cached = await prisma.aiReport.findFirst({
    where: {
      child_id,
      language,
      generated_at: { gte: oneHourAgo },
      period_start: { gte: periodStart },
    },
    orderBy: { generated_at: 'desc' },
    select: {
      id: true, generated_at: true, language: true,
      report_text: true, summary: true, weak_areas: true,
      activities: true, is_mock: true, model_id: true,
    },
  });

  if (cached) {
    res.json({ cached: true, report: cached });
    return;
  }

  // Build prompt
  const buildResult = await buildReportInput(
    child_id, child.age, periodStart, now, language,
  );

  if (buildResult.insufficient_data) {
    res.json({ insufficient_data: true });
    return;
  }

  const { prompt } = buildResult;

  // Call watsonx (falls back to mock on any error)
  const watsonxResult = await generateReport(prompt.system, prompt.user, language);

  // Store result
  const report = await prisma.aiReport.create({
    data: {
      child_id,
      parent_id: parentId,
      language,
      period_start: periodStart,
      period_end: now,
      report_text: watsonxResult.report_text,
      summary:    watsonxResult.summary,
      weak_areas: watsonxResult.weak_areas,
      activities: watsonxResult.activities,
      prompt_used: `${prompt.system}\n---\n${prompt.user}`,
      is_mock:    watsonxResult.is_mock,
      model_id:   watsonxResult.model_id,
    },
    select: {
      id: true, generated_at: true, language: true,
      report_text: true, summary: true, weak_areas: true,
      activities: true, is_mock: true, model_id: true,
    },
  });

  res.status(201).json({ cached: false, report });
});

// ── GET /api/reports/:childId — latest report ─────────────────────────────────

router.get('/:childId', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.childId;
  const language = (req.query.lang === 'hi' ? 'hi' : 'en') as 'en' | 'hi';

  if (!await assertOwnership(parentId, childId, res)) return;

  const report = await prisma.aiReport.findFirst({
    where: { child_id: childId, language },
    orderBy: { generated_at: 'desc' },
    select: {
      id: true, generated_at: true, language: true,
      report_text: true, summary: true, weak_areas: true,
      activities: true, is_mock: true, model_id: true,
    },
  });

  res.json({ report: report ?? null });
});

export default router;
