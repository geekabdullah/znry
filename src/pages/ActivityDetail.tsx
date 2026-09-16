import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Send,
  Clock,
  User as UserIcon,
  Calendar,
  Tag,
  Wallet,
  Package,
  Banknote,
  PackageCheck,
  Undo2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useActivityUpdates, advanceActivity } from '@/lib/data';
import { Card, Spinner, EmptyState } from '@/components/ui';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { Avatar } from '@/components/Avatar';
import {
  roleLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  relativeTime,
  CHAIN_STAGE_LABELS,
  REQUEST_TYPE_LABELS,
  getActionableRole,
} from '@/lib/constants';
import type { Activity, ActivityUpdate, ChainStage, Role } from '@/lib/types';

const CHAIN_ORDER: ChainStage[] = ['supervisor', 'manager', 'md', 'disbursement', 'done'];

export function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const { updates, reload: reloadUpdates } = useActivityUpdates(id ?? null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    supabase
      .from('activities')
      .select('*, requester:profiles!requester_id(*)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setActivity((data as Activity) ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <Spinner />;

  if (!activity) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="Activity not found"
        message="This request may have been removed, or it is outside your approval chain."
      />
    );
  }

  const actionableRole = getActionableRole(activity.chain_stage, activity.disburser_role);
  const canAct =
    profile != null &&
    actionableRole != null &&
    activity.chain_stage !== 'done' &&
    (
      (actionableRole === 'md' && profile.role === 'md') ||
      (actionableRole === 'admin' && profile.role === 'admin') ||
      (actionableRole === 'storekeeper' && profile.role === 'storekeeper' && profile.department === activity.department) ||
      (actionableRole === 'manager' && profile.role === 'manager' && profile.department === activity.department) ||
      (actionableRole === 'supervisor' && profile.role === 'supervisor' && (activity.supervisor_id ? activity.supervisor_id === profile.id : profile.department === activity.department))
    );

  async function handleDecision(
    decision: 'reviewed' | 'approved' | 'declined' | 'returned' | 'completed',
    disbursement?: { payment_ref?: string; amount_released?: number; stock_item?: string; stock_qty?: number },
  ) {
    if (!activity) return;
    setActing(true);
    setError(null);
    try {
      const updated = await advanceActivity(activity.id, decision, note, disbursement);
      setActivity(updated);
      setNote('');
      reloadUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the decision.');
    } finally {
      setActing(false);
    }
  }

  const currentStageIdx = CHAIN_ORDER.indexOf(activity.chain_stage);
  const requestEvent: ActivityUpdate = {
    id: 'origin',
    activity_id: activity.id,
    author_id: activity.requester_id,
    note: 'Submitted this request.',
    decision: 'submitted',
    created_at: activity.created_at,
    author: activity.requester,
  };

  return (
    <div className="animate-fade-in mx-auto max-w-4xl">
      <button
        onClick={() => navigate('/activities')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to activities
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2 lg:order-1 order-2">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-xl font-semibold text-ink-900">{activity.title}</h1>
                <p className="mt-1 text-sm text-ink-500">
                  {activity.department} · {activity.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={activity.priority} />
                <StatusBadge status={activity.status} />
              </div>
            </div>

            {activity.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                {activity.description}
              </p>
            )}

            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sand-100 px-3 py-1.5 text-xs font-medium text-sand-800">
              {activity.request_type === 'funding' ? (
                <><Banknote className="h-3.5 w-3.5" /> {REQUEST_TYPE_LABELS.funding}</>
              ) : (
                <><Package className="h-3.5 w-3.5" /> {REQUEST_TYPE_LABELS.store}</>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-5 sm:grid-cols-4 sm:gap-4">
              <Meta icon={<Wallet className="h-4 w-4" />} label="Amount" value={formatCurrency(activity.amount)} />
              <Meta icon={<Calendar className="h-4 w-4" />} label="Due" value={formatDate(activity.due_date)} />
              <Meta icon={<Tag className="h-4 w-4" />} label="Priority" value={activity.priority} />
              <Meta icon={<Clock className="h-4 w-4" />} label="Created" value={relativeTime(activity.created_at)} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-5 font-display text-base font-semibold text-ink-900">Approval chain</h2>
            <ChainStepper activity={activity} />
          </Card>

          <Card>
            <div className="border-b border-ink-100 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-ink-900">Timeline</h2>
            </div>
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <ol className="relative space-y-6 border-l border-ink-200 pl-5 sm:pl-6">
                {[requestEvent, ...updates].map((u, i) => (
                  <li key={u.id} className="relative">
                    <span
                      className={`absolute -left-[21px] grid h-5 w-5 place-items-center rounded-full ring-4 ring-sand-50 sm:-left-[26px] ${
                        u.decision === 'approved' || u.decision === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : u.decision === 'declined'
                            ? 'bg-rose-500 text-white'
                            : u.decision === 'returned'
                              ? 'bg-amber-500 text-white'
                              : i === 0
                                ? 'bg-field-600 text-white'
                                : 'bg-ink-300 text-white'
                      }`}
                    >
                      {u.decision === 'approved' || u.decision === 'completed' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : u.decision === 'declined' ? (
                        <XCircle className="h-3 w-3" />
                      ) : u.decision === 'returned' ? (
                        <Undo2 className="h-3 w-3" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar profile={u.author} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {u.author?.full_name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-ink-500">
                          {u.author ? roleLabel(u.author.role, u.author.department) : ''} · {formatDateTime(u.created_at)}
                        </p>
                      </div>
                      {u.decision && u.decision !== 'submitted' && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium capitalize text-ink-700">
                          {u.decision}
                        </span>
                      )}
                    </div>
                    {u.note && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-600">{u.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:order-2 order-1">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar profile={activity.requester} size="lg" />
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {activity.requester?.full_name ?? 'Unknown'}
                </p>
                <p className="text-xs text-ink-500">
                  {activity.requester ? roleLabel(activity.requester.role, activity.requester.department) : ''}
                </p>
                <p className="mt-0.5 text-xs text-ink-400">{activity.requester?.department}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
              <div className="flex items-center gap-2 text-ink-600">
                <UserIcon className="h-4 w-4 text-ink-400" />
                Currently with:{' '}
                <span className="font-medium text-ink-800">
                  {activity.chain_stage === 'done'
                    ? activity.status === 'declined' ? 'Closed' : 'Completed'
                    : CHAIN_STAGE_LABELS[activity.chain_stage]}
                </span>
              </div>
            </div>
          </Card>

          {canAct ? (
            <ActionPanel
              activity={activity}
              note={note}
              setNote={setNote}
              acting={acting}
              error={error}
              onDecision={handleDecision}
              role={profile?.role ?? 'staff'}
            />
          ) : activity.chain_stage !== 'done' ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <Send className="mt-0.5 h-4 w-4 text-ink-400" />
                <p className="text-xs text-ink-500">
                  {`This request is currently ${CHAIN_STAGE_LABELS[activity.chain_stage].toLowerCase()}. Only the ${actionableRoleLabel(actionableRole)} of this section can act on it.`}
                </p>
              </div>
            </Card>
          ) : null}

          {activity.disbursed_at && (
            <Card className="p-5">
              <h3 className="font-display text-sm font-semibold text-ink-900">Disbursement record</h3>
              <div className="mt-3 space-y-2 text-sm">
                {activity.payment_ref && (
                  <div className="flex justify-between">
                    <span className="text-ink-500">Payment reference</span>
                    <span className="font-medium text-ink-800">{activity.payment_ref}</span>
                  </div>
                )}
                {activity.amount_released != null && (
                  <div className="flex justify-between">
                    <span className="text-ink-500">Amount released</span>
                    <span className="font-medium text-ink-800">{formatCurrency(activity.amount_released)}</span>
                  </div>
                )}
                {activity.stock_item && (
                  <div className="flex justify-between">
                    <span className="text-ink-500">Item released</span>
                    <span className="font-medium text-ink-800">{activity.stock_item}</span>
                  </div>
                )}
                {activity.stock_qty_released != null && (
                  <div className="flex justify-between">
                    <span className="text-ink-500">Quantity released</span>
                    <span className="font-medium text-ink-800">{activity.stock_qty_released}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-500">Disbursed at</span>
                  <span className="font-medium text-ink-800">{formatDateTime(activity.disbursed_at)}</span>
                </div>
              </div>
            </Card>
          )}

          <Link
            to="/reports"
            className="block rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-600 shadow-soft transition hover:bg-sand-50"
          >
            View this in the daily report →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ChainStepper({ activity }: { activity: Activity }) {
  const currentIdx = CHAIN_ORDER.indexOf(activity.chain_stage);

  const steps: { stage: ChainStage; label: string; icon: React.ElementType }[] = [
    { stage: 'supervisor', label: 'Supervisor', icon: UserIcon },
    { stage: 'manager', label: 'Manager', icon: UserIcon },
    { stage: 'md', label: 'MD Approval', icon: CheckCircle2 },
    {
      stage: 'disbursement',
      label: activity.disburser_role === 'admin' ? 'Finance' : (activity.department === 'Technical Services' ? 'Foreman' : 'Storekeeper'),
      icon: activity.disburser_role === 'admin' ? Banknote : PackageCheck,
    },
  ];

  return (
    <>
      {/* Horizontal on sm+, vertical on mobile */}
      <div className="hidden items-center sm:flex">
        {steps.map((step, i) => {
          const stepIdx = CHAIN_ORDER.indexOf(step.stage);
          const isPast = currentIdx > stepIdx;
          const isCurrent = currentIdx === stepIdx;
          const isDone = activity.chain_stage === 'done';

          return (
            <div key={step.stage} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`grid h-9 w-9 place-items-center rounded-full border-2 transition ${
                    isPast || isDone
                      ? 'border-field-600 bg-field-600 text-sand-50'
                      : isCurrent
                        ? 'border-field-600 bg-white text-field-700 ring-4 ring-field-100'
                        : 'border-ink-200 bg-white text-ink-300'
                  }`}
                >
                  {isPast || isDone ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <p
                  className={`mt-2 text-center text-[11px] font-medium ${
                    isPast || isCurrent || isDone ? 'text-ink-800' : 'text-ink-400'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-1 mb-5 h-0.5 flex-1 rounded-full transition ${
                    isPast || isDone ? 'bg-field-600' : 'bg-ink-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical stack on mobile */}
      <div className="space-y-0 sm:hidden">
        {steps.map((step, i) => {
          const stepIdx = CHAIN_ORDER.indexOf(step.stage);
          const isPast = currentIdx > stepIdx;
          const isCurrent = currentIdx === stepIdx;
          const isDone = activity.chain_stage === 'done';

          return (
            <div key={step.stage} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 transition ${
                    isPast || isDone
                      ? 'border-field-600 bg-field-600 text-sand-50'
                      : isCurrent
                        ? 'border-field-600 bg-white text-field-700 ring-2 ring-field-100'
                        : 'border-ink-200 bg-white text-ink-300'
                  }`}
                >
                  {isPast || isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-3.5 w-3.5" />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`my-0.5 w-0.5 flex-1 self-stretch rounded-full ${
                      isPast || isDone ? 'bg-field-600' : 'bg-ink-200'
                    }`}
                    style={{ minHeight: '20px' }}
                  />
                )}
              </div>
              <p
                className={`pb-5 text-sm font-medium ${
                  isPast || isCurrent || isDone ? 'text-ink-800' : 'text-ink-400'
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}

type DecisionAction = 'reviewed' | 'approved' | 'declined' | 'returned' | 'completed';

interface DisbursementInfo {
  payment_ref?: string;
  amount_released?: number;
  stock_item?: string;
  stock_qty?: number;
}

function ActionPanel({
  activity,
  note,
  setNote,
  acting,
  error,
  onDecision,
  role,
}: {
  activity: Activity;
  note: string;
  setNote: (v: string) => void;
  acting: boolean;
  error: string | null;
  onDecision: (d: DecisionAction, disbursement?: DisbursementInfo) => void;
  role: Role;
}) {
  const stage = activity.chain_stage;
  const isDisbursement = stage === 'disbursement';
  const isMD = stage === 'md';
  const isFunds = isDisbursement && activity.disburser_role === 'admin';
  const isStock = isDisbursement && activity.disburser_role === 'storekeeper';

  const [payRef, setPayRef] = useState('');
  const [amtReleased, setAmtReleased] = useState('');
  const [stockName, setStockName] = useState('');
  const [stockQty, setStockQty] = useState('');

  function handleComplete() {
    onDecision('completed', {
      payment_ref: payRef || undefined,
      amount_released: amtReleased ? parseFloat(amtReleased) : undefined,
      stock_item: stockName || undefined,
      stock_qty: stockQty ? parseFloat(stockQty) : undefined,
    });
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-sm font-semibold text-ink-900">
        {isDisbursement
          ? isFunds
            ? 'Release funds'
            : 'Release stock'
          : isMD
            ? 'MD approval'
            : 'Take action'}
      </h3>
      <p className="mt-1 text-xs text-ink-500">
        {isDisbursement
          ? `Record the disbursement to complete this request for ${activity.requester?.full_name}.`
          : isMD
            ? 'The Managing Director can approve, return for clarification, or decline.'
            : 'Add a note and move this request to the next office in the chain.'}
      </p>

      {isDisbursement && (
        <div className="mt-3 space-y-3 rounded-lg bg-sand-100 p-3">
          {isFunds && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Payment reference
                </label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. TRX-2026-0001"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Amount released (NGN)
                </label>
                <input
                  type="number"
                  min="0"
                  value={amtReleased}
                  onChange={(e) => setAmtReleased(e.target.value)}
                  placeholder={activity.amount?.toString() ?? '0'}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500"
                />
              </div>
            </>
          )}
          {isStock && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Item released
                </label>
                <input
                  value={stockName}
                  onChange={(e) => setStockName(e.target.value)}
                  placeholder="e.g. Maize seed"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Quantity released
                </label>
                <input
                  type="number"
                  min="0"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500"
                />
              </div>
            </>
          )}
        </div>
      )}

      <textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={isDisbursement ? 'Optional disbursement note...' : 'Optional note for the next office...'}
        className="mt-3 w-full resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
      />
      {error && (
        <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {!isMD && !isDisbursement && (
          <button
            disabled={acting}
            onClick={() => onDecision('reviewed')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-field-600 px-3 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-field-700 disabled:opacity-60"
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Review & forward to {stage === 'supervisor' ? 'manager' : 'Managing Director'}
          </button>
        )}
        {isMD && (
          <button
            disabled={acting}
            onClick={() => onDecision('approved')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve & route to {activity.request_type === 'funding' ? 'Finance & Admin' : 'Storekeeper'}
          </button>
        )}
        {isDisbursement && (
          <button
            disabled={acting}
            onClick={handleComplete}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-field-600 px-3 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-field-700 disabled:opacity-60"
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            {isFunds ? 'Confirm funds released' : 'Confirm stock released'}
          </button>
        )}
        <button
          disabled={acting}
          onClick={() => onDecision('returned')}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
        >
          <Undo2 className="h-4 w-4" />
          Return for clarification
        </button>
        <button
          disabled={acting}
          onClick={() => onDecision('declined')}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" />
          Decline
        </button>
      </div>
    </Card>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-medium capitalize text-ink-800">{value}</p>
    </div>
  );
}

function actionableRoleLabel(role: Role | null): string {
  if (!role) return 'appropriate office';
  return roleLabel(role);
}
