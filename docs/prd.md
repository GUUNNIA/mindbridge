# MindBridge — Product Requirements Document (PRD)

> 정신건강 EAP 멀티롤 플랫폼 MVP의 제품 요구사항 정의서.
> 기반 문서: `golden-hugging-hamster.md` (Appendix D 매핑: §1.1, §2, §5.3, §5.7, §5.8)

---

## 0. Document Info

| 항목 | 값 |
|---|---|
| 버전 | 0.1 (초안) |
| 작성일 | 2026-05-19 |
| 상태 | Draft (검토 대기) |
| 기반 기획안 | `../golden-hugging-hamster.md` |
| 자매 문서 | `ia.md` (정보 구조), `../mindbridge-dev-plan.md` (4주 개발 일정) |
| 본 문서의 독자 | 풀스택 개발자(Claude Code 협업), 기획 검토자 |

---

## 1. Overview

### 1.1 제품 정의
MindBridge는 한국 기업 대상 B2B 정신건강 EAP(Employee Assistance Program) 플랫폼이다. 5개 사용자 롤 — 직원, 임상심리사, 정신과 전문의, HR 담당자, 운영자 — 이 하나의 흐름에서 자연스럽게 협진하는 멀티롤 구조를 가지며, Claude API를 활용한 AI 트리아지·임상 노트 자동화·HR 인사이트가 핵심 차별 요소다.

### 1.2 본 MVP의 목적
**기획→PRD/IA→개발에 이르는 프로세스 자체를 검증하는 1개월 학습 프로젝트.** MindBridge는 멀티롤·권한·익명화·AI tool calling·실시간 통신·임상 도메인 제약을 두루 포함하는 충분히 풍부한 학습 케이스로서 선택되었다. 외부 청중을 향한 데모나 사업화 의사결정이 산출물이 아니다.

### 1.3 범위

**In-scope (V1 MVP)**
- 5개 롤 이메일 기반 인증·권한·롤별 대시보드 + 미들웨어/CASL/감사 로그 3중 방어
- Claude 챗봇 기반 자가진단 (PHQ-9 / GAD-7 기반 + AI 카테고리·심각도 분류)
- 상담사 매칭 알고리즘(BR-4 가중치) + 추천 카드 3개
- 예약·취소·노쇼 처리
- 텍스트 기반 세션룸 (실시간 채팅)
- AI 기반 SOAP 임상 노트 자동 변환 + 직원용 요약·Action Item
- 위기 신호 자동 감지 (L1~L3) + 전문의 에스컬레이션 큐 + SLA 모니터
- HR 익명 집계 리포트 (k≥5 익명성, Claude 인사이트, PDF 출력)
- 동의 관리(서비스/민감/통계/마케팅) + 컬럼 암호화 + 데이터 권리 요청
- 알림 (이메일 + in-app, Outbox 패턴)
- InviteCode 기반 직원 가입

**Out-of-scope (V2 이상)**
- 영상·음성 세션 (V1은 텍스트만)
- 자동 결제·청구 (V1은 수동 처리)
- 네이티브 모바일 앱 (V1은 반응형 웹)
- 보험사 연동·API
- 다국어 (V1은 한국어만)
- L4 응급 자동 외부 연계 (V1은 안내 표시만, 실제 119/응급의료센터 연계는 수동)
- Postgres RLS (V1은 앱 레이어 CASL만)
- 실제 환자 데이터·실제 상담사 풀 (V1은 가상 시드 데이터)
- SSO(SAML/OIDC)
- 슈퍼비전 워크플로우 자동화

### 1.4 핵심 가치 가설
- **멀티롤 협진**: 5개 롤이 따로 떨어진 화면이 아니라, 한 케이스의 상태가 자연스럽게 흐른다 → 권한·라우팅·상태 관리의 정합성이 검증 포인트
- **AI 임상 자동화**: 자가진단 분류·SOAP 노트·위기 감지·HR 인사이트 4종이 한 API에서 일관되게 동작 → Claude tool calling·프롬프트 캐싱·fallback의 설계가 검증 포인트
- **익명성·감사성**: HR이 운영하지만 개인 식별 0건, 모든 민감 접근에 감사 기록 → 컬럼 암호화·k-익명성·CASL ability·AuditLog 데코레이터의 정합성이 검증 포인트

---

## 2. Users & Personas

### 2.1 롤 정의

| 롤 | 책임 | 1차 워크플로우 |
|---|---|---|
| **직원 (Employee)** | 자가진단·예약·세션 참여·피드백 | 챗봇 → 상담사 추천 → 예약 → 세션룸 → 피드백 |
| **임상심리사 (Counselor)** | 1차 상담·임상 노트 작성·후속 권고 | 일정 → 케이스 → 세션룸 → 메모 → SOAP |
| **정신과 전문의 (Psychiatrist)** | 위기 케이스 컨설팅·약물 권고·사인오프 | 에스컬레이션 큐 → 리뷰 → 사인오프 |
| **HR 담당자 (HR)** | 익명 집계 모니터링·임원 보고 | 대시보드 → 월간 리포트 → 초대코드 발급 |
| **운영자 (Admin)** | 상담사 풀·정산·위기 알림·품질·감사 | 위기 큐 → 풀 관리 → 정산 → 감사 로그 |

