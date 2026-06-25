export type ChangeSetStatus =
  | "PLANNING"
  | "PLAN_READY"
  | "PLAN_APPROVED"
  | "ACTING"
  | "PATCH_READY"
  | "VALIDATING"
  | "PATCH_APPROVED"
  | "PATCH_REJECTED"
  | "APPLIED"
  | "ROLLED_BACK"
  | "CANCELLED";

export type PlanStep = {
  id: string;
  title: string;
  files: string[];
  description: string;
  done?: boolean;
  task_file_path?: string | null;
};

export type PlanTaskFile = {
  id: string;
  title: string;
  path?: string | null;
  done: boolean;
  files: string[];
  description?: string;
};

export type PlanJson = {
  summary?: string;
  architecture?: string;
  steps: PlanStep[];
  risks?: string[];
  testing_strategy?: string[];
};

export type ChangeSet = {
  id: string;
  repository_id: string;
  chat_session_id: string;
  status: ChangeSetStatus;
  plan_version: number;
  plan_json: PlanJson;
  plan_markdown?: string | null;
  plan_file_path?: string | null;
  plan_task_files?: PlanTaskFile[];
  source_message_id?: string | null;
  patch_id?: string | null;
  patch_status?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PlanReadyEvent = {
  type: "plan_ready";
  change_set_id: string;
  plan_version: number;
  plan: PlanJson;
  status: ChangeSetStatus;
  plan_file_path?: string | null;
};
