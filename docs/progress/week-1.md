# Week 1 — Foundation (인증·5롤·시드)

**기간**: 2026-05-20 (단일 세션, Day 1~5 연속)
**상태**: ✅ 완료 (Day 6·7 예비 작업은 미수행)
**검증**: 5롤 로그인 → 각자 다른 home 화면 + cross-prefix `/403` 자동 차단 + `pnpm db:seed` 멱등 재현 + 14개 unit 테스트 통과

---

## 1. 목표

`mindbridge-dev-plan.md §2 Week 1`의 Day 1~5 완수:
- Tailwind + shadcn 컴포넌트 첫 적용 + Prisma migration 트래킹 시작
- NextAuth Credentials + 미들웨어 prefix 라우팅 (5롤)
- CASL ability + Server Action 권한 데코레이터 + AuditLog 자동 기록
- 5롤별 레이아웃·빈 대시보드·글로벌 nav
- 시드 v1 — Company 1, Department 3, Category 8, EMPLOYEE 50, COUNSELOR 10, PSYCHIATRIST 3, HR 2, ADMIN 1

Day 6(상태 컴포넌트)과 Day 7(Sentry·Pino·Rate limit·Playwright)은 **예비**로 분류되어 있어 이번 주에 미수행. Week 2 시작 전 또는 Week 1 끝의 여유 일정으로 둠.

## 2. 완료한 작업

### Day 1 (월) — shadcn + Prisma migration baseline (commit `671a607`)
- [x] `prisma/migrations/0_init/migration.sql` 생성 (현재 Neon 스키마의 baseline, 11KB)
  - `migrate diff --from-empty --to-schema-datamodel` → `migrate resolve --applied` 방식 (DB reset 없이 마이그레이션 트래킹 시작)
- [x] `pnpm dlx shadcn@latest add button card` — `components/ui/button.tsx`, `components/ui/card.tsx`
- [x] `app/globals.css` — shadcn semantic 토큰 14개 추가, brand/risk 컬러는 그대로. primary=brand-700, ring=brand-500, destructive=risk-l3 재활용. 다크모드는 V2로 명시 보류
- [x] `app/page.tsx` 랜딩을 Card + 두 Button variant 로 교체 (토큰 적용 미리보기)
- [x] `pnpm-lock.yaml` commit (Week 0에서 누락된 점 정정)

### Day 2 (화) — NextAuth Credentials + role-prefix middleware (commit `4eb9d31`)
- [x] `lib/auth.ts` — Credentials provider, bcrypt 12 라운드, Zod 입력 검증, JWT 콜백에 `role`/`anonymizedId` 담기
- [x] `lib/role-routes.ts` — `ROLE_HOME` (client/server 양쪽 안전, prisma 의존성 분리 위해 별도 파일)
- [x] `types/next-auth.d.ts` — Session/JWT 타입 확장
- [x] `app/api/auth/[...nextauth]/route.ts` — handler
- [x] `middleware.ts` 갱신 — `getToken` 기반 role 검증. 비로그인 → `/signin?from=...`, 다른 롤 → `/403`. `/app/emergency`는 PUBLIC (PRD US-E4)
- [x] `app/signin/page.tsx` — Card 안에 이메일·비밀번호 폼 (shadcn 적용)
- [x] `app/403/page.tsx` — 접근 권한 없음 페이지
- [x] `prisma/seed.ts` Day 2 임시 증분 — Company 1 + 5롤 1명씩 (멱등 upsert)
- [x] cookie-jar curl 자동 검증 — HR/EMPLOYEE/ADMIN 3롤 로그인 + cross-prefix `/403` 차단 확인

### Day 3 (수) — CASL ability + withAuth + AuditLog (commit `c136460`)
- [x] `lib/abilities.ts` — `defineAbilityFor(user)` (PRD §2.2 권한 매트릭스). ADMIN `manage:all`, HR `HRReport`, PSYCHIATRIST/COUNSELOR `ClinicalNote/Session`, EMPLOYEE `OwnAssessment/Booking`
- [x] `lib/with-auth.ts` — `enforce()` 순수 헬퍼 + `withAuth()` Server Action wrapper. 거부 경로는 **항상** `AuditLog` 한 줄 (PERMISSION_DENIED) 기록 후 `ForbiddenError` throw
- [x] `vitest.config.ts` — node env, `@` alias to project root
- [x] `tests/abilities.test.ts` (5) + `tests/with-auth.test.ts` (4) = 9 specs 모두 통과
- [x] DoD 자동 검증: cross-role 시도 → `ForbiddenError` + AuditLog 정확히 1건

