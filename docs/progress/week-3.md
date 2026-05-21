# Week 3 — 상담·위기·피드백 (가장 빡빡한 주, dev plan 분류)

**기간**: 2026-05-19 ~ 2026-05-21 (3 세션, D15~D17 / D18~D19 / D20~D21)
**상태**: ✅ 완료 (W3 게이트 통과)
**검증**: typecheck clean · vitest 127/127 · Playwright E2E 2/2 그린

**W3 게이트** (`mindbridge-dev-plan.md §4`): "위기 자동 감지 30초 + SOAP 자동 변환 + 임상 노트 암호화"
- 위기 감지 측정: ~1.5초 (E2E `[E2E] 위기 감지 delta: 1531ms`)
- SOAP 자동 변환: D17 `generate_soap` mock + 단위 9건
- 컬럼 암호화: D18 AES-256-GCM 적용, E2E raw SELECT 검증으로 SessionMessage.content 평문 0건 확인

---

## 1. 목표

`mindbridge-dev-plan.md §4 Week 3`의 Day 15~21:

- 세션룸(text 채팅, V1 mock + 3s polling)
- 상담사 케이스 대시보드 + 케이스 상세 (진단 요약·이전 노트 시계열)
- SOAP 임상 노트 자동 생성 (Claude `generate_soap` tool)
- 앱 레이어 컬럼 암호화 (AES-256-GCM) — ClinicalNote / SessionMessage / User PII
- Claude `assess_risk` tool + L1~L4 위기 흐름 + 직원 핫라인 배너
- Escalation 큐 · 전문의 사인오프 · SLA cron
- UC-5 피드백 + Week 3 회귀 E2E

**임계 경로 검증**: 박재훈 페르소나 시나리오 — L3 위기 메시지 → 자동 escalation → 전문의 사인오프 → DECIDED 전이, 직원 풀 흐름(세션 입장 → 종료 → 피드백)까지 E2E 1개 spec으로 통합 회귀.

## 2. 완료한 작업

### Day 15 (수) — Session / SessionMessage + 세션룸 채팅 (commit `a6f519b`)
- [x] Prisma: Session, SessionMessage 모델 + 마이그레이션
- [x] `enterSession` / `enterSessionFromBooking` (booking 1:1 session 생성 + SCHEDULED→IN_PROGRESS 전이 + SYSTEM 입장 메시지)
- [x] `sendSessionMessage` + `listSessionMessages` (since 기반 polling)
- [x] `/session/[id]` 공유 라우트 (직원/상담사 같은 방, role 권한 검증은 페이지 내부)
- [x] mock MessagingProvider (Pusher fallback — V2)
- [x] 3초 client polling으로 새 메시지 수신

### Day 16 (목) — 상담사 케이스 대시보드 (commit `e841569`)
- [x] `listCounselorCases` / `getCounselorCase` — 본인 담당 booking + 직원 진단 요약 + 이전 booking 시계열
- [x] `/counselor/cases` 리스트 + `/counselor/cases/[id]` 상세
- [x] EMPLOYEE/HR/PSYCHIATRIST는 CaseAssessment subject 거부 (cross-check)

### Day 17 (금) — generate_soap + 임상 노트 편집기 (commit `1bcb400`)
- [x] Prisma: ClinicalNote 모델 (SOAP 4 필드 + summaryForEmployee + flags) + Session 1:1
- [x] `lib/ai/soap.ts` Claude tool + mock (raw memo → SOAP draft)
- [x] `/counselor/cases/[id]/note` 편집기 — draft 생성 → 수정 → FINALIZED
- [x] 단위 9건 (mock soap, tool schema)

### Day 18 (토) — **컬럼 암호화 (AES-256-GCM)** (commit `7ed3f1b`)
- [x] `lib/crypto/field.ts` — `encryptField`/`decryptField` + keyVersion
- [x] ClinicalNote (SOAP 4필드 + summaryForEmployee), SessionMessage.content, User.realName/phone, Assessment.summaryForCounselor/summaryForEmployee, AssessmentResponse.content
- [x] **DoD: DB 직접 조회 시 평문 0건** — D21 E2E에서 raw SELECT 으로 재검증 (`expect(m.content).not.toContain("수면제")`)
- [x] 단위 9건 (round-trip, null/빈 문자열 처리, keyVersion 검증)

