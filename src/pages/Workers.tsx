import { useMemo, useState } from 'react';
import {
  UserPlus,
  Search,
  HardHat,
  Phone,
  Pencil,
  Trash2,
  X,
  Loader2,
  FileDown,
  Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useWorkers } from '@/lib/data';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { DEPARTMENTS } from '@/lib/constants';
import type { Worker } from '@/lib/types';

export function Workers() {
  const { profile: me } = useAuth();
  const { workers, loading, reload } = useWorkers();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const canManage = me?.role === 'admin' || me?.role === 'md';

  const filtered = useMemo(
    () =>
      workers.filter((w) => {
        const q = search.toLowerCase();
        const matchesSearch =
          w.full_name.toLowerCase().includes(q) ||
          w.phone.toLowerCase().includes(q) ||
          w.rank.toLowerCase().includes(q);
        const matchesDept = deptFilter === 'all' || w.department === deptFilter;
        return matchesSearch && matchesDept;
      }),
    [workers, search, deptFilter],
  );

  function handleDownloadPDF() {
    const printArea = document.getElementById('worker-print-area');
    if (!printArea) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const rows = filtered
      .map(
        (w, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="name">${escapeHtml(w.full_name)}</td>
          <td>${escapeHtml(w.rank)}</td>
          <td>${escapeHtml(w.department)}</td>
          <td>${escapeHtml(w.phone)}</td>
          <td>${escapeHtml(w.info)}</td>
        </tr>`,
      )
      .join('');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Zinariya Workers Registry</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1f1d1a; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3f6230; padding-bottom: 12px; }
  .header h1 { font-size: 22px; color: #3f6230; letter-spacing: 0.5px; }
  .header p { font-size: 12px; color: #6b6660; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #6b6660; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #3f6230; color: #f5f0e6; padding: 7px 8px; text-align: left; font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #e0ddd4; font-family: Arial, sans-serif; }
  tbody tr:nth-child(even) { background: #faf8f3; }
  td.num { text-align: center; color: #999; width: 28px; }
  td.name { font-weight: 600; }
  .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e0ddd4; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Zinariya Farms &amp; Operations</h1>
    <p>Worker Registry Report</p>
  </div>
  <div class="meta">
    <span>Generated: ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
    <span>Total workers: ${filtered.length}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Full Name</th>
        <th>Rank</th>
        <th>Department</th>
        <th>Phone</th>
        <th>Info</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">This document was generated from the Zinariya Operations workspace.</div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); }</script>
</body>
</html>`);
    win.document.close();
  }

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Worker Registry"
        subtitle="Complete record of company workers with rank, phone, and info — downloadable as PDF."
        action={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-sand-50 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-field-600 px-4 py-2 text-sm font-semibold text-sand-50 transition hover:bg-field-700"
              >
                <UserPlus className="h-4 w-4" />
                Add worker
              </button>
            </div>
          ) : undefined
        }
      />

      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, or rank..."
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
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
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-6 w-6" />}
          title="No workers recorded yet"
          message="Add workers manually with their name, phone number, rank, and department. The full list can be downloaded as a PDF."
        />
      ) : (
        <>
          {/* Card layout for mobile */}
          <div className="space-y-3 lg:hidden" id="worker-print-area">
            {filtered.map((w) => (
              <Card key={w.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{w.full_name}</p>
                    {w.rank && (
                      <p className="mt-0.5 text-xs font-medium text-field-700">{w.rank}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => {
                          setEditing(w);
                          setShowForm(true);
                        }}
                        className="rounded-lg p-2.5 text-ink-500 transition hover:bg-field-50 hover:text-field-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(w)}
                        className="rounded-lg p-2.5 text-ink-500 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
                  {w.department && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      {w.department}
                    </div>
                  )}
                  {w.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      {w.phone}
                    </div>
                  )}
                  {w.info && (
                    <p className="pt-1 text-ink-600">{w.info}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Table layout for desktop */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-sand-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Full Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">Info</th>
                  {canManage && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w, i) => (
                  <tr key={w.id} className="border-b border-ink-50 transition hover:bg-sand-50/40">
                    <td className="px-4 py-3 text-ink-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{w.full_name}</td>
                    <td className="px-4 py-3 text-ink-700">{w.rank || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-ink-700">
                        <Building2 className="h-3.5 w-3.5 text-ink-400" />
                        {w.department || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {w.phone ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-700">
                          <Phone className="h-3.5 w-3.5 text-ink-400" />
                          {w.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-ink-600" title={w.info}>
                      {w.info || '—'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(w);
                              setShowForm(true);
                            }}
                            className="rounded-lg p-1.5 text-ink-500 transition hover:bg-field-50 hover:text-field-700"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(w)}
                            className="rounded-lg p-1.5 text-ink-500 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {showForm && (
        <WorkerFormModal
          worker={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );

  async function handleDelete(w: Worker) {
    if (!confirm(`Remove ${w.full_name} from the registry?`)) return;
    try {
      const { error } = await supabase.rpc('admin_delete_worker', { p_worker_id: w.id });
      if (error) throw error;
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete worker.');
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function WorkerFormModal({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(worker?.full_name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [rank, setRank] = useState(worker?.rank ?? '');
  const [department, setDepartment] = useState(worker?.department ?? 'Crop Production');
  const [info, setInfo] = useState(worker?.info ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (worker) {
        const { error: err } = await supabase.rpc('admin_update_worker', {
          p_worker_id: worker.id,
          p_full_name: fullName.trim(),
          p_phone: phone.trim(),
          p_rank: rank.trim(),
          p_department: department,
          p_info: info.trim(),
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.rpc('admin_create_worker', {
          p_full_name: fullName.trim(),
          p_phone: phone.trim(),
          p_rank: rank.trim(),
          p_department: department,
          p_info: info.trim(),
        });
        if (err) throw err;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save worker.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-md animate-fade-in rounded-2xl bg-sand-50 shadow-card">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-ink-100 bg-sand-50 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink-900">
            {worker ? 'Edit worker' : 'Add worker'}
          </h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <FormField label="Full name">
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Aisha Bello"
              className="wf-input"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567"
                className="wf-input"
              />
            </FormField>
            <FormField label="Rank">
              <input
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="e.g. Field Supervisor"
                className="wf-input"
              />
            </FormField>
          </div>
          <FormField label="Department">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="wf-input"
            >
              <option value="">—</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Additional info">
            <textarea
              rows={3}
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              placeholder="Address, next of kin, notes..."
              className="wf-input resize-none"
            />
          </FormField>
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="wf-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="wf-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {worker ? 'Save changes' : 'Add worker'}
            </button>
          </div>
        </form>
      </div>
      <style>{wfStyles}</style>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const wfStyles = `
  .wf-input {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid #d9d6cc;
    background: #ffffff;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #1f1d1a;
    transition: border-color .15s, box-shadow .15s;
  }
  .wf-input:focus {
    outline: none;
    border-color: #527e3e;
    box-shadow: 0 0 0 3px rgba(82,126,62,0.15);
  }
  .wf-primary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    border-radius: 0.5rem; background: #3f6230; color: #f5f0e6;
    padding: 0.5rem 1rem; font-weight: 600; font-size: 0.875rem;
    transition: background .15s;
  }
  .wf-primary:hover { background: #324e27; }
  .wf-primary:disabled { opacity: .7; }
  .wf-ghost {
    border-radius: 0.5rem; padding: 0.5rem 1rem; font-weight: 500; font-size: 0.875rem; color: #4a463f;
  }
  .wf-ghost:hover { background: #eeece6; }
`;
