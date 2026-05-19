# MindBridge MVP 개발 플랜
## 정신건강 EAP 멀티롤 플랫폼 · 1개월 Claude 활용 MVP
### 기반 기획안: `golden-hugging-hamster.md`

---

## 0. 전체 전략

### 원칙
1. **데이터 모델·권한·시드부터** — 멀티롤은 권한이 무너지면 시연 자체가 무너짐
2. **임계 경로 = 직원 여정** — 자가진단 → 매칭 → 예약 → 세션 → 위기 감지 → HR 리포트. 이 한 줄이 끊기지 않게
3. **AI tool은 Day별로 한 개씩** — `classify_category`(W2) → `generate_soap`(W3) → `assess_risk`(W3) → `generate_hr_insight`(W4)
4. **시연 무중단이 최우선** — Week 4는 시드·E2E·리허설로 안정성 확보

### Claude Code 활용 분담

| Claude에 위임 | 사람이 직접 |
|---|---|
| Prisma 스키마 작성 | 위기 감지 임계값 튜닝 |
| Server Action 코드 | 시연 시나리오 회귀 |
| CASL ability 정의 | 보안 점검·암호화 키 관리 |
| 이메일 템플릿 | 시연 스크립트 |
| UI 와이어업 (shadcn) | 임상 데이터의 임상적 타당성 검토 |
| 시드 데이터 생성 | 클라이언트 시연 리허설 |
| Vitest unit 스펙 | Playwright E2E 시나리오 설계 |

---

## 1. Week 0 — Pre-Sprint (1~2일)

시작 전에 해두지 않으면 Week 1이 흔들립니다.

### 셋업 체크리스트

**Week 0 즉시 (필수 4개)**
- [ ] Git 레포지토리 생성 + GitHub 연동
- [ ] Vercel 프로젝트 생성 (**Vercel 기본 도메인 사용**, 별도 도메인 없음)
- [ ] Neon Postgres 데이터베이스 (free tier)
- [ ] Anthropic API 키 발급 + 콘솔 spend alert 설정

**필요 시점에 가입 (deferred — 미리 만들 가치 없음)**
- [ ] Sentry 프로젝트 → **Day 7** (Week 1 마지막, 모니터링·CSP 셋업 시)
- [ ] Resend 계정 → **Day 12** (Sandbox 모드, 도메인 인증 V2)
- [ ] Pusher 계정 → **Day 15** (Week 3 세션룸 작성 시)

**코드/문서 (Claude)**
- [ ] `docs/setup.md` 가입 가이드
- [ ] `.env.example` 표준화
- [ ] Next.js 15 프로젝트 부트스트랩
- [ ] W1 P0 Prisma 스키마 초안

---

## 2. Week 1 — Foundation

목표: 5롤이 따로 보는 그릇 + 권한 시스템 완성

| Day | 작업 | 산출물 | DoD |
|---|---|---|---|
| 1 (월) | Next.js 15 + Prisma + Tailwind + shadcn 셋업, W1 P0 엔티티 스키마 | `prisma/schema.prisma` 1차 | `prisma migrate dev` 통과 |
| 2 (화) | NextAuth Credentials + 미들웨어 prefix 라우팅 | 인증 흐름, 5롤 진입 미들웨어 | 5롤 로그인 후 prefix 차단 |
| 3 (수) | CASL ability 정의 + Server Action 권한 데코레이터 + AuditLog 자동 기록 | `lib/abilities.ts`, `withAuth()` 데코 | 권한 위반 시도 → 403 + AuditLog 1건 |
| 4 (목) | 5롤별 레이아웃·빈 대시보드·글로벌 nav | `app/(roles)/...` 디렉토리 구조 | 5계정 로그인 → 각자 다른 화면 |
| 5 (금) | 시드 v1: 가상 기업 1, 직원 50, 상담사 10, 전문의 3 (Faker + Claude로 케이스 텍스트) | `prisma/seed.ts` | `npm run seed` 재현 가능 |
| 6 (토/예비) | 화면 상태 표준 컴포넌트 (Skeleton/EmptyState/Alert/403/404/500) | `components/states/` | 모든 페이지 5상태 노출 가능 |
| 7 (일/예비) | Sentry·Pino·Rate limit·CSP·CSRF + Playwright 골격 | `instrumentation.ts`, `e2e/smoke.spec.ts` | 의도적 에러 → Sentry 도착 |

**Week 1 게이트**: 시연 데모 30초 — "5롤 따로 로그인 → 권한 위반 → AuditLog 표시"

---

## 3. Week 2 — 직원 여정

목표: 자가진단부터 예약·이메일까지 풀 플로우

