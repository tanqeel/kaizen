'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@/components/ui';
import { Icon } from '@/components/icons';

interface Insight {
  id: string;
  category: string;
  title: string;
  explanation: string;
  evidence: string | null;
  period: string | null;
  confidence: string;
  status: string;
  createdAt: string;
  reviewedBy: { name: string } | null;
}

const CATEGORY_STYLE: Record<string, { label: string; icon: 'alert-triangle' | 'sparkles' | 'check' | 'info' | 'users'; cls: string }> = {
  ATTENTION: { label: 'Attention Needed', icon: 'alert-triangle', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  OPPORTUNITY: { label: 'Improvement Opportunity', icon: 'sparkles', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  POSITIVE: { label: 'Positive Trend', icon: 'check', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  OPTIMIZATION: { label: 'System Optimization', icon: 'info', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  PERMISSION: { label: 'Permission Suggestion', icon: 'users', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
};

export function IntelligenceClient() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load insights.');
      setInsights(data.insights ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalysis = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await fetch('/api/intelligence', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const review = async (id: string, status: 'REVIEWED' | 'DISMISSED' | 'IMPLEMENTED') => {
    try {
      const res = await fetch(`/api/intelligence/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update.');
    }
  };

  const counts = {
    ATTENTION: insights.filter((i) => i.category === 'ATTENTION' && i.status === 'NEW').length,
    OPPORTUNITY: insights.filter((i) => i.category === 'OPPORTUNITY' && i.status === 'NEW').length,
    POSITIVE: insights.filter((i) => i.category === 'POSITIVE' && i.status === 'NEW').length,
    OPTIMIZATION: insights.filter((i) => i.category === 'OPTIMIZATION' && i.status === 'NEW').length,
    PERMISSION: insights.filter((i) => i.category === 'PERMISSION' && i.status === 'NEW').length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(Object.keys(counts) as Array<keyof typeof counts>).map((cat) => {
          const style = CATEGORY_STYLE[cat];
          return (
            <Card key={cat}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{counts[cat]}</p>
                <p className="mt-1 text-xs text-slate-500">{style.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Button onClick={runAnalysis} disabled={running}>
          <Icon name="sparkles" size={16} /> {running ? 'Analyzing…' : 'Run Analysis'}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {insights.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No insights yet"
          guidance="Run an analysis to let the Intelligence Engine examine operational patterns and suggest improvements."
        />
      ) : (
        <div className="space-y-4">
          {insights.map((ins) => {
            const style = CATEGORY_STYLE[ins.category] ?? CATEGORY_STYLE.OPPORTUNITY;
            return (
              <Card key={ins.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>
                      <Icon name={style.icon} size={12} /> {style.label}
                    </span>
                    <Badge variant={ins.confidence === 'HIGH' ? 'present' : ins.confidence === 'LOW' ? 'pending' : 'info'}>
                      {ins.confidence} confidence
                    </Badge>
                    {ins.status !== 'NEW' && <Badge variant="neutral">{ins.status}</Badge>}
                  </div>
                  <CardTitle className="mt-2">{ins.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{ins.explanation}</p>
                  {ins.evidence && (
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-800">
                      <p className="font-semibold text-slate-500 uppercase tracking-wide">Evidence</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">{ins.evidence}</p>
                      {ins.period && <p className="mt-1 text-slate-500">Period: {ins.period}</p>}
                    </div>
                  )}
                  <details className="mt-3 text-xs text-slate-500">
                    <summary className="cursor-pointer font-medium">Why am I seeing this?</summary>
                    <p className="mt-1">
                      The Intelligence Engine analyzed aggregate operational data ({ins.period ?? 'recent period'})
                      and detected this pattern with {ins.confidence.toLowerCase()} confidence. No individual
                      private records were exposed in this analysis. This is a recommendation only — it changes
                      nothing until you review and approve it.
                    </p>
                  </details>
                  {ins.status === 'NEW' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => review(ins.id, 'REVIEWED')}>
                        <Icon name="check" size={14} /> Mark Reviewed
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => review(ins.id, 'IMPLEMENTED')}>
                        Implemented
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => review(ins.id, 'DISMISSED')}>
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      {ins.status} {ins.reviewedBy ? `by ${ins.reviewedBy.name}` : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
