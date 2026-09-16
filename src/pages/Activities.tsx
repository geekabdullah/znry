import { useEffect, useState } from 'react';
import { Search, Filter, Plus, Loader2, X, Inbox, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useActivities, createActivity, usePendingActions, useSupervisors } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { Avatar } from '@/components/Avatar';
import {
  DEPARTMENTS,
  DEPARTMENT_CATEGORIES,
  formatCurrency,
  relativeTime,
  CHAIN_STAGE_LABELS,
  REQUEST_TYPE_LABELS,
  getActionableRole,
} from '@/lib/constants';
import type { ActivityPriority, RequestType, Activity, Role } from '@/lib/types';

type Tab = 'all' | 'pending' | 'mine';

export function Activities() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { activities, loading } = useActivities({ department, status, search });
  const { pending } = usePendingActions();

  const pendingForMe = pending.filter((a) => {
    const actionable = getActionableRole(a.chain_stage, a.disburser_role);
    if (!actionable) return false;
    if (actionable === 'md') return profile?.role === 'md';
    if (actionable === 'admin') return profile?.role === 'admin';
    if (actionable === 'storekeeper') return profile?.role === 'storekeeper' && profile?.department === a.department;
    if (actionable === 'manager') return profile?.role === 'manager' && profile?.department === a.department;
    if (actionable === 'supervisor') return profile?.role === 'supervisor' && (a.supervisor_id ? a.supervisor_id === profile?.id : profile?.department === a.department);
    return false;
  });

  const myRequests = activities.filter((a) => a.requester_id === profile?.id);

  const shown = tab === 'pending' ? pendingForMe : tab === 'mine' ? myRequests : activities;

  const canCreate = true;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Activities & Requests"
        subtitle="Requests routed privately through your section's approval chain."
        action={
          canCreate ? (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-field-600 px-4 py-2 text-sm font-semibold text-sand-50 transition hover:bg-field-700"
            >
              <Plus className="h-4 w-4" />
              New request
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto scrollbar-thin sm:inline-flex sm:rounded-lg sm:bg-ink-100 sm:p-1">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')} icon={<Inbox className="h-4 w-4 shrink-0" />}>
          Pending your action
          {pendingForMe.length > 0 && (
            <span className="ml-1.5 rounded-full bg-field-600 px-1.5 py-0.5 text-[10px] font-bold text-sand-50">
              {pendingForMe.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')} icon={<FileText className="h-4 w-4 shrink-0" />}>
          My requests
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          All visible
        </TabButton>
      </div>

      {tab === 'all' && (
        <Card className="mb-5 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activities..."
                className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterSelect
                icon={<Filter className="h-4 w-4" />}
                value={department}
                onChange={setDepartment}
                options={['all', ...DEPARTMENTS]}
              />
              <FilterSelect
                value={status}
                onChange={setStatus}
                options={['all', 'pending', 'in_review', 'approved', 'completed', 'declined']}
              />
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={tab === 'pending' ? <Inbox className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          title={tab === 'pending' ? 'Nothing needs your action' : 'No activities found'}
          message={
            tab === 'pending'
              ? 'There are no requests waiting for you at your office right now.'
              : tab === 'mine'
                ? 'You have not created any requests yet. Start one with the button above.'
                : 'Try adjusting your filters.'
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-ink-100">
            {shown.map((a) => (
              <ActivityListRow key={a.id} activity={a} onClick={() => navigate(`/activities/${a.id}`)} highlight={tab === 'pending'} />
            ))}
          </div>
        </Card>
      )}

      <NewActivityModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ActivityListRow({
  activity,
  onClick,
  highlight,
}: {
  activity: Activity;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-sand-50 sm:gap-4 sm:px-5"
    >
      <Avatar profile={activity.requester} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink-900">{activity.title}</span>
          <PriorityBadge priority={activity.priority} />
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-500">
          {activity.department} · {activity.category} · {activity.requester?.full_name} · {relativeTime(activity.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {highlight && (
          <span className="rounded-full bg-field-50 px-2 py-0.5 text-[11px] font-semibold text-field-700">
            {CHAIN_STAGE_LABELS[activity.chain_stage]}
          </span>
        )}
        <div className="flex items-center gap-2">
          {activity.amount != null && (
            <span className="hidden text-sm font-medium text-ink-700 sm:inline">
              {formatCurrency(activity.amount)}
            </span>
          )}
          <StatusBadge status={activity.status} />
        </div>
      </div>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-ink-200 bg-white py-2 ${icon ? 'pl-8' : 'pl-3'} pr-7 text-sm capitalize outline-none focus:border-field-500`}
      >
        {options.map((o) => (
          <option key={o} value={o} className="capitalize">
            {o === 'all' ? 'All' : o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}

interface NewActivityModalProps {
  open: boolean;
  onClose: () => void;
}

function NewActivityModal({ open, onClose }: NewActivityModalProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { supervisors } = useSupervisors();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [category, setCategory] = useState('General Field Activity');
  const [priority, setPriority] = useState<ActivityPriority>('normal');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('funding');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSupervisor = profile?.role === 'assistant' || profile?.role === 'staff' || profile?.role === 'storekeeper' || profile?.role === 'admin';
  const selectedSupervisor = supervisors.find((s) => s.id === supervisorId);
  const supervisorDept = selectedSupervisor?.department ?? profile?.department ?? 'Crop Production';

  useEffect(() => {
    if (open && needsSupervisor && supervisors.length > 0 && !supervisorId) {
      setSupervisorId(supervisors[0].id);
    }
  }, [open, supervisors, supervisorId, needsSupervisor]);

  useEffect(() => {
    setCategory(DEPARTMENT_CATEGORIES[supervisorDept]?.[0] ?? 'General Field Activity');
  }, [supervisorDept]);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setPriority('normal');
      setAmount('');
      setDueDate('');
      setRequestType('funding');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const created = await createActivity({
        title,
        description,
        department: supervisorDept,
        category,
        priority,
        amount: amount ? parseFloat(amount) : null,
        due_date: dueDate || null,
        request_type: requestType,
        supervisor_id: needsSupervisor ? supervisorId : null,
      });
      onClose();
      navigate(`/activities/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create the request.';
      if (msg.includes('Please choose an active supervisor')) {
        setError('Please select an active supervisor to route the request to.');
      } else if (msg.includes('Profile not found')) {
        setError('Your profile could not be found. Please sign out and sign in again.');
      } else {
        console.error('create_activity failed:', msg);
        setError('Could not create the request. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-lg animate-fade-in rounded-2xl bg-sand-50 shadow-card">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-ink-100 bg-sand-50 px-5 py-4">
          <div className="min-w-0 pr-2">
            <h2 className="font-display text-base font-semibold text-ink-900">New request</h2>
            <p className="text-xs text-ink-500">
              This routes privately to your supervisor — no one outside the chain can see it.
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <Labeled label="Title">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Thinning and hoeing 2 hectares of maize"
              className="modal-input"
            />
          </Labeled>
          <Labeled label="Description">
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work, people involved, and what is needed..."
              className="modal-input resize-none"
            />
          </Labeled>

          <Labeled label="Request type">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RequestTypeCard
                active={requestType === 'funding'}
                onClick={() => setRequestType('funding')}
                label={REQUEST_TYPE_LABELS.funding}
                description="MD approval routes to Finance & Admin"
              />
              <RequestTypeCard
                active={requestType === 'store'}
                onClick={() => setRequestType('store')}
                label={REQUEST_TYPE_LABELS.store}
                description="MD approval routes to Storekeeper"
              />
            </div>
          </Labeled>

          {needsSupervisor && (
            <>
              {supervisors.length === 0 ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
                  No active supervisors have been created yet. Ask an admin to add a supervisor before submitting requests.
                </div>
              ) : (
                <Labeled label="Route to supervisor">
                  <select
                    required
                    value={supervisorId}
                    onChange={(e) => setSupervisorId(e.target.value)}
                    className="modal-input"
                  >
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} — {s.department}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-ink-400">
                    {selectedSupervisor ? `Department: ${selectedSupervisor.department}` : 'Choose a supervisor to route to.'}
                  </p>
                </Labeled>
              )}
            </>
          )}
          <Labeled label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="modal-input"
            >
              {(DEPARTMENT_CATEGORIES[supervisorDept] ?? ['General']).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Labeled>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Labeled label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                className="modal-input"
              >
                {['low', 'normal', 'high', 'urgent'].map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Amount (NGN)">
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Optional"
                className="modal-input"
              />
            </Labeled>
            <Labeled label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="modal-input"
              />
            </Labeled>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="modal-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading || (needsSupervisor && supervisors.length === 0)} className="modal-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Submit request
            </button>
          </div>
        </form>
      </div>
      <style>{modalStyles}</style>
    </div>
  );
}

function RequestTypeCard({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? 'border-field-500 bg-field-50 ring-1 ring-field-300'
          : 'border-ink-200 bg-white hover:border-ink-300'
      }`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-field-800' : 'text-ink-800'}`}>{label}</p>
      <p className="mt-0.5 text-xs text-ink-500">{description}</p>
    </button>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const modalStyles = `
  .modal-input {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid #d9d6cc;
    background: #ffffff;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #1f1d1a;
    transition: border-color .15s, box-shadow .15s;
  }
  .modal-input:focus {
    outline: none;
    border-color: #527e3e;
    box-shadow: 0 0 0 3px rgba(82,126,62,0.15);
  }
  .modal-primary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    border-radius: 0.5rem;
    background: #3f6230; color: #f5f0e6;
    padding: 0.5rem 1rem; font-weight: 600; font-size: 0.875rem;
  }
  .modal-primary:hover { background: #324e27; }
  .modal-primary:disabled { opacity: .7; }
  .modal-ghost {
    border-radius: 0.5rem;
    padding: 0.5rem 1rem; font-weight: 500; font-size: 0.875rem;
    color: #4a463f;
  }
  .modal-ghost:hover { background: #eeece6; }
`;
