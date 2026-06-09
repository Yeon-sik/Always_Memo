# Notes Feature — Codex Notes

메모 탭은 깊은 작성 영역이고 Quick Capture의 저장 대상이다.

해야 할 일:

```text
QuickCapture component가 memo mode를 지원하게 할 것
#memo prefix 또는 UI toggle을 지원할 것
저장 즉시 local snapshot에 반영하고 sync는 기존 engine이 처리하게 할 것
NoteList/NoteEditor legacy 사용 여부를 검색 후 정리할 것
```

주의:

```text
기존 MemoPanel의 작성/수정/삭제 UX를 깨지 말 것.
deletedAt tombstone 정책을 유지할 것.
```
