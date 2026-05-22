# Week 4 — HR 대시보드 + 운영자 큐 마무리 + 회고

**기간**: 2026-05-22 ~ (진행 중)
**상태**: 🟡 진행 중 (D22 완료)
**재배치 결정**: 2026-05-22 — 본 프로젝트 목적(프로세스 검증, 외부 청중 없음)에 맞춰 D27 데모 스크립트·D28 리허설 영상을 회고로 전환. 대신 `/admin/risk-queue`를 D26에 추가해 D19 `acknowledgeRiskFlag` server action의 UI 공백 닫음. `/app/bookings` 목록(IA 2.2 명시이지만 누락)은 D22에 30분 작업으로 끼움. `/admin/escalations`는 V2로 미룸 — `/psychiatrist/queue`가 이미 SLA 표시.

**W4 게이트**: HR 익명성 검증 통과 (k<5 마스킹 0건 위반) + 운영자 위기 ack UI 동작 + 5롤 풀 시나리오 E2E 그린

---

## 1. 목표

`mindbridge-dev-plan.md §5 Week 4`의 Day 22~28:

- HR 익명 집계 (k≥5 + BR-7 + BR-12) + 대시보드 + 리포트 + PDF
- 시드 v2 (1개월치) + `/admin/audit-logs`
- `/admin/risk-queue` (운영자 ack UI 공백 닫기 — 신규 추가)
- 5롤 풀 시나리오 E2E
- 한 달 프로세스 회고

## 2. 완료한 작업

### Day 22 (수) — HR k-anon + Department 집계 + `/app/bookings`

- [x] `lib/hr/aggregate.ts` — 단일 모듈에 k=5 마스킹 + BR-7 발행 조건 + BR-12 모집단 가드 + 집계
  - `maskCell(n)` — k=5 경계 (0은 마스킹 안 함, 1~4 마스킹, 5+ 통과)
  - `checkPublishable(db, companyId)` — BR-7 (직원 ≥20 OR STATISTICS 동의자 ≥10)
  - `listStatisticsConsenterUserIds(db, companyId)` — BR-12 모집단
  - `computeDashboard(db, args)` — 활성 사용자·자가진단 수·카테고리 분포·심각도 분포·번아웃 비율·부서별 집계
  - `computeBurnoutRate(numerator, denominator)` — 분자 < k 마스킹 (역추정 차단), 정수% 반올림
- [x] `lib/hr/period.ts` — `thisMonthUtc` / `lastNMonthsUtc` 기간 헬퍼 (server action 파일과 분리)
- [x] `lib/actions/hr.ts` — `getDashboard` server action (HRReport read 권한, ctx.user.companyId 자동 필터, BR-7 미달 시 `{ ok: false, gate }` 반환)
- [x] `prisma/seed.ts` — STATISTICS 선택 동의 보강 (40/50 직원, 인덱스 % 5 ≠ 0 패턴으로 재시드 안정)
- [x] `/hr/dashboard/page.tsx` — 텍스트 카드 + 표 (차트는 D23)
  - BR-7 미달 시 "발행 차단" 안내 카드
  - k<5 셀은 "<5명" 표시
  - 4개 지표 카드 (이용 직원·자가진단 응답·번아웃 비율·모집단 메타) + 카테고리/심각도 분포 + 부서별 표
- [x] `/app/bookings/page.tsx` — 직원 본인 예약 목록 (IA 2.2)
  - 예정/지난 분리, 본인 employeeId 격리, 상태별 pill
- [x] `/hr/page.tsx` 카드 → 대시보드 링크 추가
- [x] `/app/page.tsx` 예약 카드에 "전체 예약" 버튼 추가
- [x] `tests/hr-aggregate.test.ts` — 11건 (maskCell 경계 3건, burnoutRate 5건, 상수 회귀 가드 3건)

**검증**: typecheck clean · vitest 138/138 (이전 127 + 신규 11)

## 3. 결정 사항

