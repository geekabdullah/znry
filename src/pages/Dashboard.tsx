import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  Users,
  Inbox,
  Package,
  Banknote,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useActivities, useProfiles, usePendingActions } from '@/lib/data';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { Avatar } from '@/components/Avatar';
import {
  DEPARTMENTS,
  formatCurrency,
  relativeTime,
  CHAIN_STAGE_LABELS,
  getActionableRole,
} from '@/lib/constants';
import type { Activity } from '@/lib/types';

export function Dashboard() {
  const { profile } = useAuth();
  const { activities, loading } = useActivities();
  const { profiles } = useProfiles();
  const { pending } = usePendingActions();

  const stats = useMemo(() => {
    const total = activities.length;
    const pendingCount = activities.filter(
      (a) => a.status === 'pending' || a.status === 'in_review' || a.status === 'approved',
    ).length;
    const completed = activities.filter((a) => a.status === 'completed').length;
    const totalValue = activities
      .filter((a) => a.status === 'approved' || a.status === 'completed')
      .reduce((sum, a) => sum + (a.amount ?? 0), 0);
    return { total, pendingCount, completed, totalValue };
  }, [activities]);

  const pendingForMe = useMemo(
    () =>
      pending.filter((a) => {
        const actionable = getActionableRole(a.chain_stage, a.disburser_role);
        if (!actionable) return false;
        if (actionable === 'md') return profile?.role === 'md';
        if (actionable === 'admin') return profile?.role === 'admin';
        if (actionable === 'storekeeper')
          return profile?.role === 'storekeeper' && profile?.department === a.department;
        if (actionable === 'manager')
          return profile?.role === 'manager' && profile?.department === a.department;
        if (actionable === 'supervisor')
          return profile?.role === 'supervisor' && (a.supervisor_id ? a.supervisor_id === profile?.id : profile?.department === a.department);
        return false;
      }),
    [pending, profile?.role, profile?.department],
  );

  const myItems = useMemo(
    () => activities.filter((a) => a.requester_id === profile?.id).slice(0, 5),
    [activities, profile?.id],
  );

  const byDepartment = useMemo(() => {
    const map = new Map<string, number>();
    DEPARTMENTS.forEach((d) => map.set(d, 0));
    activities.forEach((a) => map.set(a.department, (map.get(a.department) ?? 0) + 1));
    const max = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([d, c]) => ({ department: d, count: c, pct: Math.round((c / max) * 100) }));
  }, [activities]);

  if (loading) return <Spinner />;

  const canCreate = true;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? ''}`}
        subtitle="Here is what is moving across your section of Zinariya Farms today."
        action={
          canCreate ? (
            <Link
              to="/activities"
              className="inline-flex items-center gap-2 rounded-lg bg-field-600 px-4 py-2 text-sm font-semibold text-sand-50 transition hover:bg-field-700"
            >
              <Plus className="h-4 w-4" />
              New request
            </Link>
          ) : undefined
        }
      />

      {pendingForMe.length > 0 && (
        <Card className="mb-6 overflow-hidden border-field-200 bg-field-50/40">
          <div className="flex items-center justify-between border-b border-field-200/60 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-field-600 text-sand-50">
                <Inbox className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-field-900">
                  {pendingForMe.length} request{pendingForMe.length === 1 ? '' : 's'} need your action
                </h2>
                <p className="text-xs text-field-700">
                  These are waiting at your desk in the approval chain.
                </p>
              </div>
            </div>
            <Link to="/activities" className="text-xs font-semibold text-field-700 hover:underline">
              Go to inbox
            </Link>
          </div>
          <div className="divide-y divide-field-200/40">
            {pendingForMe.slice(0, 4).map((a) => (
              <Link
                key={a.id}
                to={`/activities/${a.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-field-50 sm:px-5"
              >
                <Avatar profile={a.requester} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                  <p className="truncate text-xs text-ink-500">
                    {a.department} · {relativeTime(a.created_at)}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-field-100 px-2.5 py-0.5 text-[11px] font-semibold text-field-700 sm:inline">
                  {CHAIN_STAGE_LABELS[a.chain_stage]}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-field-600" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visible to you" value={stats.total} icon={FileText} tone="ink" />
        <StatCard label="In the chain" value={stats.pendingCount} icon={Clock} tone="amber" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Funded value" value={formatCurrency(stats.totalValue)} icon={TrendingUp} tone="field" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink-900">Recent activity in your chain</h2>
            <Link to="/activities" className="text-xs font-semibold text-field-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-ink-100">
            {activities.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Nothing here yet"
                message="No requests are visible to your office right now."
              />
            ) : (
              activities.slice(0, 6).map((a) => <ActivityRow key={a.id} activity={a} />)
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="border-b border-ink-100 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-ink-900">By department</h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              {byDepartment.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">No activities yet.</p>
              ) : (
                byDepartment.map((d) => (
                  <div key={d.department}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-700">{d.department}</span>
                      <span className="text-ink-400">{d.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-field-500 transition-all"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-ink-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-ink-600">
                  <Users className="h-4 w-4 text-ink-400" />
                  Team members
                </div>
                <span className="font-semibold text-ink-900">{profiles.length}</span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={Banknote} label="Funding" tone="amber" />
            <MiniStat icon={Package} label="Store" tone="field" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink-900">My recent requests</h2>
            <Link to="/activities" className="text-xs font-semibold text-field-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-ink-100">
            {myItems.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="No requests yet"
                message="Create your first request from the Activities page."
              />
            ) : (
              myItems.map((a) => <ActivityRow key={a.id} activity={a} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
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
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
          <p className="mt-1.5 font-display text-xl font-semibold text-ink-900 sm:text-2xl">{value}</p>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  tone: 'amber' | 'field';
}) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700',
    field: 'bg-field-100 text-field-700',
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-ink-700">{label}</span>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <Link
      to={`/activities/${activity.id}`}
      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-sand-50 sm:gap-4 sm:px-5"
    >
      <Avatar profile={activity.requester} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink-900">{activity.title}</p>
          <PriorityBadge priority={activity.priority} />
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-500">
          {activity.department} · {activity.category} · {relativeTime(activity.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
        {activity.amount != null && (
          <span className="text-sm font-medium text-ink-700 sm:inline">
            {formatCurrency(activity.amount)}
          </span>
        )}
        <StatusBadge status={activity.status} />
        <ArrowRight className="hidden h-4 w-4 text-ink-300 sm:inline" />
      </div>
    </Link>
  );
}
