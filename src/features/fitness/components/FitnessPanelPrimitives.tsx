import type { ReactNode } from "react";
import { Plus } from "lucide-react";

// 운동 탭의 각 입력 카드 제목을 아이콘과 함께 표시합니다.
export function FormTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-neutral-50">
      {icon}
      <span>{title}</span>
    </div>
  );
}

// 날짜, 숫자, 텍스트 입력에 공통 라벨 간격과 스타일을 제공합니다.
export function FieldLabel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-neutral-300">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

// 운동/식사/체중 추가 폼에서 공유하는 제출 버튼입니다.
export function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

// 통계 패널 안에서 하나의 지표 묶음을 카드 형태로 표시합니다.
export function MetricPanel({
  children,
  icon,
  primary,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  primary: string;
  title: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-neutral-50">
        {primary}
      </p>
      <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-neutral-400">
        {children}
      </div>
    </div>
  );
}