- **HRReport 모델은 만들지 않음 (on-demand 집계만)** — 차트(D23)·PDF(D24) 둘 다 매번 `computeDashboard` 호출. 발행 이력·스냅샷이 필요한 케이스가 본 프로젝트에 없음. "매달 1일 자동 cron"은 V2
- **k-anon 가드는 단일 모듈 `lib/hr/aggregate.ts`** — Prisma extension 으로 wrap 하는 강한 보장 대신, HR server action 들이 모두 이 모듈만 거치도록 강제하는 약한 보장 + 단위 테스트 + abilities cross-check 조합. 시드 v2 의존 작업이 늘어나지 않음
- **0건은 마스킹 안 함** — 실제 0 과 <5 의 구분 가능해야 차트 가독성 확보. PRD §H1 AC3 "k<5 셀은 '<5명'으로 마스킹" 해석에 따라
- **분자 < k 비율 마스킹** — 번아웃 비율 등 비율 셀도 분자가 1~4 면 역추정 차단을 위해 비율 자체 마스킹 (분모만으로 역산 가능하면 익명성 깨짐)
- **BR-12 모집단 = STATISTICS 동의자 ∩ 회사 EMPLOYEE ACTIVE** — `listStatisticsConsenterUserIds`로 user id 집합 만들고 모든 집계 쿼리에 `userId IN (...)` 필터. 미동의자는 자가진단 데이터가 있어도 모집단에서 제외
- **부서 헤드카운트 < k 면 자동 셀 마스킹** — 헤드카운트는 회사 단위 공개 정보로 보고 노출하지만, 그 부서의 이용 사용자 수는 식별성 회피 위해 강제 마스킹
- **시드 STATISTICS 동의는 40/50명 (인덱스 % 5 ≠ 0)** — BR-7 동의자 ≥10 통과 + 미동의자 10명 잔존으로 BR-12 모집단 제외 가드 검증 가능

## 4. 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| `"use server"` 파일에서 동기 헬퍼 export 시 빌드 에러 | Next.js 15 RSC 룰 — server action 파일은 async export 만 허용 | `thisMonthUtc` 등 헬퍼를 `lib/hr/period.ts`로 분리 |
| D22 단독 대시보드 데이터 빈약 | 시드 v1 에 Assessment 데이터 없음 (W2에서 직접 가입·진단 한 데이터만 존재) | 정상 동작 — D25 시드 v2 에 1개월치 자가진단 시뮬레이션 데이터 들어오면 차트가 그럴듯해짐. D22 까지는 가드 로직과 UI 골격 검증이 목적 |
| `pnpm db:seed` 외래키 제약 위반 (`RiskFlag_subjectUserId_fkey`) | W3 신설 모델(RiskFlag·Escalation·Feedback)의 User 외래키가 onDelete 미지정 (RESTRICT) 이지만 `wipe()` 함수에 해당 deleteMany 누락. D22 시드 재실행 시점에 발견 | `wipe()` 맨 앞에 Feedback → Escalation → RiskFlag 순으로 deleteMany 추가. W3 잔여 버그였고 시드 재실행 케이스가 W3 동안 없어서 누락이 가려져 있었음 |

### Day 23 (목) — HR 대시보드 차트 (recharts)

- [x] `recharts` 추가 (`pnpm add recharts`)
- [x] `lib/hr/aggregate.ts` — `computeMonthlySeries(db, { companyId, monthsBack, asOf })` 신설 (월 버킷 + BR-12 모집단 + 셀별 k=5 마스킹)
- [x] `lib/actions/hr.ts` — `getMonthlySeries` server action (HRReport read, monthsBack 1~12 클램프)
- [x] `prisma/seed.ts` — STATISTICS 동의자 30명에게 최근 5개월 분산 자가진단 ~50건 (카테고리·심각도 다양, 결정론적 해시 분배)
- [x] `app/(roles)/hr/dashboard/_components/charts.tsx` — `MonthlyTrendChart` (선차트) + `HorizontalBarChart` (가로 막대, 마스킹 셀 회색)
- [x] `/hr/dashboard/page.tsx` — 차트 3개 연결
  - 월별 자가진단 추이 (최근 6개월)
  - 카테고리 분포 (가로 막대)
  - 부서별 이용 (가로 막대, `<5명` 마스킹 시 회색)
  - 심각도 분포는 기존 텍스트 리스트 유지 (5단계 고정 + 마스킹 표현 단순)
- [x] `tests/hr-aggregate.test.ts` — `computeMonthlySeries` 4건 (동의자 0 / 월 버킷 / 셀 k=5 마스킹 / BR-12 모집단 제외) — vi.fn 으로 prisma client mock

**검증**: typecheck clean · vitest 142/142 (이전 138 + 신규 4)

**디자인 결정**:
- **선차트 vs 막대차트**: 시계열은 선, 카테고리·부서는 가로 막대로. 카테고리는 도넛 후보였지만 마스킹 셀 표현이 도넛은 부자연스러워서 막대 채택
- **추이 기간**: 6개월 (PRD §12 의 "월별 추이" 결정 시점) — 분기·1년은 V2 의 사용자 선택지로
- **대시보드 전체 기간 통일 (verify 후 fix)**: 초기엔 카테고리·심각도·부서를 `thisMonthUtc()`, 추이만 6개월로 분리했었으나 한 화면 안에 기간이 2종이 되어 인지부담 큼. 모두 `lastNMonthsUtc(6)` 으로 통일
- **색상**: shadcn brand 토큰 대신 직접 hex (`teal-600` / `slate-300`) — recharts 의 CSS 변수 지원 미흡, 디자인 토큰화는 V2 polish
- **마스킹 시각화**: 막대 → 회색(slate-300) 채움 + tooltip "<5명 (마스킹)". 선차트 → 0으로 그리되 tooltip 명시
- **심각도는 차트 X**: 5단계 + 마스킹 표현 단순. 텍스트 리스트가 인지부담 적음

