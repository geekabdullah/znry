import type { ActivityStatus, ActivityPriority } from '@/lib/types';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants';

const statusStyles: Record<ActivityStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  in_review: 'bg-sky-100 text-sky-800 ring-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  completed: 'bg-field-100 text-field-700 ring-field-200',
  declined: 'bg-rose-100 text-rose-700 ring-rose-200',
};

const priorityStyles: Record<ActivityPriority, string> = {
  low: 'bg-ink-100 text-ink-600 ring-ink-200',
  normal: 'bg-ink-100 text-ink-700 ring-ink-200',
  high: 'bg-orange-100 text-orange-700 ring-orange-200',
  urgent: 'bg-rose-100 text-rose-700 ring-rose-200',
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${priorityStyles[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
