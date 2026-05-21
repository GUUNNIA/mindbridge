# Week 2 — 직원 여정 (Onboarding → 자가진단 → 매칭 → 예약 → 알림)

**기간**: 2026-05-20 ~ 2026-05-21 (2 세션, D8~D11 한 세션 + D12~D14 두 번째 세션 중간에 컴퓨터 종료 사건 + 검증 회귀 fix 2건)
**상태**: ✅ 완료 (E2E 풀 플로우 그린 26.9s)
**검증**: Playwright `e2e/employee-journey.spec.ts` 통과 + 동시성 race 수동 검증 (`@@unique([counselorId, scheduledAt])`) + 단위 62/62 + typecheck clean

---

## 1. 목표

`mindbridge-dev-plan.md §3 Week 2`의 Day 8~14 완수:
- W2 엔티티(Assessment, AssessmentResponse, MatchRecommendation, Booking, NotificationOutbox) 마이그레이션
- 직원 7화면 Onboarding (signup → verify-pending → consents → nickname → intro → assessment 진입)
- 자가진단 챗봇 (mock mode, Anthropic key 미등록)
- BR-4 가중치 매칭 + 추천 카드 top-3
- 예약 + 슬롯 동시성 (DB unique 제약)
- Resend + NotificationOutbox + cron worker (mock mode)
- HR InviteCode 발급·이력·폐기
- E2E + Claude API 비용·지연 측정 (mock 기준 평균 1606ms/턴)

**임계 경로 검증**: 김민지 페르소나 시나리오 — 가입 → 자가진단 → 매칭 → 예약 + outbox row enqueue까지 E2E 1개 spec으로 검증.

## 2. 완료한 작업

### Day 8 (월) — W2 엔티티 마이그레이션 + Onboarding 7화면 (commit `7266b30`)
- [x] Prisma: Assessment, AssessmentResponse, MatchRecommendation, Booking 모델 + 마이그레이션 `w2_entities`
- [x] /signup + /signup/verify-pending (dev mode 자동 인증 버튼)
- [x] /app/onboarding/consents · nickname · intro (서버 액션 `submitOnboardingConsents` · `submitNickname`)
- [x] `guardOnboarded(userId)` 헬퍼 — EMPLOYEE 페이지 진입 시 SERVICE+SENSITIVE_DATA consent + nickname 검사 → 미완 단계로 redirect

### Day 9 (화) — 자가진단 챗봇 + classify_category mock (commit `7d1278c` + fix `cbe3cba`)
- [x] `lib/ai/triage.ts` — assistantReply / shouldComplete / detectCrisis
- [x] `lib/ai/client.ts` — classify_category tool 정의 + Mock/Claude provider (RESEND 패턴과 동일하게 ANTHROPIC_API_KEY 자동 전환)
- [x] /app/assessment + /app/assessment/[id] + /result 페이지
- [x] `lib/actions/assessment.ts` — startAssessment / sendAssessmentMessage (transcript 저장 → shouldComplete → classifyCategory → Assessment update)
- [x] **회귀 fix (cbe3cba)**: shouldComplete 가 turnIndex ≥ MOCK_QUESTIONS.length 부터 강제 완료 (hard cap) + 임계 60자→20자. 사용자가 짧게 답할 때 봇이 "정리 멘트" 반복하면서 redirect 안 되는 무한 루프 차단

### Day 10 (수) — BR-4 매칭 + 추천 카드 (commit `d38c3ec` + fix `94a1654`)
- [x] `lib/matching.ts` — 카테고리 일치·평점·가용·다양성·신규(처음 매칭) 가중치
- [x] `lib/actions/match.ts` — listRecommendedCounselors (assessment 본인 소유 검사 + Counselor 풀 + prior booking 조회 + MatchRecommendation 멱등 저장)
- [x] /app/counselors — 카드 3개 (티어 라벨·평점·전문 분야·매칭 점수·이유 텍스트)

### Day 11 (목) — 예약 + 슬롯 동시성 + 상담사 상세 (commit `8af9fb9`)
- [x] `lib/booking.ts` — expandRecurringSlots (8일 base loop + windowStart cut + dedup + ASC sort) · groupSlotsByDay
- [x] `lib/actions/booking.ts` — listCounselorSlots / createBooking (P2002 catch → SLOT_TAKEN) / cancelBooking
- [x] /app/counselors/[id] — 상담사 프로필 + SlotPicker (client, useTransition + optimistic)
- [x] /app/bookings/[id] — 본인 소유 검증, 상태 배지, KST 일시
- [x] DB unique `@@unique([counselorId, scheduledAt])` 가 동시성 진실의 원천 — race 두 브라우저 수동 검증 (직원-002 성공 / 직원-003 "이미 예약된 슬롯입니다.")

