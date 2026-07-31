import type { SupabaseClient as SupabaseClientBase } from "@supabase/supabase-js";

export interface EntityAuditRow {
  created_at?: string | null;
  is_backfilled?: boolean | null;
  backfilled_at?: string | null;
  backfill_reason?: string | null;
}

export interface NoteRow extends EntityAuditRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface TaskRow extends EntityAuditRow {
  id: string;
  user_id: string;
  text: string;
  is_done: boolean;
  order_index: number;
  due_date: string | null;
  due_time: string | null;
  planned_date: string | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WorkoutRecordRow extends EntityAuditRow {
  id: string;
  user_id: string;
  date: string;
  workout_type: string;
  category: string;
  exercise_name: string;
  duration_seconds: number | null;
  average_heart_rate: number | null;
  source_app?: "os" | "fitness" | null;
  scope?: "os" | "fitness" | "both" | null;
  metadata?: Record<string, unknown> | null;
  contract_version?: number | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface MealRecordRow extends EntityAuditRow {
  id: string;
  user_id: string;
  date: string;
  menu: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number | null;
  fat_grams: number | null;
  source_app?: "os" | "fitness" | null;
  scope?: "os" | "fitness" | "both" | null;
  metadata?: Record<string, unknown> | null;
  contract_version?: number | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface WeightRecordRow extends EntityAuditRow {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  source_app?: "os" | "fitness" | null;
  scope?: "os" | "fitness" | "both" | null;
  metadata?: Record<string, unknown> | null;
  contract_version?: number | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  last_seen_at: string;
  app_version: string | null;
}

export interface FinanceDailySummaryRow {
  user_id: string;
  date: string;
  income_krw: number;
  expense_krw: number;
  net_krw: number;
  entry_count: number;
}

export type FinanceDailySummarySelectedRow = Pick<
  FinanceDailySummaryRow,
  "date" | "income_krw" | "expense_krw" | "net_krw" | "entry_count"
>;

export interface PostgresChangePayload<Row> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: Row | null;
  old?: Partial<Row>;
}

export interface Database {
  public: {
    Tables: {
      notes: {
        Row: NoteRow;
        Insert: NoteRow;
        Update: Partial<NoteRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskRow;
        Update: Partial<TaskRow>;
        Relationships: [];
      };
      workout_records: {
        Row: WorkoutRecordRow;
        Insert: WorkoutRecordRow;
        Update: Partial<WorkoutRecordRow>;
        Relationships: [];
      };
      meal_records: {
        Row: MealRecordRow;
        Insert: MealRecordRow;
        Update: Partial<MealRecordRow>;
        Relationships: [];
      };
      weight_records: {
        Row: WeightRecordRow;
        Insert: WeightRecordRow;
        Update: Partial<WeightRecordRow>;
        Relationships: [];
      };
      devices: {
        Row: DeviceRow;
        Insert: DeviceRow;
        Update: Partial<DeviceRow>;
        Relationships: [];
      };
    };
    Views: {
      finance_summary_daily: {
        Row: FinanceDailySummaryRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}

export type SupabaseClient = SupabaseClientBase<Database, "public">;

export type SnapshotTableName =
  | "notes"
  | "tasks"
  | "workout_records"
  | "meal_records"
  | "weight_records"
  | "devices";

export type RealtimeTableName = Exclude<SnapshotTableName, "devices">;
