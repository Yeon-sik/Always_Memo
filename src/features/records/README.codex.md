# Records Feature — Codex Notes

이 폴더는 `기록` 탭을 Life Command Center로 승격하는 핵심 위치다.

해야 할 일:

```text
recordAggregation.ts 추가
RecordsPanel 또는 관련 panel에 Hero/KPI/chart/calendar polish 추가
날짜 클릭 Quick Action Overlay 연결
모든 selector에서 deletedAt row 제외
```

주의:

```text
UI 안에 집계 로직을 직접 쓰지 말 것.
날짜 비교 helper를 통일할 것.
web/Android에서 layout이 무너지지 않게 responsive 처리할 것.
```

관련 문서:

```text
docs/specs/life-command-center.md
docs/specs/record-aggregation-api.md
docs/specs/design-system-luxury-dashboard.md
```