### Day 19 (일) — assess_risk + L1~L4 위기 흐름 + 핫라인 배너 (commit `b7566d5`)
- [x] Prisma: RiskFlag 모델 (polymorphic source, level, status, signals JSON)
- [x] `lib/ai/risk.ts` Claude `assess_risk` tool + mock (보수적 키워드 매칭, false-positive 허용)
- [x] `assessAndFlag` 헬퍼 — 세션 메시지·자가진단 응답에서 호출, RiskFlag INSERT
- [x] 직원 화면 `<RiskBanner>` — L2 이상 감지 시 1393·1577-0199·119 핫라인 노출, L3/L4 downgrade 안 함
- [x] `listRiskFlagsForSubject` / `acknowledgeRiskFlag` server actions
- [x] 단위 14건 (mock level 분류, snippet 추출, prisma enum 매핑)

### Day 20 (월) — Escalation 큐 + 전문의 사인오프 + SLA cron (commit `eca1497`)
- [x] Prisma: Escalation 모델 (PENDING/IN_REVIEW/DECIDED/EXPIRED, RiskFlag 1:1)
- [x] L3 RiskFlag 자동 escalation 생성 + RiskFlag.status=ESCALATED (`assessAndFlag` 트랜잭션 안에서)
- [x] `listEscalations` / `reviewEscalation`(race-safe claim) / `signOffEscalation`(IN_REVIEW + reviewer 검증 + RiskFlag RESOLVED 동시 갱신)
- [x] `/psychiatrist/queue` + `/[id]` UI + SLA 카운트다운 (60분/15분 색상 경계)
- [x] `/api/cron/escalation-sla` cron worker + ESCALATION_SLA_HOURS env (default 24h)
- [x] ESCALATION_EXPIRED 운영자 알림 outbox enqueue (dedupeKey 멱등)
- [x] abilities Escalation 5롤 cross-check
- [x] **풀 시나리오 손 검증**: 박재훈 시나리오 → 자동 escalation → 전문의 사인오프 + SLA cron으로 EXPIRED + 운영자 알림 outbox enqueue + 재호출 멱등성

### Day 21 (화) — UC-5 피드백 + 세션 종료 + Week 3 회귀 E2E (commit `0ab9811`)
- [x] Prisma: Feedback 모델 (Session 1:1, rating 1~5, comment, wantSameCounselor)
- [x] `endSession` server action — IN_PROGRESS→COMPLETED + SYSTEM "종료" 메시지
- [x] `submitFeedback`/`getFeedback` + `applyNewRating` 순수 함수 분리 (Counselor.rating·ratingCount 트랜잭션 갱신)
- [x] 세션룸 종료 버튼 + COMPLETED 시 직원에게 피드백 CTA, 상담사에겐 임상 노트 안내
- [x] `/app/feedback/[sessionId]` 폼 (별 5개 + 코멘트 + 재예약 의사)
- [x] abilities Feedback 5롤 cross-check
- [x] `e2e/week-3-regression.spec.ts` — W3 풀 시나리오 + 위기 감지 30초 assertion + 컬럼 암호화 raw 검증

## 3. 결정 사항

- **mock provider 패턴 W3 확장** — D9 Anthropic + D12 Resend + D15 messaging(Pusher fallback) + D19 assess_risk 모두 동일 `isXEnabled` boolean + 동일 interface + dynamic import. AES-256-GCM 키도 동일 패턴 (D18 `ENCRYPTION_KEY_V1`)
- **L3 자동 escalation 생성 시점은 RiskFlag 생성 즉시** (운영자 ack 후 수동 X) — 박재훈 시나리오 30초 게이트 충족 흐름과 일치 (PRD §5.4 PENDING→전문의 진입)
- **L4는 V1 escalation 자동 생성 안 함** — PRD §1.3 Out-of-scope. 화면 안내 + 운영자 즉시 대응
- **SLA 미준수 시 V1은 EXPIRED + 운영자 알림만**, 자동 재배정은 V2 — 시연 시나리오에 충분, 운영자 화면 알림으로 후속 조치
- **ESCALATION_SLA_HOURS env 도입** (default 24h) — PRD spec 유지하면서 시연·E2E에서 단축 가능 (ESCALATION_SLA_MINUTES_OVERRIDE도 옵션)
- **세션 종료 트리거는 명시 버튼** (양측 합의 대기 없음) — 한 명만 누르면 즉시 COMPLETED. V1 단순화
- **피드백 코멘트는 상담사 본인에게 노출 안 함** — V1은 집계 평점만, 코멘트는 운영자 품질 모니터링용. 개별 코멘트 노출은 V2
- **W3 회귀 E2E는 시드 계정 재사용 + 잔여 row 정리** — 매 spec 시작 시 RiskFlag·Feedback deleteMany. 새 직원 가입은 W2 E2E가 검증

