# Fitness Feature — Codex Notes

이 폴더는 운동/식사/체중 기록의 Full CRUD 전환 위치다.

해야 할 일:

```text
fitnessService.ts 작성 또는 기존 함수 분리
update/delete action 추가
FitnessPanel row edit/delete UI 추가
meal carbsGrams/fatGrams 입력 활성화
fitnessStats selector에서 tombstone 제외 확인
Markdown export에서 tombstone 제외 확인
```

삭제 규칙:

```text
hard delete 금지
deletedAt = nowIso()
updatedAt = nowIso()
deviceId = currentDeviceId
```

관련 문서:

```text
docs/specs/fitness-full-crud-sync.md
docs/plans/acceptance-checklist.md
```
