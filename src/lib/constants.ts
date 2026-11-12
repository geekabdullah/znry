import type { Department, Role, ActivityStatus, ActivityPriority, ChainStage, RequestType, Decision } from './types';

export const DEPARTMENTS: Department[] = [
  'Crop Production',
  'Livestock Production',
  'Technical Services',
  'Procurement',
  'Marketing',
  'Inspectorate',
  'Training',
  'Finance & Admin',
  'Executive',
];

export const DEPARTMENT_CATEGORIES: Record<Department, string[]> = {
  'Crop Production': [
    'Thinning & Weeding',
    'Seeding Request',
    'Pest Control & Spraying',
    'Harvesting',
    'Store Release',
    'General Field Activity',
    'Other',
  ],
  'Livestock Production': [
    'Feed Request',
    'Veterinary Care',
    'Birth & Mortality Log',
    'Sales Record',
    'Store Release',
    'General Husbandry',
    'Other',
  ],
  'Technical Services': [
    'Spare Parts Request',
    'Fuel Request',
    'Maintenance & Repair',
    'Harrowing / Field Work',
    'Store Release',
    'General Workshop',
    'Other',
  ],
  Procurement: ['Purchase Order', 'Supplier Coordination', 'Stock Intake', 'General Procurement', 'Other'],
  Marketing: ['Campaign', 'Sales Lead', 'Market Visit', 'General Marketing', 'Other'],
  Inspectorate: ['Inspection Report', 'Compliance Audit', 'Investigation', 'General Inspection', 'Other'],
  Training: ['Training Session', 'Workshop', 'Onboarding', 'General Training', 'Other'],
  'Finance & Admin': ['Fund Release', 'Payroll', 'Expense Record', 'General Finance', 'Other'],
  Executive: ['Directive', 'Review', 'General Executive', 'Other'],
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Finance & Admin',
  md: 'Managing Director',
  manager: 'Manager',
  supervisor: 'Supervisor',
  assistant: 'Assistant',
  storekeeper: 'Storekeeper',
  staff: 'Staff',
};

export function roleLabel(role: Role, department?: Department): string {
  if (role === 'assistant') {
    if (department === 'Crop Production') return 'Farm Assistant';
    if (department === 'Livestock Production') return 'Livestock Assistant';
    if (department === 'Technical Services') return 'Workshop Assistant';
    return 'Assistant';
  }
  if (role === 'storekeeper') {
    if (department === 'Technical Services') return 'Workshop Assistant / Foreman';
    return 'Storekeeper';
  }
  return ROLE_LABELS[role];
}

export const ROLE_RANK: Role[] = [
  'assistant',
  'staff',
  'storekeeper',
  'supervisor',
  'manager',
  'admin',
  'md',
];

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: 'Awaiting review',
  in_review: 'In review',
  approved: 'Approved',
  completed: 'Completed',
  declined: 'Declined',
};

export const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const ROLE_OPTIONS: Role[] = [
  'admin',
  'md',
  'manager',
  'supervisor',
  'assistant',
  'storekeeper',
  'staff',
];

export const CHAIN_STAGES: { stage: ChainStage; label: string; role: Role }[] = [
  { stage: 'supervisor', label: 'Supervisor', role: 'supervisor' },
  { stage: 'manager', label: 'Manager', role: 'manager' },
  { stage: 'md', label: 'Managing Director', role: 'md' },
  { stage: 'disbursement', label: 'Disbursement', role: 'storekeeper' },
  { stage: 'done', label: 'Completed', role: 'staff' },
];

export const CHAIN_STAGE_LABELS: Record<ChainStage, string> = {
  supervisor: 'With Supervisor',
  manager: 'With Manager',
  md: 'With Managing Director',
  disbursement: 'Disbursement',
  done: 'Completed',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  funding: 'Funding / Financial',
  store: 'Store / Stock Release',
};

export const DECISION_LABELS: Record<Decision, string> = {
  submitted: 'Submitted',
  reviewed: 'Reviewed & forwarded',
  approved: 'Approved by MD',
  declined: 'Declined',
  returned: 'Returned for clarification',
  completed: 'Disbursed & completed',
};

export function getActionableRole(stage: ChainStage, disburserRole: string | null): Role | null {
  if (stage === 'supervisor') return 'supervisor';
  if (stage === 'manager') return 'manager';
  if (stage === 'md') return 'md';
  if (stage === 'disbursement') return (disburserRole as Role) ?? 'storekeeper';
  return null;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}