### 2.2 권한 매트릭스

| 자원 | 직원 | 상담사 | 전문의 | HR | 운영자 |
|---|---|---|---|---|---|
| 본인 자가진단 | R/W | - | - | - | - |
| 본인 세션 | R | R/W (담당) | R/W (에스컬) | ❌ | R (감사 사유 필요) |
| 임상 노트 | R (직원용 요약만) | R/W (담당) | R (에스컬) | ❌ | ❌ |
| HR 익명 집계 | - | - | - | R (k≥5) | R/W |
| 정산 | - | R (본인) | R (본인) | ❌ | R/W |
| 위기 알림 | - | R (담당) | R (에스컬) | ❌ | R/W |
| 감사 로그 | - | - | - | - | R |

**원칙**: 모든 권한 위반 시도는 `PERMISSION_DENIED` 액션으로 AuditLog에 기록되며, 화면 응답은 403 또는 인라인 Alert.

### 2.3 페르소나

| 롤 | 페르소나 | 핵심 상황·요구 |
|---|---|---|
| 직원 | 김민지 (32세, 마케팅팀) | PHQ-9 14점 (중등도 우울), 번아웃 자각, **익명성이 최우선** — 회사가 자신이 상담받는다는 걸 모르길 원함 |
| 직원 | 박재훈 (45세, 개발팀장) | 수면장애·만성 불안, 위계 문화 속 사내 상담 거부감, **위기 신호** 시나리오 페르소나 |
| 상담사 | 이수현 (임상심리사 1급, 10년차) | 직장인 우울·번아웃 전문, 평점 4.8, **효율적인 노트 작성**을 원함 |
| 전문의 | 김태영 (정신건강의학과 전문의) | 외부 협력, 주 2회 에스컬레이션 컨설팅, **SLA·사인오프 인터페이스의 명확성**이 핵심 |
| HR | 정유나 (인사기획팀 차장) | 임원 보고용 월간 리포트, **개인정보 절대 차단** 보장 필요, 추이 차트·인사이트 원함 |
| 운영자 | 장하늘 (플랫폼 운영팀) | 위기 알림 즉각 대응 책임, 정산, 상담사 품질 관리, **운영 효율** 중요 |

### 2.4 상담사 자격·온보딩·품질관리

**자격 요건**
- 임상심리사 1급 / 상담심리사 1급 / 정신건강간호사 중 하나
- 임상 경력 3년 이상
- 운영자 승인 후 활성화

**온보딩 흐름**
1. 서류 접수 (자격증·경력증명서·신원확인)
2. 인터뷰
3. 모의 케이스 (가상 환자 시나리오)
4. 슈퍼바이저 매칭
5. 첫 5건 슈퍼비전 (실 케이스 시작 후)

**등급 체계**
| 등급 | 경력 | 책임 |
|---|---|---|
| JUNIOR | 3~5년 | 일반 케이스, 슈퍼비전 받음 |
| SENIOR | 5~10년 | 모든 케이스, 슈퍼비전 가능 |
| SUPERVISOR | 10년+, 교육자격 | 슈퍼비전 + 신규 상담사 교육 |

**품질 관리**
- 월 1회 슈퍼비전 의무
- 분기 평점 리뷰 — 4.0 이하 시 액션 플랜 작성
- 위기 케이스 발생 시 디브리핑 세션 의무

> **V1 MVP에서는 자동 흐름이 아닌 운영자 화면(`/admin/counselors`)에서의 수동 승인·등급 변경·정지로 구현.**

---

## 3. Use Cases & User Stories

### 3.1 핵심 유즈케이스

| ID | 이름 | 요약 | 관련 롤 |
|---|---|---|---|
| UC-1 | 자가진단 → 매칭 → 예약 | Claude 챗봇 4~6턴 → 카테고리·심각도 분류 → 상위 3명 추천 → 예약 | 직원 |
| UC-2 | 세션 → SOAP 자동화 | 세션룸 → 메모 → Claude SOAP 변환 → 직원용 요약·Action Item 노출 | 상담사·직원 |
| UC-3 | 위기 신호 → 응급 대응 | risk score 계산 → L1~L4 분기 → 핫라인 노출 → 전문의 큐 → 사인오프 | 직원·상담사·전문의·운영자 |
| UC-4 | HR 익명 집계 리포트 | 월말 cron → k≥5 검증 → Claude 인사이트 → PDF 생성 | HR·운영자 |
| UC-5 | 세션 후 피드백 루프 | 24h 후 평가 요청 → 매칭 가중치 반영 → 평점 3.0↓ 알림 | 직원·운영자 |
| UC-6 | 기업 도입 → Seat 관리 | 계약 → Subscription 생성 → InviteCode 발급 → 직원 가입 → 월청구 | HR·운영자 |

