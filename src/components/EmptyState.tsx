interface EmptyStateProps {
  title: string;
  description: string;
}

// 목록이나 편집 대상이 없을 때 재사용하는 빈 상태 화면이다.
export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/70 px-6 text-center dark:border-neutral-800 dark:bg-black">
      <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}
