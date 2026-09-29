import { prisma } from './db';

/**
 * KAIZEN Intelligence Engine — analyzes authorized, privacy-safe operational
 * data and generates evidence-based insights for principal review.
 *
 * Principles:
 * - Only aggregate/anonymized data; never exposes individual private records
 *   in insights unless the viewer is authorized for that scope.
 * - Every insight has: title, explanation, evidence, period, confidence.
 * - NEVER auto-applies changes — all insights require human review.
 */

interface InsightDraft {
  category: 'ATTENTION' | 'OPPORTUNITY' | 'POSITIVE' | 'OPTIMIZATION' | 'PERMISSION';
  title: string;
  explanation: string;
  evidence?: string;
  period?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function analyzeAttendance(schoolId: string): Promise<InsightDraft[]> {
  const insights: InsightDraft[] = [];
  const recent = daysAgo(14);
  const older = daysAgo(28);

  // Overall attendance rate: last 14 days vs previous 14 days.
  const [recentRows, olderRows] = await Promise.all([
    prisma.periodAttendance.groupBy({
      by: ['status'],
      where: { date: { gte: recent } },
      _count: { status: true },
    }),
    prisma.periodAttendance.groupBy({
      by: ['status'],
      where: { date: { gte: older, lt: recent } },
      _count: { status: true },
    }),
  ]);

  const rate = (rows: typeof recentRows) => {
    const total = rows.reduce((s, r) => s + r._count.status, 0);
    const present = rows.find((r) => r.status === 'PRESENT')?._count.status ?? 0;
    return total > 0 ? (present / total) * 100 : null;
  };

  const recentRate = rate(recentRows);
  const olderRate = rate(olderRows);

  if (recentRate !== null && olderRate !== null && recentRows.length > 50) {
    const delta = recentRate - olderRate;
    if (delta <= -5) {
      insights.push({
        category: 'ATTENTION',
        title: 'Attendance decline detected',
        explanation:
          `Overall student attendance has declined by ${Math.abs(delta).toFixed(1)} percentage points ` +
          `over the last two weeks. This may indicate timetable, seasonal, or engagement issues worth reviewing.`,
        evidence: `Last 14 days: ${recentRate.toFixed(1)}% present · Previous 14 days: ${olderRate.toFixed(1)}% present`,
        period: 'Last 28 days',
        confidence: Math.abs(delta) > 10 ? 'HIGH' : 'MEDIUM',
      });
    } else if (delta >= 5) {
      insights.push({
        category: 'POSITIVE',
        title: 'Attendance improving',
        explanation:
          `Overall student attendance has improved by ${delta.toFixed(1)} percentage points over the last two weeks.`,
        evidence: `Last 14 days: ${recentRate.toFixed(1)}% present · Previous 14 days: ${olderRate.toFixed(1)}% present`,
        period: 'Last 28 days',
        confidence: 'MEDIUM',
      });
    }
  }
  return insights;
}

async function analyzeFees(schoolId: string): Promise<InsightDraft[]> {
  const insights: InsightDraft[] = [];
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const vouchers = await prisma.feeVoucher.aggregate({
    where: { month, year },
    _sum: { totalAmount: true },
    _count: true,
  });
  const paidAgg = await prisma.payment.aggregate({
    where: {
      voucher: { month, year },
    },
    _sum: { amount: true },
  });

  const payable = vouchers._sum?.totalAmount ?? 0;
  const paid = paidAgg._sum?.amount ?? 0;
  if (payable > 0 && (vouchers._count ?? 0) > 20) {
    const collectionRate = (paid / payable) * 100;
    if (collectionRate < 60) {
      insights.push({
        category: 'ATTENTION',
        title: 'Low fee collection rate',
        explanation:
          `Only ${collectionRate.toFixed(0)}% of this month's fee target has been collected. ` +
          `Consider sending payment reminders to parents with outstanding balances.`,
        evidence: `Collected Rs. ${paid.toLocaleString()} of Rs. ${payable.toLocaleString()} (${vouchers._count} vouchers)`,
        period: `${year}-${String(month).padStart(2, '0')}`,
        confidence: 'HIGH',
      });
    }
  }
  return insights;
}

async function analyzeWorkflows(schoolId: string): Promise<InsightDraft[]> {
  const insights: InsightDraft[] = [];
  // Detect repeated manual notification patterns → suggest templates.
  const week = daysAgo(7);
  const notifCount = await prisma.notificationLog.count({
    where: { sentAt: { gte: new Date(week) } },
  });
  if (notifCount > 100) {
    insights.push({
      category: 'OPTIMIZATION',
      title: 'High notification volume',
      explanation:
        `${notifCount} notifications were sent in the last 7 days. If similar messages are sent repeatedly, ` +
        `creating reusable SMS/announcement templates could save office time.`,
      evidence: `${notifCount} notifications in 7 days`,
      period: 'Last 7 days',
      confidence: 'LOW',
    });
  }
  return insights;
}

/**
 * Runs all analyzers and stores new insights (deduplicating by title within 7 days).
 * Called by a scheduled job or manually by an admin.
 */
export async function generateInsights(schoolId: string): Promise<number> {
  const drafts = [
    ...(await analyzeAttendance(schoolId)),
    ...(await analyzeFees(schoolId)),
    ...(await analyzeWorkflows(schoolId)),
  ];

  let created = 0;
  for (const d of drafts) {
    const week = daysAgo(7);
    const dup = await prisma.intelligenceInsight.findFirst({
      where: {
        schoolId,
        title: d.title,
        createdAt: { gte: new Date(week) },
      },
      select: { id: true },
    });
    if (dup) continue;
    await prisma.intelligenceInsight.create({
      data: {
        schoolId,
        category: d.category,
        title: d.title,
        explanation: d.explanation,
        evidence: d.evidence ?? null,
        period: d.period ?? null,
        confidence: d.confidence,
        status: 'NEW',
      },
    });
    created++;
  }
  return created;
}