### 3.2 User Stories (P0)

각 스토리는 `As a [롤], I want [목적] so that [가치]` 형식, **Acceptance Criteria (AC)** 포함.

#### 3.2.1 직원

**US-E1** — As 직원, 자가진단으로 내 상태를 이해하고 싶다, so that 다음 행동을 결정할 수 있다.
- **AC1**: 4~6턴의 챗봇 대화 후 카테고리·심각도·요약 카드가 표시된다
- **AC2**: 카드는 Action Item 3개를 포함한다 (예: "오늘 15분 산책", "전문가와 상담 권유")
- **AC3**: 응답 지연이 5초를 초과하면 스트리밍 placeholder가 보이고, 10초 초과 시 fallback 메시지

**US-E2** — As 직원, 나에게 맞는 상담사를 찾고 싶다, so that 효과적인 상담을 받을 수 있다.
- **AC1**: 자가진단 결과 → 상위 3명의 상담사 카드 노출
- **AC2**: 각 카드에 전문 분야·평점·다음 가능 시간·**추천 이유** 한 줄이 표시된다
- **AC3**: 사용자가 "다른 상담사 보기"로 다음 후보군을 볼 수 있다

**US-E3** — As 직원, 익명으로 상담받고 싶다, so that 회사에 노출되지 않는다.
- **AC1**: HR·운영자 화면에 실명이 표시되는 셀이 0건 (UI 회귀 테스트로 검증)
- **AC2**: 모든 외부 노출 시 익명 ID(BLAKE2b 해시)만 사용
- **AC3**: 회원가입 시 실명 입력 필드가 없다 (닉네임만)

**US-E4** — As 직원, 위기 상황에서 즉시 도움받고 싶다, so that 안전을 확보할 수 있다.
- **AC1**: 위기 키워드 감지 시 5초 내 화면 상단에 1393·1577-0199·119 핫라인이 표시된다
- **AC2**: 사용자가 동의하면 운영자에게 즉시 알림이 발송된다
- **AC3**: 위기 핫라인 페이지(`/app/emergency`)는 로그인 여부와 무관하게 접근 가능

**US-E5** — As 직원, 세션 후 피드백을 남기고 상담사를 변경 요청하고 싶다.
- **AC1**: 세션 종료 24시간 후 피드백 요청 알림
- **AC2**: 5점 척도 + 자유 코멘트 + 재상담 의사 + 다른 상담사 요청 옵션
- **AC3**: 평점이 매칭 가중치(BR-4)에 반영된다

#### 3.2.2 상담사

**US-C1** — As 상담사, 오늘 일정과 케이스를 일목요연하게 보고 싶다.
- **AC1**: 대시보드에 오늘 세션이 시간순 카드로 표시
- **AC2**: 각 카드에서 1클릭으로 진단 요약·이전 노트 접근

**US-C2** — As 상담사, 메모를 SOAP 형식으로 자동 변환하고 싶다, so that 노트 작성 시간을 단축할 수 있다.
- **AC1**: 자유 메모 입력 → 1클릭으로 SOAP(S/O/A/P) 4섹션이 생성된다
- **AC2**: 생성 결과를 수정 가능하며, 최종 저장 전까지 직원에게 노출되지 않는다
- **AC3**: SOAP 응답이 5초 초과 시 스트리밍 표시

**US-C3** — As 상담사, 위험 신호를 자동으로 감지하고 알림받고 싶다.
- **AC1**: 세션 메시지 또는 노트에서 위기 키워드 감지 시 AI 플래그
- **AC2**: 운영자·전문의에게 자동 알림 (L2 이상)

#### 3.2.3 전문의

**US-P1** — As 전문의, 에스컬레이션 큐를 우선순위대로 처리하고 싶다.
- **AC1**: 큐 상단에 SLA 카운트다운 표시
- **AC2**: 사인오프 버튼 + 가족 동의 체크박스 + 의견 입력 필수
- **AC3**: SLA 만료 임박 시 큐 상단 고정 + 색상 강조

#### 3.2.4 HR

**US-H1** — As HR 담당자, 임원 보고용 월간 리포트를 생성하고 싶다.
- **AC1**: 월말 자동 또는 수동 생성 트리거
- **AC2**: PDF 1페이지 + 추이 차트 3개 + Claude 인사이트 1단락
- **AC3**: k<5 셀은 "<5명"으로 자동 마스킹

**US-H2** — As HR 담당자, 개인을 식별할 수 없는 상태로만 데이터를 보고 싶다.
- **AC1**: 모든 화면에 실명 노출 0건
- **AC2**: 회사 직원 수 ≥20명 또는 동의자 ≥10명 미만이면 리포트 생성 자체가 차단(BR-7)

#### 3.2.5 운영자