| Day | 작업 | 산출물 | DoD |
|---|---|---|---|
| 8 | W2 엔티티 마이그레이션 + Onboarding 7화면 | 가입 → 동의 → 닉네임 → 자가진단 진입 | Onboarding flow 동작 |
| 9 | Claude `classify_category` tool + 자가진단 챗봇 UI (스트리밍) + 프롬프트 캐싱 | `lib/ai/triage.ts`, `app/assessment/` | 4~6턴 후 카테고리·심각도 결과 카드 |
| 10 | 매칭 알고리즘 (BR-4 가중치) + 추천 카드 3개 | `lib/matching.ts`, `MatchRecommendation` 저장 | 자가진단 결과 → 상위 3명 노출 |
| 11 | Booking + 슬롯 동시성 (DB 유니크 제약 + Optimistic UI) + 예약 화면 | `createBooking` Server Action | 같은 슬롯 동시 클릭 → 1명만 성공 |
| 12 | Resend + NotificationOutbox + cron 워커 | `lib/notifications/outbox.ts` | 예약 시 이메일 도착 (Outbox 트랜잭션) |
| 13 | InviteCode 발급·검증 (HR `/hr/invites`) | 코드 발급 UI, 직원 가입 검증 | HR이 코드 발급 → 직원 가입 |
| 14 | 직원 여정 E2E + Claude API 비용·지연 측정 | `e2e/employee-journey.spec.ts` | E2E 그린, 자가진단 응답 <5s |

**Week 2 게이트**: 김민지 페르소나 풀 시연 — 자가진단 → 매칭 → 예약 → 메일 수신

---

## 4. Week 3 — 상담·위기·피드백 (가장 빡빡한 주)

목표: 도메인의 정수 구현 — 세션·SOAP·위기 감지·피드백

| Day | 작업 | 산출물 | DoD |
|---|---|---|---|
| 15 | Session / SessionMessage + Pusher 세션룸 채팅 | `app/session/[id]`, Pusher 채널 | 두 계정이 같은 방에서 메시지 교환 |
| 16 | 상담사 대시보드·케이스 상세 (진단·이전 노트 링크) | `/counselor/cases`, `/counselor/cases/:id` | 이수현 계정이 김민지 케이스만 표시 |
| 17 | Claude `generate_soap` tool + 임상 노트 작성 UI | `lib/ai/soap.ts`, ClinicalNote 편집기 | 메모 1줄 → SOAP 자동 생성 |
| 18 | **컬럼 암호화 (AES-256-GCM)** 적용 — ClinicalNote / SessionMessage / User PII | `lib/crypto/field.ts` + Prisma extensions | DB 직접 조회 시 평문 0건 |
| 19 | Claude `assess_risk` tool + L1~L3 흐름 + 직원 화면 핫라인 배너 | `lib/ai/risk.ts`, RiskFlag 생성 | 박재훈 시나리오 → 30초 내 L2 알림 |
| 20 | Escalation 큐·전문의 사인오프·SLA 카운트다운 | `/psychiatrist/queue`, SLA 만료 cron | L3 케이스 → 전문의 큐 → DECIDED 전이 |
| 21 | UC-5 피드백 + Week 3 회귀 E2E | `/app/feedback/:sessionId` | E2E 그린 |

**Week 3 게이트**: 위기 자동 감지 30초 + SOAP 자동 변환 + 임상 노트 암호화 검증

**⚠ Day 18 픽스**: Day 17 SOAP 도입 직후 즉시 암호화 적용. 미루면 마이그레이션 누적 + 시연 데이터 재생성 필요.

---

## 5. Week 4 — HR 대시보드 + 시연 polish

목표: HR 리포트 완성 + 시연 안정성 확보

| Day | 작업 | 산출물 | DoD |
|---|---|---|---|
| 22 | HRReport + Notification + Department 엔티티, 익명 집계 쿼리, **k≥5 응답 미들웨어** | `lib/hr/aggregate.ts`, k-anon 가드 | HR 화면 개인 식별 0건 |
| 23 | HR 대시보드 차트 (이용률·카테고리·번아웃 지표) | recharts 또는 tremor | 추이 차트 3개 |
| 24 | Claude `generate_hr_insight` tool + PDF 생성 (react-pdf 또는 puppeteer) | `lib/ai/insight.ts`, PDF 다운로드 | 1페이지 인사이트 + PDF |
| 25 | 감사 로그 화면 (`/admin/audit-logs`) + **시드 v2** (1개월치 가상 운영 데이터) | `prisma/seed-v2.ts` | 감사 로그 검색, HR 차트 그럴듯 |
| 26 | 시연 시나리오 E2E 자동화 (Playwright) — §7.1의 5단계 | `e2e/demo-scenario.spec.ts` | 시연 자동화 그린 |
| 27 | 데모 워크스루 스크립트(5분/15분), 데모 환경 격리 점검 | `docs/demo-script.md` | 스크립트 완성 |
| 28 | 리허설 1회 + DB 스냅샷 + 시드 재현 스크립트 격리 보관 + 최종 polish | 리허설 영상 녹화 | 30분 데모 리허설 무중단 |

**Week 4 게이트**: 30분 데모 시뮬레이션 무중단 + HR 익명성 검증 통과

