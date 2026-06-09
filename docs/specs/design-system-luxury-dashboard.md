# Spec — Luxury Black Dashboard Design System

## 1. 디자인 방향

현재 앱의 검은 배경, cyan accent, 카드형 캘린더, dot marker는 유지한다. 다만 화면이 “로컬 메모 앱”처럼 보이지 않도록 밀도, hierarchy, motion, surface depth를 정리한다.

핵심 키워드:

```text
matte black
precision
quiet luxury
command dashboard
cyan signal
hairline border
calm motion
```

## 2. Surface hierarchy

```text
App background: near black
Base surface: black-charcoal
Elevated surface: graphite with 1px hairline border
Active surface: cyan-tinted black
Danger surface: muted red only on hover/focus
```

## 3. Accent system

```text
Primary: cyan/mint
Productivity: blue
Meal: amber
Workout: green
Weight: violet 또는 high-contrast white
Danger/delete: muted red, hover에서만 선명하게
```

## 4. Typography

- 숫자 KPI는 `tabular-nums`를 사용한다.
- KPI 숫자는 크게, label은 작고 절제한다.
- 한국어 UI는 줄간격을 충분히 확보한다.
- 고급 브랜드 톤을 위해 과도한 emoji 사용은 피한다.

## 5. Component rules

- 버튼과 카드는 두꺼운 glow를 남발하지 않는다.
- hover는 opacity, border, tiny scale 정도로 제한한다.
- selected state는 cyan border + low opacity fill.
- today state와 selected state를 시각적으로 구분한다.
- destructive action은 평소에는 조용하게, hover/focus에서만 명확하게.

## 6. Layout

Desktop:

```text
12-column dashboard grid
Hero full width
KPI cards 4 columns
Chart band 2~3 cards
Calendar + Day detail split
```

Narrow/Android:

```text
single column
KPI horizontal scroll 또는 2-column compact
Quick Action은 bottom sheet
safe area 고려
```

## 7. Motion

- transition duration은 120~180ms.
- modal/sheet는 opacity + translate/scale만 사용한다.
- data update는 flashy animation보다 subtle highlight를 사용한다.
