# Spec — 기록 탭 Life Command Center

## 1. 목적

`RecordsPanel`을 단순 조회형 캘린더에서 앱 진입 홈으로 승격한다. 사용자는 앱을 여는 즉시 오늘의 생산성, 식단, 운동, 체중 상태를 2초 안에 파악해야 한다.

## 2. 상단 Hero / Today Brief

표시 항목:

```text
오늘 날짜
동기화 상태
오늘 남은 일 N개
오늘 완료한 일 N개
운동 기록 있음/없음
최근 체중 변화
```

문구 예시:

```text
오늘의 지휘판
3 tasks left · 1 workout · synced
```

## 3. KPI 카드

필수 카드 4개:

```text
생산성 스코어: 선택 기간 완료한 할 일 / 전체 할 일
평균 칼로리: 선택 기간 meal 평균
평균 단백질: 선택 기간 meal 평균
체중 변화: 선택 기간 첫 체중 대비 마지막 체중 delta
```

데이터가 없으면 `0` 대신 `—`와 empty microcopy를 쓴다.

## 4. 차트

최소 MVP 차트:

```text
Weekly productivity bar/ring
Calories/protein trend
Weight line trend
```

먼저 가벼운 SVG/React 구현을 우선한다. 새 chart library는 기존 의존성 확인 후 꼭 필요할 때만 추가한다.

## 5. 캘린더

기존 월간 캘린더는 유지하되 날짜 cell 상태를 명확히 분리한다.

```text
hover
focus
today
selected
has note/task/workout/meal/weight marker
```

dot marker legend는 항상 사용자에게 해석 가능해야 한다.

## 6. Inline Quick Action Overlay

날짜 클릭 시 탭 이동 없이 compact overlay/modal/sheet를 연다.

가능해야 하는 작업:

```text
할 일 완료 toggle
새 할 일 추가
메모 quick add / quick edit
운동/식사/체중 요약 보기
체중 값 수정
```

접근성:

```text
Esc 닫기
Enter 저장
Shift+Enter 줄바꿈
focus trap
keyboard navigation
```

Android/narrow width에서는 modal보다 bottom sheet를 우선한다.

## 7. 데이터 집계 분리

UI 컴포넌트 안에 집계 로직을 직접 쓰지 말고 아래 파일로 분리한다.

```text
src/features/records/recordAggregation.ts
```

필수 pure function:

```ts
getRecordsForDate(snapshot, date)
getDashboardStats(snapshot, range)
getCalendarMarkers(snapshot, month)
getProductivitySeries(tasks, range)
getNutritionSeries(meals, range)
getWeightSeries(weights, range)
```

모든 selector는 `deletedAt === null`만 대상으로 한다.

날짜 비교는 timezone drift를 막기 위해 local date 기준 helper로 통일한다.

React 컴포넌트에서는 `useMemo`를 사용해 월/기간/데이터 변경 시에만 집계한다.