### Day 10·11 회귀 fix (commit `94a1654`)
- [x] EMPLOYEE 의 ability matrix 에 신규 server action subject 누락 패턴 — D10 `listRecommendedCounselors`, D11 `listCounselorSlots` 두 곳에서 `Cannot read Counselor` 회귀
- [x] subject "Counselor" → "CounselorRecommendation" (신규) 또는 "Booking" (기존 보유) 으로 교체
- [x] `tests/abilities.test.ts` 에 EMPLOYEE 신규 케이스 + HR 거부 cross-check 추가 → 메모리 룰 `feedback_ability_crosscheck.md` 신설

### Day 12 (금) — NotificationOutbox + Resend/Mock + cron (commit `3914b71`)
- [x] Prisma: NotificationType (4종) + OutboxStatus (4종) + NotificationOutbox 모델 (dedupeKey unique + status/scheduledAt 인덱스 + recipientUserId 인덱스), 마이그레이션 `w2_notification_outbox`
- [x] `lib/notifications/provider.ts` — NotificationProvider interface + ResendProvider (dynamic import) + MockProvider (console.log). RESEND_API_KEY 자동 전환
- [x] `lib/notifications/templates.ts` — 4 종 한국어 템플릿, XSS escape
- [x] `lib/notifications/outbox.ts` — enqueue (트랜잭션 client 받음, dedupeKey 멱등) + processOutbox (PENDING/FAILED + scheduledAt ≤ now + attempts < 5, 실패 시 exponential backoff)
- [x] createBooking 을 `prisma.$transaction` 으로 감싸서 Booking insert + outbox enqueue 동기화 (slot 충돌 시 rollback 이 outbox row 도 정리)
- [x] /api/cron/outbox route — GET/POST, Bearer CRON_SECRET (dev 우회), `processOutbox(20)` 호출
- [x] resend SDK 추가 (`^4.x`). Sandbox 제약(verified email 1개) 알고 mock 모드로 일관

### Day 13 (월·D8~D11과 같은 주 후반) — HR InviteCode + session companyId 통합 (commit `d909a42`)
- [x] /hr/invites 페이지 — IssueInviteForm (이메일 선택, 유효기간 1~90일, 발급 후 코드 + 복사 버튼 + `/signup?code=...` 안내) + 발급 이력 table (상태 pill, revoke 버튼)
- [x] `lib/actions/invites.ts` — createInviteCode (UUID 8자 uppercase, P2002 1회 재시도) / listInvites (회사 격리) / revokeInviteCode (cross-company 시도 AuditLog 기록)
- [x] HR 대시보드 4 카드 grid 로 재배치 + "초대코드" 카드에서 진입
- [x] CASL: HR 에 `update InviteCode` 추가 (revoke 용), abilities.test.ts cross-check 케이스 5롤별 추가
- [x] session/JWT/AuthContext 에 `companyId` 통합 (W3/W4 자원 권한 준비) — `lib/auth.ts`, `types/next-auth.d.ts`, `lib/with-auth.ts`

### Day 14 (화) — Playwright + 직원 여정 E2E (이 commit)
- [x] `playwright.config.ts` — chromium 단일 프로젝트, `webServer: { command: pnpm dev, reuseExistingServer: true }`, dotenv `.env.local`+`.env` 자동 로드
- [x] `e2e/employee-journey.spec.ts` — 단일 spec, 풀 플로우 검증:
  - HR 페르소나로 새 InviteCode 동적 생성 (timestamp 기반 unique)
  - signup → verify-pending → consents → nickname → intro → assessment(4턴) → result → counselors → slot-picker → booking REQUESTED
  - 자가진단 응답 시간 측정 (목표 평균 <5000ms/턴, 실측 1606ms/턴)
  - outbox 검증: BOOKING_REQUESTED row 1건 enqueue + dedupeKey 형식
- [x] DoD: E2E 26.9s 통과 (1 passed)

## 3. 결정 사항