## 4. 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| Prisma client 재생성 EPERM (D20) | next dev 서버가 query_engine.dll 점유 | `Get-NetTCPConnection -LocalPort 3001` → 프로세스 식별 후 종료. dev 진행 중에 schema 변경하면 자주 발생 |
| W3 회귀 E2E 첫 실행 timeout | 같은 머신의 Stylefit 프로젝트가 3000 포트 점유 → MindBridge dev가 reuseExistingServer로 그 페이지를 자기 거라고 착각 | MindBridge dev 포트 영구 3001로 이전 (`package.json` + `playwright.config.ts` + `.env.local` NEXTAUTH_URL) |
| next-auth NEXTAUTH_URL warning | .env.local 미설정 → signOut callback 경로 어긋남 | `NEXTAUTH_URL=http://localhost:3001` 명시 |
| D20 시연 후 cleanup 스크립트가 너무 광범위하게 잡음 | "최근 6시간 내" 조건으로 D19 검증 잔여물 8건까지 cascade 삭제 | 시드에 RiskFlag.create가 없어서 손상은 없었음. 다음 헬퍼는 ID 명시 삭제로 가는 게 안전 |
| 세션 종료 트리거 부재 (D15 갭) | schema enum에 COMPLETED만 있고 실제 전이 액션 없음 | D21에서 `endSession` 신설 + SYSTEM "종료" 메시지로 상대편 종료 추정 (V1 단순화) |

## 5. 다음 주 시작점 — Week 4 Day 22

`mindbridge-dev-plan.md §5 Week 4` 참조. HR 대시보드 + 시연 polish 주.

### Day 22 (수) — HRReport + Department + k≥5 익명성 미들웨어
- `lib/hr/aggregate.ts` — k-anon 가드 (BR-5 임계값 k=5, BR-7 발행 조건 ≥20명 or 동의자 ≥10명)
- HR 화면에서 개인 식별 0건 보장

### Day 23 (목) — HR 대시보드 차트 (이용률·카테고리·번아웃 지표, recharts 또는 tremor)

### Day 24 (금) — Claude `generate_hr_insight` + PDF (react-pdf 또는 puppeteer)

### Day 25 (토) — 감사 로그 화면 + 시드 v2 (1개월치 시뮬레이션 데이터)

### Day 26 (일) — 시연 시나리오 E2E 자동화 (Playwright, 5단계 풀)

### Day 27 (월) — 데모 워크스루 스크립트 + 데모 환경 격리 점검

### Day 28 (화) — 리허설 + DB 스냅샷 + 최종 polish

### W3 에서 못 한 항목 / Follow-up
- ~~**EXPIRED Escalation UI 갭**~~ — D21 후 carry-over fix 완료 (commit `48fa7eb`). PSYCHIATRIST 본인 reviewer였던 EXPIRED 케이스는 24h 동안 큐에 잔존 + 상단 안내 배너. E2E 회귀 spec 추가
- **상담사가 본인 받은 피드백 코멘트 read** — 현재 V1은 집계만, 코멘트 V2
- **L4 자동 emergency 통보** — V1 화면 안내만, 119 자동 연계 V2
- **세션 종료의 양측 합의 흐름** — V1은 한 명만 눌러도 종료. 양측 종료 흐름 V2