**US-A1** — As 운영자, 위기 알림에 즉각 대응하고 싶다.
- **AC1**: 위기 큐가 대시보드 상단에 고정
- **AC2**: SLA 모니터로 잔여 시간 표시
- **AC3**: 디스미스(허용된 경우)는 사유 입력 필수 + AuditLog 기록

---

## 4. Business Rules

| ID | 룰 | 비고 |
|---|---|---|
| BR-1 | 세션 표준 길이 50분 | 노쇼·취소 정책 계산 기준 |
| BR-2 | 노쇼 = 예약 시각 +15분 경과 후 무입장 | 자동 상태 전이 |
| BR-3 | 취소 정책: 24h 전 무료 / 24h~2h 30% / 2h 내 100% | 정산·환불 계산 |
| BR-4 | **매칭 가중치**: 카테고리 일치 40 + 평점 20 + 가용시간 20 + 다양성(주니어 노출) 10 + 신규 매칭 보정 10 | 합계 100 |
| BR-5 | k-익명성 임계값 k=5 | HR 응답 직전 검증 |
| BR-6 | 위기 L3 SLA: 24h 내 전문의 사인오프, 미준수 시 재배정 + 운영자 즉시 알림 | Escalation cron으로 강제 |
| BR-7 | HR 리포트 발행 조건: 회사 직원 수 ≥20명 또는 동의자 ≥10명 | 미달 시 리포트 생성 차단 |
| BR-8 | 자가진단 빈도 제한: 사용자당 일 5회 (Rate Limit) | 비용·악용 방지 |
| BR-9 | 세션 빈도: 직원당 월 4회 기본 (플랜별 변동) | Subscription의 limit 필드 |
| BR-10 | 매칭 시 직원 부서 정보는 상담사에게 노출 안 함 | 사내 갈등 회피 |
| BR-11 | 상담사-내담자 동일 회사 라이센스 보유자는 회피 매칭 | 이해상충 |
| BR-12 | 동의 미충족 기능 차단: STATISTICS 미동의 시 HR 집계 모집단 제외 | 동의 체계 |

---

## 5. State Machines

### 5.1 Booking
```
REQUESTED ──(상담사 수락)──→ CONFIRMED
REQUESTED ──(직원 취소)──→ CANCELED_BY_USER

CONFIRMED ──(시각 도래 + 양측 입장)──→ IN_SESSION
CONFIRMED ──(직원 취소)──→ CANCELED_BY_USER
CONFIRMED ──(상담사 취소)──→ CANCELED_BY_COUNSELOR
CONFIRMED ──(시각 +15분 무입장)──→ NO_SHOW

IN_SESSION ──(세션 종료)──→ COMPLETED
```

### 5.2 Session
```
SCHEDULED ──(양측 입장)──→ IN_PROGRESS ──(종료)──→ COMPLETED
SCHEDULED ──(취소)──→ CANCELED
SCHEDULED ──(무입장)──→ NO_SHOW
```

### 5.3 RiskFlag
```
OPEN ──(상담사·운영자 확인)──→ IN_REVIEW
IN_REVIEW ──(해결)──→ RESOLVED
IN_REVIEW ──(외부 의뢰)──→ EXTERNAL_REFERRED
```

### 5.4 Escalation
```
PENDING ──(전문의 진입)──→ IN_REVIEW
IN_REVIEW ──(사인오프)──→ DECIDED
PENDING ──(24h 경과)──→ EXPIRED  // 재배정 + 운영자 알림 트리거
```

### 5.5 Subscription
```
TRIAL ──(결제 확인)──→ ACTIVE
ACTIVE ──(미납)──→ SUSPENDED ──(납입)──→ ACTIVE
ACTIVE ──(기간 만료)──→ EXPIRED
ACTIVE ──(취소)──→ CANCELED
```

---

## 6. Functional Requirements

### 6.1 Server Action 시그니처

> Next.js Server Actions으로 구현. 모든 액션은 `withAuth(role, ability)` 데코레이터로 인증·CASL 검증·AuditLog 자동 기록.

#### 6.1.1 직원
```ts
signUpWithInvite(code: string, email: string, password: string): User
submitConsent(type: ConsentType, version: string): Consent
revokeConsent(type: ConsentType): Consent
startAssessment(): { assessmentId: string, sessionToken: string }
sendAssessmentMessage(assessmentId, text): {
  reply: string,
  riskFlag?: RiskFlag,
  completed?: boolean,
  summary?: AssessmentSummary
}
listRecommendedCounselors(assessmentId): Counselor[3]
listCounselorSlots(counselorId, range: DateRange): Slot[]
createBooking(counselorId, slotAt: Date): Booking
cancelBooking(bookingId, reason: string): Booking
joinSession(sessionId): { token: string, transport: 'pusher' | 'sse' }
sendSessionMessage(sessionId, text): SessionMessage
submitFeedback(sessionId, rating: 1-5, comment, wantSameCounselor: boolean): Feedback
requestDataExport(): DataExportJob
requestAccountDeletion(): DeletionJob
```