### 기술 결정 (이번 주에 새로 정해진 것)
| 항목 | 결정 | 이유 |
|---|---|---|
| AI provider 패턴 | RESEND_API_KEY / ANTHROPIC_API_KEY 두 환경변수로 자동 전환 (real ↔ mock) | dev 비용 0, 코드 동일 — 키 등록 시 zero-diff 전환 |
| 자가진단 hard cap | turnIndex ≥ MOCK_QUESTIONS.length 면 길이 무관 완료 | 봇 발언("정리 중")과 redirect 동기화. 시연 무한 루프 방지 |
| 매칭 자원 모델 | 신규 subject `CounselorRecommendation` (read/create) — 직원이 Counselor 직접 read 는 거부 유지 | PRD §2.2 권한 매트릭스 정합 (직원 ≠ 상담사 풀 검색) |
| 슬롯 조회 권한 | `Booking` `read` 재사용 (신규 subject 안 만들고) | 슬롯 = 예약 도메인의 사전 단계. EMPLOYEE 가 이미 보유 |
| 동시성 진실의 원천 | DB `@@unique([counselorId, scheduledAt])` + 앱 P2002 catch | 단순 + 정확. 분산 lock 불필요 |
| outbox 패턴 | transactional outbox + cron polling. dedupeKey 로 멱등 | Booking insert 와 알림 row 가 같은 트랜잭션 → 부분 실패 0 |
| outbox 재시도 | exponential backoff (2^n 분), MAX_ATTEMPTS=5 → DEAD | 일시 실패는 자동 회복, 영구 실패는 명시적 DEAD 상태 |
| Resend mode | sandbox 가입은 했더라도 mock provider 로 dev 진행 | sandbox 의 "verified email 1개" 제약과 가상 직원 50명 시드가 비호환 |
| InviteCode 형식 | `INV-XXXXXXXX` (UUID 8자 uppercase, seed 와 동일) | 가독성 + 사람 입력 친화 |
| session companyId | JWT/Session/AuthContext 까지 통합 | W3/W4 자원 단위 권한(본인 회사만)에 필수. 미리 깔아둠 |
| Playwright 셋업 | chromium 단일, 순차 1 worker, reuse dev server | DB 상태 공유 + 빠른 통과 + CI 비용 절감. 병렬은 W3 격리 도입 후 |
| E2E 격리 | 매 spec 마다 unique InviteCode + email + nickname | cleanup 없음 (다음 seed wipe 가 정리). DB 격리 spec 도입은 V2 |

### 디자이너 결정 사항 (대화 중)
- 검증 우선 / 진도 우선 분기점에서 매번 검증 우선 선택 → D9·D10·D11 회귀 3건 발견 + fix
- Resend는 가입 절차만 알아두고 mock 모드로 일관 (실 발송 검증은 V2)
- 발견한 회귀는 fix 2 commit 으로 분리 (D9 / D10·D11) — git log 회고 친화

## 4. 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| 자가진단 무한 루프 (검증 중 발견) | shouldComplete 가 길이 60자만 검사 → 짧은 답변 사용자 영원히 완료 안 됨. assistantReply 는 turn ≥ 5 부터 같은 정리 멘트 반복 | hard cap + 임계 20자. commit `cbe3cba` |
| `/app/counselors` ForbiddenError (검증 중 발견) | EMPLOYEE ability matrix 에 Counselor read 없음 (W1 D3 매트릭스 그대로 유지된 상태) | 신규 subject CounselorRecommendation 도입 + EMPLOYEE 부여. commit `94a1654` |
| `/app/counselors/[id]` 동일 ForbiddenError | listCounselorSlots 도 같은 패턴 | subject Booking 재사용 (EMPLOYEE 보유). commit `94a1654` 같이 |
| Prisma client 잠금 (마이그레이션 후 generate 실패) | dev 서버가 query_engine.dll 점유 | dev 서버 kill → pnpm prisma generate → 재시작 |
| ctx.user.companyId 타입 누락 | session/JWT 에 companyId 없음 | NextAuth callback + types 통합. commit `d909a42` |
| E2E Playwright strict mode 위반 (`이메일 인증`) | CardTitle + route announcer 둘 다 매치 | URL waitForURL 으로 검증 충분 — 텍스트 expect 제거 |
| E2E input fill 시점 element detached | React re-render 중 fill race | `expect(input).toBeEnabled()` + `toHaveValue("")` 명시 대기로 안정화 |
| E2E `getByRole("heading")` 실패 | shadcn CardTitle 이 heading element 안 렌더 | `getByText` + `.first()` 로 우회 |
| LF→CRLF git warning 반복 | .gitattributes 미설정 + Windows | 경고만, 동작 무관. .gitattributes 정리는 W3·W4 정리 작업 |
| sandbox Resend 의 "verified email 1개" 제약 | Resend 정책 (도메인 인증 없으면 발송 주소 격리) | mock provider 로 일관 — 실 발송 검증은 V2 도메인 인증 후 |

## 5. 다음 주 시작점 — Week 3 Day 15

`mindbridge-dev-plan.md §4 Week 3` 참조. **가장 빡빡한 주**로 분류됨.

### Day 15 (수) — Session / SessionMessage + Pusher 세션룸 채팅
- Pusher 계정 가입 시점 (deferred — `docs/setup.md §2.3`)
- 두 계정이 같은 방에서 메시지 교환

### Day 16 (목) — 상담사 대시보드·케이스 상세
- /counselor/cases · /counselor/cases/[id] (자기 케이스만 표시)

### Day 17 (금) — Claude generate_soap tool + 임상 노트 작성 UI
- `lib/ai/soap.ts`, ClinicalNote 편집기