### 따라가는 미해결 항목 (PRD §11 등)
- 자원 단위 CASL conditions (담당 케이스만, 본인 정산만) — W4 또는 V2 보강
- Pusher real-time (V2) — V1은 mock + 3s polling 으로 충분
- 시드 v2 (1개월치 시뮬레이션) — W4 Day 25
- 알림 템플릿 i18n — V2

## 6. 참고 링크

| Day | Commit | 설명 |
|---|---|---|
| D15 | `a6f519b` | Session/SessionMessage + mock messaging + 3s polling |
| D16 | `e841569` | 상담사 케이스 대시보드 + 상세 |
| D17 | `1bcb400` | ClinicalNote SOAP + generate_soap mock + 임상 노트 편집기 |
| D18 | `7ed3f1b` | 앱 레이어 컬럼 암호화 (AES-256-GCM) |
| D19 | `b7566d5` | assess_risk + RiskFlag + L1~L4 + 핫라인 배너 |
| D20 | `eca1497` | Escalation 큐 + 전문의 사인오프 + SLA cron |
| D21 | `0ab9811` | UC-5 피드백 + 세션 종료 + Week 3 회귀 E2E |
| D21+ | `48fa7eb` | (carry-over) EXPIRED Escalation 본인 큐 잔존 (24h) |

- 테스트 계정 (모든 비밀번호 `testpass1234`):
  - 직원: `employee@mindbridge.test`
  - 상담사: `counselor@mindbridge.test` (상담사-A)
  - 전문의: `doctor@mindbridge.test` (전문의-A)
  - 운영자: `admin@mindbridge.test`
- E2E 실행: `pnpm e2e` (chromium 단일, W2+W3 풀 약 1.1분)
- cron 수동 트리거:
  - `curl -X POST http://localhost:3001/api/cron/outbox`
  - `curl -X POST http://localhost:3001/api/cron/escalation-sla`
- dev 서버 포트는 3001 (`pnpm dev` 자동 적용, `.env.local` NEXTAUTH_URL 일치)

## 7. 학습 메모 (디자이너의 네 번째 주)

- **mock provider 패턴이 W3에서 진가 발휘** — Anthropic 결제 보류 상태에서 D17 SOAP / D19 assess_risk 두 신규 tool 모두 mock으로 풀 구현·검증. ANTHROPIC_API_KEY만 등록하면 코드 한 줄 안 바꾸고 전환. 디자인의 "디자인 토큰 vs 하드코딩" 분리와 같은 원리
- **트랜잭션이 데이터 정합성의 마지막 방어선** — D20 자동 escalation 생성 / D21 Counselor rating 갱신 / D18 ClinicalNote enc + SessionMessage enc 동시 갱신 모두 prisma `$transaction` 안에서. 부분 실패 시 일관성 깨지면 사용자 신뢰가 무너지는 케이스 (위기 신호가 RiskFlag만 생기고 Escalation 빠짐 같은)
- **시연 시나리오를 자동화로 옮긴 것이 가장 큰 회귀 안전망** — D21 E2E에서 직원 풀 흐름 + 위기 감지 시간 + 전문의 사인오프까지 한 spec으로 30초 안에 통과. 손으로 검증할 때보다 빠르고 같은 시나리오를 매 commit 가드. PRD가 명시한 게이트("30초")가 측정 가능한 assertion으로 옮겨진 게 핵심
- **abilities cross-check 룰이 D19~D21 회귀 0** — D10·D11에서 두 번 데인 후 메모리에 신설(`feedback_ability_crosscheck.md`). RiskAlert·Escalation·Feedback 신규 subject 3건 모두 5롤 cross-check 같이 들어가서 통합 회귀 0. "내가 잊을 수 있는 일을 메모리가 대신 기억하게 한다"의 좋은 사례
- **포트 충돌 사건이 환경 인프라의 가독성 의식** — Stylefit과 MindBridge가 같은 머신에서 같은 포트 충돌. `reuseExistingServer: true`가 다른 앱을 자기 거라고 착각해서 silent fail. dev 환경의 "어디서 누가 응답하는지"가 명확해야 디자인 시안의 컴포넌트 트리처럼 디버그 가능 — 포트 영구 3001 + NEXTAUTH_URL 명시로 정리