#### 6.1.2 상담사
```ts
listMyCases(filter: CaseFilter): Case[]
getCase(caseId): CaseDetail
addClinicalMemo(sessionId, raw: string): { soapDraft: SOAP }
saveClinicalNote(sessionId, soap: SOAP, summary: string, flags: string[]): ClinicalNote
setAvailability(blocks: AvailabilityBlock[]): CounselorAvailability[]
```

#### 6.1.3 전문의
```ts
listEscalations(filter: EscalationFilter): Escalation[]
reviewEscalation(escalationId, decision: string, note: string): Escalation
signOffEscalation(escalationId): Escalation
```

#### 6.1.4 HR
```ts
getDashboard(period: Period): DashboardData  // k≥5 가드
listReports(): HRReport[]
generateMonthlyReport(period: Period): HRReport
issueInvites(emails: string[]): InviteCode[]
revokeInvite(codeId): void
```

#### 6.1.5 운영자
```ts
listRiskQueue(filter): RiskFlag[]
acknowledgeRisk(riskId): RiskFlag
listCounselors(filter): Counselor[]
approveCounselor(counselorId, tier: CounselorTier): Counselor
suspendCounselor(counselorId, reason: string): Counselor
runMonthlyPayout(period): PayoutSummary
searchAuditLogs(filter): AuditLog[]
```

### 6.2 Claude AI Tool 통합

**모델 선택**
- 자가진단·SOAP·HR 인사이트: `claude-sonnet-4-6`
- 위기 감지: `claude-opus-4-7` (정확도 우선) 또는 sonnet + 보수적 임계값

**프롬프트 캐싱**: 시스템 프롬프트(임상 가이드라인·SOAP 템플릿·위기 분류 기준)에 `cache_control` 적용. 다턴 자가진단에서 캐시 적중률 극대화 → 비용·지연 모두 감소.

#### 6.2.1 Tool I/O

```
assess_risk
  input:  { text: string, context?: { assessmentId?, sessionId? } }
  output: {
    level: 'L1' | 'L2' | 'L3' | 'L4' | 'NONE',
    confidence: number,    // 0~1, <0.7은 인간 큐로
    keywords: string[],
    recommendedAction: string
  }

classify_category
  input:  { assessmentTranscript: string }
  output: {
    primaryCategory: string,
    secondaryCategories: string[],
    severity: Severity,
    summaryForCounselor: string,
    summaryForEmployee: string
  }

generate_soap
  input:  {
    memo: string,
    sessionContext: { category, severity, previousNote? }
  }
  output: {
    soapNote: { S: string, O: string, A: string, P: string },
    summaryForEmployee: string,
    actionItems: string[],
    flags: string[]
  }

generate_hr_insight
  input:  { aggregateMetrics: object, previousPeriod?: object }
  output: {
    insightParagraph: string,
    keyTakeaways: string[3],
    recommendedActions: string[]
  }
```

#### 6.2.2 Fallback 정책

| 실패 | 대체 동작 |
|---|---|
| Claude API 다운 | 자가진단: 정적 PHQ-9 폼 / 위기 감지: 키워드 룰 / SOAP: raw 메모 그대로 저장 |
| Circuit breaker | 1분 내 3회 실패 → 5분간 호출 차단, 사용자에게 "일시적 점검" 안내 |
| 응답 5초 초과 | 스트리밍 placeholder, 10초 초과 시 fallback 메시지 |
| 응답 형식 위반 | Zod validation 실패 시 1회 재시도, 재실패 시 raw 저장 + 운영자 알림 |

### 6.3 알림 매트릭스

| 이벤트 | 채널 | 수신자 | 시점 |
|---|---|---|---|
| 예약 확정 | Email + in-app | 직원, 상담사 | 즉시 |
| 리마인더 | Email | 직원 | 24h / 1h 전 |
| 세션 완료 | in-app | 직원 | 종료 후 즉시 |
| 피드백 요청 | Email + in-app | 직원 | 24h 후 |
| 위기 L2 | Email + in-app | 상담사, 운영자 | 즉시 |
| 위기 L3 | Email + SMS | 전문의 | 즉시 |
| 위기 L4 | SMS + 핫라인 안내 표시 | 보호자·119 (V1은 수동) | 즉시 |
| 월간 리포트 | Email | HR | 매월 1일 |
| 갱신 알림 | Email | HR, 운영자 | 만료 30일 전 |

**안정성**: 비즈니스 트랜잭션과 동일 트랜잭션에 `NotificationOutbox` insert → 워커 폴링 → 외부 채널 호출 → 실패 시 지수 백오프 → 5회 실패 시 DLQ.

---

## 7. Non-Functional Requirements

### 7.1 성능

| 항목 | V1 MVP 목표 |
|---|---|
| 페이지 초기 로드 (P95) | < 3s |
| AI 트리아지 응답 (스트리밍 시작) | < 5s |
| AI SOAP 변환 | < 5s |
| 동시 접속자 (실측 목표) | 10명 |
| 동시 세션 채널 | 5개 |

