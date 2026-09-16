import { useMemo, useState } from 'react';
import { CalendarDays, TrendingUp, FileText, Download, BarChart3 } from 'lucide-react';
import { useActivities } from '@/lib/data';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { Avatar } from '@/components/Avatar';
import {
  DEPARTMENTS,
  STATUS_LABELS,
  formatCurrency,
  formatDate,
  relativeTime,
} from '@/lib/constants';
import type { Activity } from '@/lib/types';

type Range = 'daily' | 'weekly' | 'monthly';

export function Reports() {
  const [range, setRange] = useState<Range>('daily');
  const [department, setDepartment] = useState('all');
  const { activities, loading } = useActivities(
    department !== 'all' ? { department } : undefined,
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (range === 'daily') cutoff.setDate(now.getDate() - 1);
    if (range === 'weekly') cutoff.setDate(now.getDate() - 7);
    if (range === 'monthly') cutoff.setMonth(now.getMonth() - 1);
    return activities.filter((a) => new Date(a.created_at) >= cutoff);
  }, [activities, range]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const byStatus: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    let funded = 0;
    filtered.forEach((a) => {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      byDepartment[a.department] = (byDepartment[a.department] ?? 0) + 1;
      if (a.status === 'approved' || a.status === 'completed') funded += a.amount ?? 0;
    });
    return { total, byStatus, byDepartment, funded };
  }, [filtered]);

  const rangeLabel =
    range === 'daily' ? 'Today & yesterday' : range === 'weekly' ? 'Past 7 days' : 'Past 30 days';

  function exportCsv() {
    const headers = ['Title', 'Department', 'Category', 'Status', 'Priority', 'Amount', 'Requester', 'Created'];
    const rows = filtered.map((a) => [
      a.title,
      a.department,
      a.category,
      a.status,
      a.priority,
      a.amount ?? '',
      a.requester?.full_name ?? '',
      formatDate(a.created_at),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zinariya-${range}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Automated daily, weekly, and monthly summaries across every office."
        action={
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-sand-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg bg-ink-100 p-1">
            {(['daily', 'weekly', 'monthly'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                  range === r ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-ink-500 sm:inline">{rangeLabel}</span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500"
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryStat icon={FileText} label="Total activities" value={String(summary.total)} tone="ink" />
        <SummaryStat
          icon={TrendingUp}
          label="Funded value"
          value={formatCurrency(summary.funded)}
          tone="field"
        />
        <SummaryStat
          icon={BarChart3}
          label="Departments active"
          value={String(Object.keys(summary.byDepartment).length)}
          tone="emerald"
        />
        <SummaryStat
          icon={CalendarDays}
          label="Window"
          value={rangeLabel}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink-900">Activity log</h2>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No activities in this window"
              message="Try widening the range or selecting all departments."
            />
          ) : (
            <div className="max-h-[60vh] divide-y divide-ink-100 overflow-y-auto scrollbar-thin sm:max-h-[480px]">
              {filtered.map((a) => (
                <ReportRow key={a.id} activity={a} />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="border-b border-ink-100 px-5 py-4">
              <h2 className="font-display text-sm font-semibold text-ink-900">By status</h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const count = summary.byStatus[key] ?? 0;
                const pct = summary.total ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-700">{label}</span>
                      <span className="text-ink-400">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-field-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="border-b border-ink-100 px-5 py-4">
              <h2 className="font-display text-sm font-semibold text-ink-900">By department</h2>
            </div>
            <div className="space-y-2 px-5 py-4">
              {DEPARTMENTS.map((d) => {
                const count = summary.byDepartment[d] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={d} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700">{d}</span>
                    <span className="font-semibold text-ink-900">{count}</span>
                  </div>
                );
              })}
              {Object.keys(summary.byDepartment).length === 0 && (
                <p className="py-4 text-center text-xs text-ink-500">No data.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: 'ink' | 'amber' | 'emerald' | 'field';
}) {
  const tones = {
    ink: 'bg-ink-100 text-ink-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    field: 'bg-field-100 text-field-700',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
          <p className="mt-1.5 truncate font-display text-base font-semibold text-ink-900 sm:text-lg">{value}</p>
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function ReportRow({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <Avatar profile={activity.requester} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{activity.title}</p>
        <p className="truncate text-xs text-ink-500">
          {activity.department} · {activity.category} · {relativeTime(activity.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <PriorityBadge priority={activity.priority} />
        <StatusBadge status={activity.status} />
      </div>
    </div>
  );
}