### Day 18 (토) — **컬럼 암호화** (AES-256-GCM, 앱 레이어)
- ClinicalNote / SessionMessage / User PII
- `lib/crypto/field.ts` + Prisma extensions
- **DoD: DB 직접 조회 시 평문 0건**
- ⚠ Day 17 SOAP 도입 직후 즉시 적용 (마이그레이션 누적 회피)

### Day 19 (일) — Claude assess_risk tool + L1~L3 위기 흐름
### Day 20 (월) — Escalation 큐 + 전문의 sign-off + SLA cron
### Day 21 (화) — UC-5 피드백 + 회귀 E2E

### Week 2 에 못 한 항목 / Follow-up
- **counselors/[id]/page.tsx 의 `prisma.counselor.findUnique` 직접 호출** — CASL 우회. W3 보안 강화 시 server action 으로 옮기는 게 정합
- **resend sandbox 실 발송 검증** — V2 도메인 인증 후 또는 DEV_FORCE_EMAIL 환경변수 우회
- **Playwright spec 격리** — 매 spec 깨끗한 DB. transaction rollback fixture or per-spec DB schema. W3·W4 정리 작업
- **vercel.json cron 등록** — `/api/cron/outbox` 를 배포 환경에서 자동 트리거. 배포 시점
- **`.env.local` 단일화** — W0 미해결, W1 dotenv 부분 도입. dotenv-cli 로 단일화는 W3 정리

### 따라가는 미해결 항목 (PRD §11 등)
- 자원 단위 조건(담당 케이스만, 본인 정산만) — Session/ClinicalNote 모델 들어오는 W3에 CASL conditions 로 보강
- 시드 v2 (1개월치 시뮬레이션) — W4 Day 25
- 알림 템플릿 i18n — V2

## 6. 참고 링크

| Day | Commit | 설명 |
|---|---|---|
| D8 | `7266b30` | W2 entities migration + 7-screen Onboarding |
| D9 | `7d1278c` | Assessment chatbot + classify_category mock |
| D9 fix | `cbe3cba` | shouldComplete hard cap |
| D10 | `d38c3ec` | BR-4 weighted matching + top-3 recommendations |
| D11 | `8af9fb9` | Booking + slot concurrency + counselor detail |
| D10·D11 fix | `94a1654` | EMPLOYEE ability cross-check |
| D12 | `3914b71` | NotificationOutbox + Resend/Mock + cron worker |
| D13 | `d909a42` | HR InviteCode + session companyId 통합 |
| D14 | (이 commit) | Playwright + 직원 여정 E2E |

- 테스트 계정: 모든 비밀번호 `testpass1234`
  - 시드 직원: `employee@mindbridge.test` ~ `emp050@mindbridge.test`
  - 시드 상담사: `counselor@mindbridge.test` (상담사-A, SUPERVISOR), `counselor02~10@…` (상담사-B~J)
- E2E 실행: `pnpm e2e` (chromium 단일, 약 27초)
- cron 수동 트리거: `Invoke-RestMethod http://localhost:3000/api/cron/outbox`

## 7. 학습 메모 (디자이너의 세 번째 주)

- **단위 테스트가 모두 그린이어도 통합 시점에 막힘** — D9·D10·D11에서 3 회귀가 단위 55개 통과 상태로 commit됐는데 실 화면에서 다 막힘. 통합/E2E 인프라는 "있으면 좋은" 게 아니라 회귀 비용을 줄이는 본질. D14 E2E 가 W3 부터는 매 commit 가드 역할
- **transactional outbox 패턴** — Booking insert 와 알림 row 를 같은 트랜잭션에 묶어서 부분 실패를 0 으로. mock provider 와 cron worker 분리로 외부 의존성(Resend)이 dev 흐름을 막지 않음. 디자인 시안의 "원자성 박스"와 비슷한 개념
- **mock provider 패턴의 재사용성** — D9 Anthropic / D12 Resend / 향후 D15 Pusher 모두 동일 패턴(`isXEnabled` boolean + 동일 interface + dynamic import). dev 비용 0 + 코드 한 줄도 안 바꾸고 swap
- **CASL ability matrix 가 빌드 시점 가드 역할을 못함** — 새 server action 추가 시 cross-check 누락이 D10·D11 연속 회귀. `feedback_ability_crosscheck.md` 메모리 룰 신설. ability matrix 는 디자인 시안 의 컴포넌트 변형 매트릭스와 같은 구조 — 한 셀만 잊어도 화면이 깨짐
- **E2E selector iteration 의 비용** — D14 첫 셋업에서 `getByRole("heading")` vs `getByText` / strict mode 모호성 / element detached race 등 selector 만 3 iteration. shadcn 의 semantic HTML 손실(CardTitle = div) 이 한 원인. 다음 디자인 시스템 검토 시 `as` prop 등 semantic override 패턴 고려
