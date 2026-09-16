export type Role =
  | 'admin'
  | 'md'
  | 'manager'
  | 'supervisor'
  | 'assistant'
  | 'storekeeper'
  | 'staff';

export type Department =
  | 'Crop Production'
  | 'Livestock Production'
  | 'Technical Services'
  | 'Procurement'
  | 'Marketing'
  | 'Inspectorate'
  | 'Training'
  | 'Finance & Admin'
  | 'Executive';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department: Department;
  title: string;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ActivityStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'completed'
  | 'declined';

export type ActivityPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Decision =
  | 'submitted'
  | 'reviewed'
  | 'approved'
  | 'declined'
  | 'returned'
  | 'completed';

export type ChainStage = 'supervisor' | 'manager' | 'md' | 'disbursement' | 'done';

export type RequestType = 'funding' | 'store';

export type DisburserRole = 'storekeeper' | 'admin';

export interface Activity {
  id: string;
  title: string;
  description: string;
  department: Department;
  category: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  amount: number | null;
  requester_id: string;
  current_owner_role: Role;
  due_date: string | null;
  request_type: RequestType;
  chain_stage: ChainStage;
  disburser_role: DisburserRole | null;
  supervisor_id: string | null;
  payment_ref: string | null;
  amount_released: number | null;
  stock_item: string | null;
  stock_qty_released: number | null;
  disbursed_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile;
}

export interface ActivityUpdate {
  id: string;
  activity_id: string;
  author_id: string;
  note: string;
  decision: Decision | null;
  created_at: string;
  author?: Profile;
}

export interface Worker {
  id: string;
  full_name: string;
  phone: string;
  rank: string;
  department: string;
  info: string;
  created_at: string;
  updated_at: string;
}