### Day 4 (목) — 5롤별 레이아웃·빈 대시보드·글로벌 nav (commit `7688937`)
- [x] `app/(roles)/layout.tsx` — 공통 셸. 로고 + 롤 배지 + 사용자 라벨 + 로그아웃. Server component에서 `getServerSession`. 미들웨어가 막아도 깊은 방어로 세션 검증
- [x] `components/sign-out-button.tsx` — client `next-auth/react` signOut
- [x] 5개 빈 대시보드 (`/app`, `/counselor`, `/psychiatrist`, `/hr`, `/admin`). 각 페이지가 자기 segment role과 session role 일치 확인 → 불일치 시 `/403` redirect (깊은 방어)
- [x] DoD 자동 검증: 5계정 로그인 → 5개 자기 home 페이지 200 + 고유 헤더 문자열 (직원 홈 / 상담사 홈 / 전문의 홈 / HR 대시보드 / 운영자 콘솔)

### Day 5 (금) — 시드 v1 + BLAKE2b anonymizeId 헬퍼 (commit `6b86095`)
- [x] `lib/anon.ts` — `anonymizeId(realId, salt)` BLAKE2b-512 → base64url 22자 (~132bit)
- [x] `tests/anon.test.ts` (5) — 재현성·salt 민감도·출력 shape·empty-salt throw
- [x] `prisma/seed.ts` 전면 재작성 — wipe-and-reseed 패턴 (Day 5 시점엔 시드 외 데이터 없으니 안전)
- [x] dotenv 추가 — `tsx prisma/seed.ts`에서 `.env.local` → `.env` 순으로 환경변수 로드 (Prisma client는 자체 .env 로드, 그 외 변수는 별도 처리 필요)
- [x] 카운트 검증: Company 1 / Department 3 / Category 8 / EMPLOYEE 50 / COUNSELOR 10 / PSYCHIATRIST 3 / HR 2 / ADMIN 1 / Counselor 프로필 10 / Credential 10 / Availability 50 / CounselorCategory 21 / Subscription 1 / InviteCode 5 / Consent 132 / AuditLog 5

## 3. 결정 사항

### 기술 결정 (이번 주에 새로 정해진 것)
| 항목 | 결정 | 이유 |
|---|---|---|
| 마이그레이션 시작점 | `db:push` 결과를 baseline 으로 박제 (DB reset 없이) | 현재 Neon 스키마 보존 + 트래킹만 시작. Week 2부터 정상 `migrate dev` 흐름 |
| shadcn 다크모드 | V2로 명시 보류 | 1개월 MVP, light only 충분 |
| shadcn 토큰 매핑 | primary=brand-700, ring=brand-500, destructive=risk-l3 | 기존 팔레트 재활용으로 톤 일관성 |
| NextAuth 세션 전략 | JWT (DB adapter 없음) | 단순. DB session 어댑터는 V2 검토 |
| 권한 위반 응답 | UI는 `/403` redirect, 내부는 `ForbiddenError` throw, AuditLog 자동 기록 | IA §2 와 일치 |
| 시드 멱등 패턴 | wipe-and-reseed | Day 5는 시드 외 데이터 없음. Week 2부터는 upsert + 보존 패턴 검토 |
| anonymizedId 알고리즘 | BLAKE2b-512 → base64url 22자 (~132bit) | PRD §7.3 BLAKE2b 명세 충실, 충돌 확률 무시 가능 |
| dotenv 도입 | seed 스크립트에서 `.env.local` → `.env` 직접 로드 | Prisma client 외 변수(ANONYMIZATION_SALT) 가 tsx 런타임에서 필요 |

### 디자이너 결정 사항 (대화 중)
- Day 2 ~ Day 4 진행 시 매 Day commit 직후 다음 Day 진행 (Day 1 결과 확인 후 누적 결정)
- Day 5까지 한 세션에 완주 (Week 1 마무리 직후 week-1.md 작성)
- 미해결 톤·UX 결정(예: 사용자 메뉴 디자인·로그아웃 후 안내 메시지)은 Week 2 화면들 들어오면서 함께 결정

## 4. 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| `prisma migrate status` → "current DB is not managed by Prisma Migrate" | Week 0 에 `db:push`만 했고 migrations 폴더 없음 | `migrate diff --from-empty` SQL → `0_init/migration.sql` 박제 → `migrate resolve --applied`. DB reset 없이 baseline 완료 |
| `pnpm-lock.yaml` 미커밋 | Week 0 commit 누락 | Day 1 commit에 함께 포함 |
| shadcn `add` 가 `globals.css` 의 표준 토큰 자동 추가 안 함 | shadcn CLI는 `init` 시점에만 토큰 주입, `add` 시점엔 미적용 | 수동으로 `@theme` 블록에 background/foreground/card/primary/secondary/muted/accent/destructive/border/input/ring 14개 추가. brand/risk는 보존 |
| `useSearchParams()` 빌드 경고 | Next.js 15 룰: `Suspense` 경계 필요 | signin 페이지를 `<Suspense>`로 감싸는 패턴 적용 |
| `tsx prisma/seed.ts` 에서 `ANONYMIZATION_SALT` undefined | Prisma client 는 자체 .env 로드, 그 외 변수는 미로드 | `dotenv` 추가 + seed 상단에서 `.env.local` → `.env` 순서로 명시 로드 |
| `radix-ui` peer dep React 19 경고 | CASL/react도 동일 양상. 라이브러리 메타데이터 미반영 | 경고만, 실 동작 무관. Day 3에 CASL 실사용 시 재확인 — 문제 없었음 |