### 7.2 가용성·안정성
- 30분 연속 사용 무중단 (개발 회고용 검증 기준)
- 모든 외부 호출(Claude·Resend·Pusher)에 circuit breaker
- 에러는 Sentry로 집계, P0(권한 위반·암호화 실패·외부 API 다운)는 운영자 즉시 알림

### 7.3 보안
- HTTPS 강제 (HSTS), CSP, X-Frame-Options DENY, NextAuth CSRF
- Rate limiting:
  - 자가진단 사용자당 일 5회 (BR-8)
  - AI 호출 IP당 분 30회
  - 로그인 IP당 분 10회
- 비밀번호: bcrypt 12 라운드, 최소 10자
- 패스워드 리셋 토큰: 30분 만료, 단일 사용
- 컬럼 암호화 (AES-256-GCM, 앱 레이어):
  - `Assessment.transcript`
  - `SessionMessage.content`
  - `ClinicalNote.soapNote`, `ClinicalNote.summaryForEmployee`
  - `User.realName`, `User.phone`
- 각 암호화 컬럼은 **`keyVersion: Int` 컬럼을 V1 스키마부터 함께 둠** — V1은 단일 키·회전 없음, V2에서 키 회전 도입 시 마이그레이션 비용 0
- At-rest 전체 DB 암호화 (Neon/Supabase 기본)
- TLS 1.2+ in transit
- 키 관리: Vercel 환경변수 (V1) → KMS (V2)

### 7.4 프라이버시
- 익명 ID: `User.anonymizedId = BLAKE2b(realId, salt)`
- k-익명성: HR 응답 직전 검증, k<5 셀은 "<5명"으로 마스킹
- 동의 4종 분리 관리: SERVICE / SENSITIVE_DATA / STATISTICS / MARKETING
- 동의 미충족 → 해당 기능 자동 차단 (BR-12)
- 데이터 권리: 열람·정정·삭제·이전 요청 폼 → 운영자 큐 → 14일 내 처리

### 7.5 접근성
- 키보드만으로 모든 핵심 흐름 동작 (V1 검증 범위)
- WCAG 2.1 AA 가이드 참고 (V1은 best-effort, V2에서 정식 인증)

### 7.6 브라우저·디바이스·로케일
- V1: Chrome 최신 (개발 검증)
- 반응형: 직원 화면 모바일 대응 (375px ~), 상담사·HR·운영자는 데스크톱(1024px ~)
- **다국어**: 한국어 only. UI 문자열은 하드코딩(next-intl 등 i18n 라이브러리 미사용). V2 다국어 도입 시 grep으로 한국어 문자열 추출하여 메시지 키로 분리
- **시간대**: DB는 UTC 저장 (Prisma DateTime 기본), UI는 KST 고정 표시 (dayjs로 변환). 사용자 시간대 선택은 V2

### 7.7 로깅·모니터링
- Pino 구조화 로그 (level, traceId, userId, action)
- Sentry 에러 추적 (PII 자동 스크럽 옵션)
- 핵심 메트릭: 인증 실패율 / AI 응답 P95 / 위기 감지 빈도 / 알림 성공률 / Outbox DLQ 크기

### 7.8 백업·복구
- Neon PITR 자동 백업
- 핵심 데모 직전 수동 스냅샷
- 시드 재현 스크립트는 별도 격리 저장

---

## 8. 응급·위기 대응 프로토콜

| 레벨 | 정의 | 트리거 | 대응 |
|---|---|---|---|
| **L1 주의** | 부정 정서 표출, PHQ-9 ≥10 | 점수 또는 키워드 | 상담사 플래그, 직원에게 자기 돌봄 가이드 |
| **L2 경고** | 자해·자살 사고 언급 | 키워드 + 맥락 | 상담사·운영자 즉시 알림 + 직원 화면 1393·1577-0199 핫라인 노출 |
| **L3 위기** | 구체적 계획·수단 언급 | 추가 키워드 + 시간성 | 24h 내 전문의 리뷰 (Escalation), 가족 동의 검토 |
| **L4 응급** | 임박한 자·타해 표현 | 즉각성 표현 | 119 + 응급의료센터 + 보호자 통보 (V1은 화면 안내만, 실제 연계는 수동) |

**검출 메커니즘**
- Claude `assess_risk` 도구를 모든 세션 메시지·자가진단 응답에 호출
- confidence < 0.7 → 인간 큐(`/admin/risk-queue`)로 분류 후 운영자 결정
- 키워드 fallback 룰(자살·자해·죽·끝내·뛰어내리 등) 별도 보강

**책임·기록**
- L3 이상은 전문의 사인오프 필수
- 모든 위기 레벨 변경·확인·디스미스는 AuditLog 영구 보존
- 외부 연계 시 연락 기록·동의 여부 명시