**verify 중 발견·해결**:
- 시드 분배 modulo 충돌 버그 — `monthsAgo` 와 `categorySlug` 가 같은 `i % 5` 인덱스를 써서 monthsAgo=0 인 모든 record 가 자동으로 CATEGORIES[0]=depression 으로 몰림. 결과: "이번 달 우울만 12회" 같은 단조로운 분포가 나타남. fix: `monthsAgo = floor(i / 6)` 으로 독립화. ASSESSMENT_DISTRIBUTION 배열 + assignmentIdx 패턴도 제거하고 사용자별 직접 처리로 단순화

## 5. 다음 시작점 — Day 24

`generate_hr_insight` Claude tool + `/hr/reports` 리스트·상세 + PDF 다운로드:
- `lib/ai/insight.ts` — mock 우선 (D9 / D17 / D19 패턴), 입력은 `DashboardData` + 전월 비교, 출력은 1단락 인사이트 + Key Takeaways 3 + Recommended Actions 3
- `/hr/reports` 페이지 — 발행 이력 (on-demand 집계지만 발행 시점 기록 — Outbox 또는 단순 row?) → D24 시작 시 결정
- `/hr/reports/:id` — 1페이지 인사이트 + 차트 3개 + Action Item
- PDF: react-pdf (Vercel 호환) — 또는 puppeteer 비교 후 결정

### W4 잔여 일정

- D24 (금): `generate_hr_insight` + `/hr/reports` + PDF
- D25 (토): 시드 v2 + `/admin/audit-logs`
- D26 (일): `/admin/risk-queue` (운영자 ack UI)
- D27 (월): demo-scenario E2E
- D28 (화): 회고 + 최종 polish

## 6. 참고 링크

| Day | Commit | 설명 |
|---|---|---|
| D22 | (pending) | HR k-anon + BR-7 + BR-12 + 대시보드 텍스트 카드 + bookings 목록 |

- 테스트 계정 (모든 비밀번호 `testpass1234`):
  - HR: `hr@mindbridge.test`
  - HR(2): `hr02@mindbridge.test`
  - 직원: `employee@mindbridge.test`
- 시드 재실행 필요 (`pnpm db:seed`): STATISTICS 동의 40건이 새로 추가됨. 안 돌리면 BR-12 모집단 0명 → 모든 셀 0건
- dev 서버: `pnpm dev` → http://localhost:3001
- HR 대시보드: http://localhost:3001/hr/dashboard
- 직원 예약 목록: http://localhost:3001/app/bookings

## 7. 학습 메모 (디자이너의 W4 Day 22)

- **모집단·셀·발행 가드의 3단계 분리** — 동일 익명성 정책이 BR-12 (모집단 단계 제외) → BR-5 (셀 단계 마스킹) → BR-7 (발행 단계 차단) 순으로 흐름. 한 곳에서 다 처리하지 않고 단계로 분리하면 각 단계가 단위 테스트로 검증 가능. 디자인의 "토큰 → 컴포넌트 → 페이지" 분리와 같은 원리
- **PRD 명시 임계값을 상수로 단단히** — `K_ANON_THRESHOLD = 5`, `BR7_MIN_HEADCOUNT = 20`, `BR7_MIN_CONSENTERS = 10`. 회귀 가드 테스트가 상수 값을 직접 검증. 누군가가 "10으로 바꾸면 더 익명" 같은 마음으로 임의 수정할 경우 즉시 테스트 실패. 정책 변경은 PRD 합의 후 한 줄 commit
- **분자 마스킹의 발견** — 처음엔 "비율이니까 마스킹 안 해도 됨" 생각했는데, 분모가 공개되어 있으면 비율로 분자 역산 가능. "5/100=5%" 표시 시 5명 자체 식별 위험. 분자 < k 면 비율 자체 마스킹. 디자인의 "이미지가 작아도 메타데이터엔 원본 크기가 남는다" 비슷한 함정
- **시드 데이터가 가드 검증의 절반** — 코드로 BR-12 모집단 제외를 구현해도 시드에 STATISTICS 동의자가 0명이면 "모두 제외 → 모든 셀 0" 만 검증됨. 동의자/미동의자 분포를 시드에 명시적으로 넣어야 가드의 양면을 모두 확인 가능. 시드는 단순 fixture 가 아니라 "정책의 의도된 케이스를 보여주는 시연 시나리오" 역할