---

## 7. 의존성 & 임계 경로

```
[W1 권한·시드] ──┐
                 ├─→ [W2 자가진단·매칭·예약] ─→ [W3 세션·노트·위기] ─→ [W4 HR·시연]
[W1 글로벌 nav]─┘
```

**병렬 가능** (여유 시): Settings 페이지, 알림 센터 UI, Legal 페이지, 에러 페이지 디테일

**임계 경로 차단 요소**

| 차단 | 시점 | 영향 |
|---|---|---|
| 권한 시스템 실패 | W1 Day 3 | 전 주차 영향, 즉시 fix 필수 |
| Claude API 키 지연 | W2 Day 9 | 자가진단 막힘, 사전 발급 권장 |
| 컬럼 암호화 적용 지연 | W3 Day 18 | 마이그레이션 누적, Day 17 직후 즉시 적용 |
| Pusher 채널 연결 실패 | W3 Day 15 | 세션룸 막힘, SSE fallback 준비 |
| 시드 v2 부족 | W4 Day 25 | HR 차트 빈약, Day 22~25 점진 보강 |

---

## 8. 주요 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| AI 응답 5초 초과 | 프롬프트 캐싱 + sonnet 다운그레이드 + 스트리밍 UX |
| 시연 데이터가 부족·어색 | Day 25에 1개월치 시뮬레이션, Claude로 케이스 텍스트 풍부화 |
| 위기 감지 오탐/누락 | Day 19~26 사이 박재훈·김민지 시나리오 5회 회귀 |
| Claude API 비용 폭주 | Anthropic 콘솔 일 한도 + Sentry 비용 알람 |
| 권한 누수 | E2E에 "역할별 금지 행동" 명시 (HR이 임상 노트 GET → 403) |
| 시연 중 인터넷 장애 | 로컬 시연 환경 + 녹화 영상 plan B |
| Pusher 연결 불안 | Server-Sent Events fallback (시연용 충분) |
| Vercel 콜드 스타트 | 시연 30분 전 워밍 요청 + Vercel Edge 활용 |

---

## 9. 1인 개발 가능성 체크

이 플랜은 **풀스택 1인 + Claude Code 적극 활용** 기준입니다.

| 주 | 1인 가능성 | 비고 |
|---|---|---|
| W1 | ⭕ 충분 | 셋업·권한·시드는 Claude가 큰 도움 |
| W2 | ⭕ 가능 | AI tool 1개 + 매칭·예약 |
| W3 | ⚠ 빡빡 | Pusher + 암호화 + 위기 + SOAP 동시 진행 |
| W4 | ⭕ 가능 | 시드·시연 polish가 핵심 |

**W3가 무리한 경우 대안**
- 5주로 늘림 (W3를 2주로 분할: 세션·노트 / 위기·피드백)
- 또는 Pusher 대신 Server-Sent Events로 간소화 (시연용 충분)
- 또는 W3 스코프 축소: 위기 감지는 L1·L2까지만, L3·L4는 V2로

---

## 10. 매주 금요일 체크포인트

매주 금요일에 DoD 점검 + 시연 후보 시나리오 한 번 돌려보기.

| 주차 | 점검 항목 |
|---|---|
| W1 금 | 5롤 로그인 + 권한 차단 + AuditLog 동작 |
| W2 금 | 자가진단 → 매칭 → 예약 → 메일 풀 플로우 |
| W3 금 | 위기 시나리오 30초 + SOAP 변환 + 암호화 검증 |
| W4 금 | 임원 시연 리허설 30분 무중단 |

미충족 시:
- 다음 주에 캐리오버 또는
- 스코프 축소 (해당 영역 V2로 이동)

---

## 11. 산출물 체크리스트 (데모 직전)

### 코드
- [ ] 메인 브랜치 + 데모 태그 (`demo-v1.0`)
- [ ] 환경 변수 문서화 (`docs/env.md`)
- [ ] 시드 재현 스크립트 격리 보관

### 문서
- [ ] PRD (§1.1, §2 + §5.7, §5.8 참조 작성)
- [ ] IA 문서 (§3 참조 작성)
- [ ] 데모 워크스루 스크립트 5분 / 15분 버전

### 인프라
- [ ] Vercel 기본 도메인 운영 확인
- [ ] DB 스냅샷·백업
- [ ] Sentry·로그 모니터링
- [ ] Plan B (인터넷 장애 시)

---

## Appendix. 빠른 참조

- **기획안**: `golden-hugging-hamster.md`
- **PRD 작성 시 참조**: 기획안 §1, §2, §5.7, §5.8, §5.3
- **IA 작성 시 참조**: 기획안 §3 전체
- **DB 스키마**: 기획안 §5.5 + Prisma 예시
- **E2E 데모 시나리오**: 기획안 §2.1 UC-1~UC-6 조합
- **응급·위기 프로토콜**: 기획안 §8