**검증 시나리오 (E2E 회귀)**
- 박재훈 페르소나 시나리오에서 L2 자동 감지 → 30초 내 알림·핫라인 노출

---

## 9. 데이터·프라이버시 요구사항

### 9.1 데이터 생명주기

| 데이터 | 보관 기간 | 만료 처리 | 본인 즉시 파기 요청 |
|---|---|---|---|
| Assessment / Response | 3년 | 익명화 (transcript 삭제, score만 유지) | 하드 삭제 |
| Session / SessionMessage | 5년 (의료법 준수) | 익명화 | 하드 삭제 |
| ClinicalNote | 5년 | 익명화 (PII 마스킹, SOAP 구조 보존 가능) | 하드 삭제 |
| User (탈퇴) | 30일 grace | 익명화 또는 하드 삭제 | 즉시 |
| AuditLog | 5년 | 하드 삭제 | 사유 시 마스킹 |
| HRReport | 영구 | - (개인 식별 없음) | 영구 |

**구현 방식**: 매일 새벽 cron 작업으로 soft-delete 후 30일 경과 항목 → 익명화. 만료 항목은 BLAKE2b 마스킹. 모든 파기 작업은 AuditLog 기록.

### 9.2 동의 관리

| 동의 유형 | 필수/선택 | 미동의 시 영향 |
|---|---|---|
| SERVICE | 필수 | 가입 불가 |
| SENSITIVE_DATA | 필수 | 가입 불가 (자가진단·세션 모두 민감정보) |
| STATISTICS | 선택 | HR 집계 모집단에서 제외 (BR-12) |
| MARKETING | 선택 | 마케팅 메일 발송 안 함 |

- 동의는 버전 관리 (약관 개정 시 재동의 요청)
- 철회는 언제든 가능, 철회 시점부터 미수집

---

## 10. 의존성·제약

### 10.1 외부 서비스

| 서비스 | 용도 | V1 결정 |
|---|---|---|
| Anthropic Claude API | AI 4종 (자가진단·SOAP·위기·HR) | 필수, 일 한도·알람 설정 |
| Neon Postgres | DB | Free tier로 시작, PITR 사용 |
| Vercel | 배포·호스팅 | Free tier, Edge 함수 활용 |
| Resend | 이메일 발송 | **Sandbox 모드**로 시작 (onboarded 주소만 수신 가능), Day 12 가입. 도메인 인증은 V2 |
| Pusher | 세션룸 실시간 채팅 | 확정 (SSE는 단방향, Supabase Realtime은 DB 변경 기반이라 채팅에 과함). Day 15 가입 |
| Sentry | 에러 추적 | Day 7 가입 (Week 1 마지막 날 모니터링·CSP 셋업 시) |

### 10.2 라이브러리

- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Prisma 5 (ORM) + Zod (validation)
- NextAuth.js (인증) + CASL.js (앱 레이어 권한)
- `@anthropic-ai/sdk`
- Pino (로깅) + Sentry SDK
- react-pdf 또는 puppeteer (HR 리포트 PDF)
- recharts 또는 tremor (HR 대시보드 차트)
- Vitest + Playwright (테스트)

### 10.3 제약·전제

- 1인 풀스택 + Claude Code 협업으로 4주 내 구현
- 실제 환자 데이터 없음 (시드는 Faker + Claude 생성 케이스)
- 실제 상담사·전문의 없음 (가상 계정만)
- 결제·청구는 수동 (자동화는 V2)
- **도메인**: Vercel 기본 도메인 사용 (`mindbridge-demo-*.vercel.app`). 별도 도메인 구매·SSL 설정 없음. 프로세스 실험 목적이라 외부 청중 없음.

---

## 11. Deferred Decisions & V2 Backlog

PRD/IA 작성 중 발견된 미결 항목 중, Week 0 Group A 결정(이메일 인증·i18n 하드코딩·KST 고정·Pusher·Server Actions·keyVersion 컬럼·디자인 산출물 미제작)에 해당하지 않는 항목들.

### 11.A Deferred Decisions (작업 시점에 결정)

각 항목은 "→ Day X" 시점에 결정. 그 전까지는 결정 가설을 두지 않음.

#### 인증·가입
- 익명 닉네임 충돌 처리 (중복 시 UUID 접미사 vs 사용자 재입력) → **Day 8** (Onboarding 작성 시)
- InviteCode 1회용 vs 다회용 → **Day 13** (`/hr/invites` 작성 시)

#### 자가진단
- PHQ-9 점수 산출 주체 (Claude 추론 vs 별도 정형 폼) → **Day 9** (`classify_category` tool 설계 시)
- 자가진단 중단·재개 (이어서 vs 새로 시작) → **Day 9**

#### 매칭·예약
- 슬롯 동시성 (Optimistic UI + DB 유니크 제약 vs Distributed lock) → **Day 11** (`createBooking` 작성 시)
- 예약 변경 범위 (직원 시각만 vs 상담사도 변경) → **Day 11**
- 상담사 부재 시 재배정 정책 → **Week 4 운영자 화면 작성 시**