## 5. 다음 주 시작점 — Week 2 Day 8

`mindbridge-dev-plan.md §3 Week 2` 참조.

### Day 8 (월) — W2 엔티티 마이그레이션 + Onboarding 7화면
- Assessment, AssessmentResponse, MatchRecommendation, Booking 모델을 schema에 추가
- `pnpm db:migrate --name w2_entities` (이제 정상 migrate dev 흐름)
- Onboarding flow: 가입 → 동의 → 닉네임 → 자가진단 진입 (7 화면)
- DoD: 새 직원 계정 가입 → 자가진단 진입 직전까지 클릭 가능

### Day 9 (화) — Claude `classify_category` tool + 자가진단 챗봇 UI
- Anthropic 결제 재결정 시점 (Week 0 결정: Day 9에 보류 풀기)
- 정적 폼 fallback 옵션 보존

### Week 1에 못 한 항목 (Week 2 여유시간 또는 별도 day 분배)
- Day 6 예비: 화면 상태 표준 컴포넌트 (Skeleton / EmptyState / Alert / 404 / 500) — `/403`만 만들었고 나머지 4종 미완
- Day 7 예비: Sentry · Pino · Rate limit · CSP · CSRF · Playwright 골격 — 전체 미수행. Anthropic 결제와 같이 일정 재조정 필요
- Vercel 환경변수 등록 + 첫 배포 시도 — 로컬은 안정적, 배포는 Week 1 끝 시점에 한 번 시도 권장

### 따라가는 미해결 항목 (PRD §11 등)
- 자원 단위 조건(담당 케이스만 / 본인 정산만)은 ability에 placeholder만 있음 → W2/W3 Session·ClinicalNote 모델 들어오면 CASL conditions로 보강
- `ROLE_HOME` 분리(prisma 비의존 client-safe 모듈) 패턴 — 향후 client에서 import 필요 시 동일 패턴 사용
- 시드 v2 (직원 50명에 자가진단 응답·세션·임상노트 시뮬레이션 1개월치) — Week 4 Day 25
- `dotenv-cli`로 `.env` / `.env.local` 단일화 — Week 0 미해결 항목, Week 1에 dotenv 부분 도입했지만 단일화는 아직

## 6. 참고 링크

- Day 1 commit: `671a607` (shadcn Button/Card + Prisma migration baseline)
- Day 2 commit: `4eb9d31` (NextAuth Credentials + role-prefix middleware)
- Day 3 commit: `c136460` (CASL ability + withAuth Server Action decorator)
- Day 4 commit: `7688937` (5-role layout + empty dashboards + global nav)
- Day 5 commit: `6b86095` (seed v1 + BLAKE2b anon helper)
- 사이트 로컬: http://localhost:3000 (dev 서버 실행 시)
- 테스트 계정: 모든 비밀번호 `testpass1234`
  - `employee@mindbridge.test`, `counselor@mindbridge.test`, `doctor@mindbridge.test`, `hr@mindbridge.test`, `admin@mindbridge.test`
  - 추가 49 직원: `emp002@…` ~ `emp050@…`
  - 추가 9 상담사: `counselor02@…` ~ `counselor10@…`
  - 추가 2 전문의: `doctor02@…`, `doctor03@…`
  - 추가 HR: `hr02@…`

## 7. 학습 메모 (디자이너의 두 번째 주)

- 마이그레이션 트래킹 — `db:push`(빠른 prototyping용)는 마이그레이션 히스토리를 안 남기고, `migrate dev`는 남긴다는 차이를 baseline 작업으로 직접 체험. 디자인 시안 버전 관리와 같은 개념(현재 상태 + 변경 이력 분리)
- "권한 매트릭스 한 줄당 한 테스트" 패턴 — PRD §2.2 표를 vitest 5개 스펙으로 1:1 변환하니, 표가 바뀌어도 테스트가 자동으로 빨간색·녹색을 알려줌. 디자인 시스템의 컴포넌트 토큰 매트릭스와 동일 구조
- shadcn은 "init은 토큰 설치, add는 컴포넌트만" — 토큰을 손수 추가해야 함을 첫 회에 체감. 디자인 토큰을 코드로 표현하는 첫 경험
- 시드는 "비어있는 화면을 채워주는 더미 가구" — Day 4 빈 대시보드에 들어갈 데이터의 양·다양성이 디자인 의사결정의 입력. 시드 v2(시뮬레이션)는 본격적인 톤·정보밀도 검증에 필요