#### 세션
- 세션 자동 종료 (50분 도달 시 자동 vs 수동) → **Day 15** (세션룸 작성 시)
- 세션 메시지 편집·삭제 가능 여부 (임상 기록 무결성 관점) → **Day 15**

#### 위기 대응
- 위기 키워드 사전 위치 (코드 상수 vs 별도 문서) → **Day 19** (`assess_risk` 작성 시)

#### HR 리포트
- 리포트 생성 시점 (매월 1일 자동 cron vs HR 수동 트리거) → **Day 24**
- 추이 차트 기준 기간 (월별 / 분기별 / 1년) → **Day 23** (HR 대시보드 차트 작성 시)
- PDF 디자인 (표준 템플릿 어느 정도까지) → **Day 24**

#### 알림
- 이메일 발송 실패 처리 (in-app 대체 vs 운영자 알림) → **Day 12** (Outbox 워커 작성 시)
- 알림 채널 선호 저장 디테일 (사용자별 채널×이벤트 매트릭스 구조) → **Day 8** (Settings 작성 시)

#### 정산·결제 (V1 수동)
- 운영자 수동 입력 흐름 (Subscription 생성·기업 입금 확인·상담사 정산) → **Week 4 운영자 화면 작성 시**
- 상담사 단가 차등 (등급별 차등 vs 동일) → **Day 5** (시드 v1 작성 시 임시 결정, 정산 화면에서 확정)

#### 기술 스택 디테일
- PDF 생성 라이브러리 (react-pdf vs puppeteer vs @vercel/og) → **Day 24** (Vercel 환경 호환성 검증 후)

#### 시드 데이터
- 케이스 텍스트 생성 방식 (Claude 사전 생성 정적 시드 vs 매 시드 실행 시 호출) → **Day 5**
- 시드 v2 규모 (HR 차트가 그럴듯해 보이는 최소 데이터) → **Day 25**

#### 그 외 (IA에서 이관)
- 상담사 자기 프로필 편집 페이지 (`/counselor/profile`) → **Day 16** (상담사 대시보드 작성 시)
- 세션 시작 정의 (한쪽만 입장한 상태 UI) → **Day 15**
- 세션룸 재진입 시 메시지 히스토리 범위 → **Day 15**
- 알림 채널별 우선순위·중복 제어 → **Day 12**
- 알림 그루핑 (같은 케이스 다중 신호) → **Day 19**
- 상담사·HR의 모바일 최소 동작 → **Week 4 시연 점검 시**
- shadcn 컴포넌트 매핑 → 작업 진행하면서 자연 결정

### 11.B V2 Backlog (V1 범위 제외)

V1에서 의도적으로 다루지 않음. V2 또는 그 이후로 이관.

- **세션 첨부파일** — V1 텍스트 세션만
- **L4 응급 자동 외부 연계** — V1은 화면 안내만. 실제 119/응급의료센터 자동 연계 없음
- **컬럼 암호화 키 회전 메커니즘** — V1은 단일 키, `keyVersion` 컬럼만 미리 마련해둠
- **암호화 키 별도 백업·KMS** — V1은 Vercel 환경변수에 단일 키만
- **임상 노트 검색 페이지** (`/counselor/notes`) — 암호화 컬럼 검색이 복잡하므로 V1 제외. 향후 검색 가능 암호화 또는 별도 인덱스 필요
- **운영자 시스템 헬스 페이지** — V1은 Sentry 대시보드로 대체
- **공지·점검 안내 페이지** — V1은 환경변수 토글로 `/maintenance` 페이지 리다이렉트만
- **상담사 슈퍼비전 워크플로우 자동화** — V1은 운영자 화면에서 슈퍼비전 이력 텍스트 기록만
- **와이어프레임·고화질 디자인 시안** — V1은 shadcn/ui + Tailwind 기본 컴포넌트만 사용

---

## 12. 부록

### 12.1 용어집 (Glossary)

| 약어 | 뜻 |
|---|---|
| EAP | Employee Assistance Program, 직원 지원 프로그램 |
| PHQ-9 | 우울증 자가진단 9문항 |
| GAD-7 | 불안 자가진단 7문항 |
| SOAP | Subjective / Objective / Assessment / Plan — 임상 노트 표준 |
| k-익명성 | 동일 그룹 내 ≥k 개체 보장 익명화 기법 |
| RBAC/ABAC | Role / Attribute-Based Access Control |
| RLS | Postgres Row Level Security |
| Outbox | 메시지 손실 방지 패턴 (트랜잭션과 함께 큐 insert) |
| DLQ | Dead Letter Queue |
| PITR | Point-in-time Recovery |

### 12.2 관련 문서
- `../golden-hugging-hamster.md` — 기획안 (원본)
- `./ia.md` — 정보 아키텍처
- `../mindbridge-dev-plan.md` — 4주 개발 일정
