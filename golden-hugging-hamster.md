# MindBridge — 정신건강 EAP 멀티롤 플랫폼 MVP 기획안

> 도메인은 한국 기업 대상 B2B EAP (Employee Assistance Program). 5개 롤(직원·상담사·전문의·HR·운영자)이 한 흐름에서 자연스럽게 등장하는 멀티롤 협진 + AI 임상 자동화를 가정한 가상 제품.

---

## 1. 롤·페르소나·상담사 자격

### 1.1 5개 롤 정의

| 롤 | 책임 | 핵심 화면 |
|---|---|---|
| **직원 (Employee)** | 자가진단·예약·세션·피드백 | 챗봇 → 상담사 추천 → 예약 → 세션룸 |
| **임상심리사 (Counselor)** | 1차 상담·노트·후속 권고 | 일정·케이스·세션룸·노트 |
| **정신과 전문의 (Psychiatrist)** | 약물 컨설팅·위기 에스컬레이션 | 에스컬레이션 큐 |
| **HR 담당자 (HR)** | 익명 집계·임원 보고 | k-익명성 대시보드 |
| **운영자 (Admin)** | 상담사 풀·정산·위험 알림·품질 | 풀 관리·정산·알림 큐 |

### 1.2 권한 매트릭스

| 데이터 | 직원 | 상담사 | 전문의 | HR | 운영자 |
|---|---|---|---|---|---|
| 본인 자가진단 | R/W | - | - | - | - |
| 본인 세션 | R | R/W (담당) | R/W (에스컬) | ❌ | R (감사) |
| 임상 노트 | R (요약) | R/W (담당) | R (에스컬) | ❌ | ❌ |
| HR 익명 집계 | - | - | - | R (k≥5) | R/W |
| 정산 | - | R (본인) | R (본인) | ❌ | R/W |
| 위기 알림 | - | R (담당) | R (에스컬) | ❌ | R/W |

### 1.3 페르소나

| 롤 | 페르소나 | 핵심 상황 |
|---|---|---|
| 직원 | 김민지 32세 마케팅팀 | PHQ-9 14점, 번아웃, 익명성 최우선 |
| 직원 | 박재훈 45세 개발팀장 | 수면장애·불안, 사내 상담 꺼림 |
| 상담사 | 이수현 임상심리사 1급 10년차 | 직장인 우울·번아웃, 평점 4.8 |
| 전문의 | 김태영 정신건강의학과 전문의 | 외부 협력, 주 2회 에스컬 컨설팅 |
| HR | 정유나 인사기획팀 차장 | 임원 보고 리포트 관심, 개인정보 차단 |
| 운영자 | 장하늘 플랫폼 운영팀 | 위기 알림 대응·정산 책임 |

### 1.4 상담사 자격·온보딩·품질관리

- **자격**: 임상심리사 1급 / 상담심리사 1급 / 정신건강간호사 + 임상 경력 3년+
- **온보딩**: 서류 → 인터뷰 → 모의 케이스 → 슈퍼바이저 매칭 → 첫 5건 슈퍼비전
- **등급**: JUNIOR (3~5년) / SENIOR (5~10년) / SUPERVISOR (10년+, 교육자격)
- **품질**: 월 1회 슈퍼비전 의무 / 분기 평점 리뷰 (4.0↓ 액션 플랜) / 위기 케이스 디브리핑

---

## 2. 워크플로우 & User Stories

### 2.1 6개 핵심 유즈케이스

| ID | 이름 | 요약 |
|---|---|---|
| UC-1 | 자가진단 → 매칭 → 예약 | Claude 챗봇 4~6턴 → 카테고리·심각도 분류 → 상위 3명 추천 → 예약 |
| UC-2 | 세션 → SOAP 자동화 | 세션룸 → 메모 → Claude SOAP 변환 → 요약·Action Item 직원 노출 |
| UC-3 | 위기 신호 → 응급 대응 (§9) | risk score → L1~L4 → 외부 연계 → 전문의 사인오프 |
| UC-4 | HR 익명 집계 리포트 | 월말 자동 → k≥5 → Claude 인사이트 → PDF |
| UC-5 | 세션 후 피드백 루프 | 24h 평가 → 매칭 가중치 반영 → 평점 3.0↓ 알림 |
| UC-6 | 기업 도입 → Seat 관리 | 계약 → Subscription → InviteCode → 직원 가입 → 월청구 |

### 2.2 롤별 User Stories (P0)

**직원**
- **US-E1** 자가진단으로 내 상태를 이해한다 / **AC**: 4~6턴 후 카테고리·심각도·요약 카드 + Action Item 3개
- **US-E2** 나에게 맞는 상담사를 찾는다 / **AC**: 상위 3명 카드 (전문분야·평점·가능시간·추천 이유)
- **US-E3** 익명으로 상담받는다 / **AC**: HR·운영자 화면에 실명 0건, 익명 ID만
- **US-E4** 위기 상황에서 즉시 도움 / **AC**: 위기 감지 시 5초 내 1393·119 핫라인 표시
- **US-E5** 세션 후 피드백·재상담사 변경 / **AC**: 5점 척도 + 재상담 의사 + 변경 요청 동작

**상담사**
- **US-C1** 오늘 일정·케이스 일목요연 / **AC**: 대시보드 시간순 카드, 진단 요약·이전 노트 1클릭
- **US-C2** 메모 → SOAP 자동 변환 / **AC**: 메모 입력 → 1클릭 SOAP + 수정 가능
- **US-C3** 위험 신호 자동 감지 / **AC**: AI 플래그 + 운영자·전문의 자동 알림

**전문의**
- **US-P1** 에스컬 큐 우선순위 처리 / **AC**: SLA 카운트다운 + 사인오프 버튼 + 가족 동의 체크

**HR**
- **US-H1** 임원 보고용 월간 리포트 / **AC**: PDF + 1페이지 Claude 인사이트 + 추이 차트
- **US-H2** 개인 식별 불가 / **AC**: 모든 화면 실명 0건, k<5 셀 "<5명" 마스킹

**운영자**
- **US-A1** 위기 알림 즉각 대응 / **AC**: 위기 큐 상단 고정 + SLA 모니터 + 디스미스 로그

### 2.3 비즈니스 룰

| ID | 룰 |
|---|---|
| BR-1 | 세션 표준 길이 50분 |
| BR-2 | 노쇼 = 예약 시각 +15분 경과 후 무입장 |
| BR-3 | 취소 정책: 24h 전 무료 / 24h~2h 30% / 2h 내 100% |
| BR-4 | 매칭 가중치: 카테고리 일치 40 + 평점 20 + 가용시간 20 + 다양성(주니어 노출) 10 + 신규 매칭 보정 10 |
| BR-5 | k-익명성 임계값 k=5 |
| BR-6 | 위기 L3 SLA: 24h 내 전문의 사인오프, 미준수 시 재배정 + 운영자 즉시 알림 |
| BR-7 | HR 리포트 발행 조건: 회사 직원 수 ≥20명 또는 동의자 ≥10명 |
| BR-8 | 자가진단 빈도 제한: 사용자당 일 5회 (Rate Limit) |
| BR-9 | 세션 빈도: 직원당 월 4회 기본 (플랜별 변동) |
| BR-10 | 매칭 시 직원 부서 정보는 상담사에게 노출 안 함 (사내 갈등 회피) |
| BR-11 | 상담사-내담자 동일 회사 라이센스 보유자는 회피 매칭 |
| BR-12 | 동의 미충족 기능 차단: STATISTICS 미동의 시 HR 집계 모집단 제외 |

### 2.4 상태 머신

**Booking**
```
REQUESTED → CONFIRMED (수락) | CANCELED_BY_USER
CONFIRMED → IN_SESSION (시각 도래) | CANCELED_BY_USER | CANCELED_BY_COUNSELOR | NO_SHOW (+15min)
IN_SESSION → COMPLETED
```

**Session**
```
SCHEDULED → IN_PROGRESS (양측 입장) → COMPLETED
SCHEDULED → CANCELED | NO_SHOW
```

**RiskFlag**
```
OPEN → IN_REVIEW → RESOLVED
IN_REVIEW → EXTERNAL_REFERRED
```

**Escalation**
```
PENDING → IN_REVIEW → DECIDED
PENDING → EXPIRED (24h, 재배정 + 알림)
```

**Subscription**
```
TRIAL → ACTIVE (결제 확인)
ACTIVE ↔ SUSPENDED (미납/납입)
ACTIVE → EXPIRED | CANCELED
```

---

## 3. 정보 아키텍처 (IA)

### 3.1 Sitemap (롤별)

```
공통 (비로그인 또는 전 롤)
  /                       랜딩
  /signin                 로그인
  /signup?code=xxx        가입 (초대코드)
  /forgot-password
  /reset-password?token=
  /terms                  이용약관
  /privacy                개인정보처리방침
  /policy/refund          환불정책
  /faq
  /contact
  /403 /404 /500 /maintenance

직원 (/app)
  /app                    홈 (다음 예약·진단 권유·알림 요약)
  /app/onboarding         초기 안내(스킵 가능)
  /app/assessment         자가진단 챗봇
  /app/assessment/result  결과 카드
  /app/counselors         추천 상담사 목록
  /app/counselors/:id     상담사 상세·예약 슬롯
  /app/bookings           내 예약 목록
  /app/bookings/:id       예약 상세 (취소·변경)
  /app/session/:id        실시간 세션룸
  /app/feedback/:sessionId 피드백 작성
  /app/notifications      알림 센터
  /app/emergency          위기 핫라인 (항상 접근 가능)
  /app/settings
    /app/settings/account
    /app/settings/consents
    /app/settings/notifications
    /app/settings/data-rights (열람·정정·삭제·이전)
    /app/settings/danger      (탈퇴)

상담사 (/counselor)
  /counselor                홈
  /counselor/calendar       일정
  /counselor/cases          담당 케이스 리스트 + 필터
  /counselor/cases/:id      케이스 상세 (진단·이전 노트)
  /counselor/session/:id    세션룸
  /counselor/notes          노트 검색
  /counselor/availability   가용시간 설정
  /counselor/settings

전문의 (/psychiatrist)
  /psychiatrist             홈
  /psychiatrist/queue       에스컬레이션 큐
  /psychiatrist/cases/:id   케이스 리뷰·사인오프
  /psychiatrist/settings

HR (/hr)
  /hr                       홈
  /hr/dashboard             실시간 집계 (k≥5)
  /hr/reports               월간 리포트 리스트
  /hr/reports/:id           리포트 상세·PDF
  /hr/invites               초대코드 발급·관리
  /hr/settings

운영자 (/admin)
  /admin                    홈
  /admin/companies          기업·구독
  /admin/counselors         상담사 풀·승인·등급
  /admin/risk-queue         위기 큐 (우선순위)
  /admin/escalations        에스컬 SLA 모니터
  /admin/payments           정산
  /admin/audit-logs         감사 로그 검색
  /admin/notifications      알림 발송 모니터(Outbox)
  /admin/settings
```

### 3.2 URL 컨벤션
- 롤별 prefix: `/app` `/counselor` `/psychiatrist` `/hr` `/admin`
- 자원 plural, 세부 `/:id`, 액션 `/:id/edit`·`/:id/cancel`
- 미들웨어가 prefix 기준 1차 롤 검증

### 3.3 Navigation 패턴

| 영역 | 데스크톱 | 모바일 |
|---|---|---|
| Primary nav | 좌측 사이드바 (롤별 메뉴) | 하단 탭 (직원만) / 상단 햄버거 |
| Secondary | 페이지 내 탭 | 상단 탭 |
| 알림 배지 | 사이드바 아이콘 | 탭 아이콘 |
| 위기 배너 | 상단 고정 (위기 발생 시) | 동일 |
| 비상 연락처 | Footer 상시 노출 (직원) | 동일 |

### 3.4 화면 상태 표준 (전 페이지 공통)

| 상태 | UX |
|---|---|
| Loading | shadcn Skeleton (테이블·카드별) |
| Empty | EmptyState 컴포넌트 + 가이드 CTA |
| Error | Alert + 재시도 + Sentry trace id |
| Permission Denied | 403 페이지 또는 인라인 Alert + AuditLog 기록 |
| Maintenance | /maintenance 페이지 자동 리다이렉트 |
| Offline | Toast + 큐잉 (PWA V2) |

### 3.5 Onboarding 흐름 (직원, 7화면)
1. `/signup?code=xxx` 초대코드 검증
2. 이메일·비밀번호 (강도 표시)
3. 이메일 인증 메일 발송 안내
4. 본인 인증 완료 후 진입
5. 동의 3단계 (서비스 / 민감정보 / 통계·마케팅) — 각 단계 약관 표시·버전 기록
6. 익명 닉네임 설정 (실명 입력 없음)
7. 초기 자가진단 권유 (스킵 시 홈으로)

### 3.6 마이페이지·Settings

**직원 Settings**
- 계정 정보 (이메일·닉네임·비밀번호)
- 동의 관리 (현재 상태·철회·약관 버전)
- 알림 설정 (채널×이벤트 매트릭스 토글)
- 데이터 권리 (열람·정정·삭제·이전 요청 폼)
- 위기 비상 연락처 (옵션, 보호자 동의 가정)
- 회원 탈퇴 (30일 grace, 즉시 비식별 옵션)

다른 롤 Settings는 위에서 알림·계정 위주 단순화.

### 3.7 알림 센터 IA + 이메일 템플릿

**알림 센터 (직원)**
- 탭: 전체 / 예약 / 위기 / 시스템
- 상태: 안 읽음·읽음·보관
- 일괄 액션: 모두 읽음, 보관

**이메일 템플릿 (예: 예약 확정)**
```
제목: [MindBridge] 상담 예약이 확정되었습니다 (이수현 상담사, 화 14:00)

[닉네임]님 안녕하세요.
다음 일정으로 상담 예약이 확정되었습니다.
- 상담사: 이수현 (임상심리사 1급)
- 일시: 2026년 5월 26일 (화) 14:00 KST
- 방식: 텍스트 세션룸
- 예상 시간: 50분

세션 24시간 전·1시간 전 리마인더 메일이 발송됩니다.
일정 변경/취소: [버튼]

상담 중 위급 시 1577-0199, 자살예방 1393, 응급 119
```

### 3.8 에러 페이지

| 페이지 | 카피 | 액션 |
|---|---|---|
| 404 | "찾으시는 페이지가 없어요" | 홈 / 검색 |
| 403 | "접근 권한이 없습니다" | 로그아웃 / 문의 |
| 500 | "일시적 오류가 발생했어요" | 재시도 / Sentry id 복사 / 문의 |
| 503 | "점검 중입니다" | 예상 복구 시간 |

### 3.9 Legal·정적 페이지
- 이용약관 / 개인정보처리방침 (민감정보 별도) / 운영정책 / 환불정책 / FAQ / 회사소개 / 문의 / 위기 핫라인 안내

### 3.10 검색·필터

| 페이지 | 필터 | 정렬 |
|---|---|---|
| 직원 `/app/counselors` | 카테고리(태그)·등급·평점·가능시간·언어 | 추천도·평점·가까운 시간 |
| 상담사 `/counselor/cases` | 상태(진행/완료)·기간·위험도 | 최신순 |
| 운영자 `/admin/risk-queue` | 위험도 L1~L4·상태·회사·기간 | SLA 잔여 시간 |
| 운영자 `/admin/audit-logs` | actor·resourceType·action·기간 | 최신순 |

### 3.11 시각 가이드 (최소)

| 위험도 | 색상 |
|---|---|
| L1 주의 | yellow-500 |
| L2 경고 | orange-500 |
| L3 위기 | red-500 |
| L4 응급 | red-700 + 점멸 |

폰트: Pretendard / 사이즈 14·16·20·24·32. 톤앤매너: 차분한 블루-그린 계열 (psychology-safe).

---

## 5. 기술 아키텍처

### 5.1 스택

| 계층 | 기술 | 비고 |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TS + Tailwind + shadcn/ui | Claude 친화 |
| Backend | Next.js Server Actions + tRPC (선택) | 단일 코드베이스 |
| DB | PostgreSQL 16 (Neon/Supabase) + Prisma ORM | |
| Auth | NextAuth.js + 미들웨어 RBAC | 5롤 분기 |
| Authz | CASL.js (앱 레이어) | V2: Postgres RLS 추가 |
| AI | Claude API (sonnet-4-6 기본, opus-4-7 옵션) + 프롬프트 캐싱 | 핵심 |
| Realtime | Pusher 또는 Supabase Realtime | 세션 채팅 |
| Notification | Resend (이메일) + in-app + (V2) FCM | Outbox 패턴 |
| Payment | 수동 (V1) → 토스페이먼츠/Stripe (V2) | |
| Storage | Supabase Storage / Vercel Blob | PDF·증빙 |
| Logging | Pino + Sentry | |
| Testing | Vitest (unit) + Playwright (E2E) | |
| Deploy | Vercel + Neon | 시연 무료 티어 |

### 5.2 채널 전략

| 단계 | 직원 | 상담사·전문의 | HR·운영자 |
|---|---|---|---|
| V1 시연 | 반응형 웹 | 반응형 웹 | 웹 데스크톱 |
| V2 출시 | PWA → 네이티브 | 웹 + 모바일 알림 | 웹 데스크톱 |

### 5.3 Non-Functional Requirements

| 항목 | V1 시연 | V2 본 서비스 |
|---|---|---|
| 페이지 초기 로드 | < 3s (P95) | < 2s |
| AI 트리아지 응답 | < 5s | < 3s |
| 동시 접속자 | 10명 | 회사당 100명 |
| 가용성 | 시연 30분 무중단 | 99.5% |
| 접근성 | 키보드 기본 동작 | WCAG 2.1 AA |
| 브라우저 | Chrome 최신 (시연) | Chrome/Safari/Edge 최근 2버전 |
| 다국어 | 한국어 | 한국어 + 영어 |
| 모바일 반응형 | 직원 화면 | 전 화면 |
| 보안 등급 | 데모 격리 | ISMS-P 준비 |

### 5.4 시스템 아키텍처 (논리 다이어그램)

```
            ┌─────────────┐
            │   Browser   │  5 role UIs, 반응형
            └──────┬──────┘
                   │ HTTPS
            ┌──────▼──────┐
            │  Next.js    │  App Router + Server Actions
            │  (Vercel)   │  + Middleware (Auth/RBAC) + CASL
            └──┬───┬───┬──┘
       ┌──────┘   │   └──────┐
       ▼          ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌──────────────┐
  │ Claude  │ │Postgres │ │Resend/Pusher │
  │  API    │ │ (Neon)  │ │  + Outbox    │
  └─────────┘ └─────────┘ └──────────────┘
                   │
                   ▼
              ┌─────────┐
              │ Sentry  │
              └─────────┘
```

---

### 5.5 데이터 모델 (Full Spec)

#### 5.5.1 엔티티 목록

**V1 시연 필수 (24개)**

| # | 엔티티 | 목적 |
|---|---|---|
| 1 | User | 5롤 공통 |
| 2 | Company | 고객사 |
| 3 | Department | 부서 (HR 집계) |
| 4 | Subscription | 구독 계약 |
| 5 | InviteCode | 직원 초대 |
| 6 | Consent | 동의 (버전 관리) |
| 7 | Counselor | 상담사 프로필 |
| 8 | CounselorCredential | 자격증 검증 |
| 9 | CounselorAvailability | 가능 시간대 |
| 10 | Category | 분류 마스터(우울/불안/번아웃/관계/...) |
| 11 | Assessment | 자가진단 결과 |
| 12 | AssessmentResponse | 응답 (재현·감사) |
| 13 | MatchRecommendation | 매칭 추천 기록 |
| 14 | Booking | 예약 |
| 15 | Session | 세션 |
| 16 | SessionMessage | 세션 채팅 |
| 17 | ClinicalNote | 임상 노트(SOAP) |
| 18 | Feedback | 세션 피드백 |
| 19 | RiskFlag | 위험 감지 |
| 20 | Escalation | 전문의 에스컬 |
| 21 | HRReport | HR 익명 집계 |
| 22 | Notification | 알림 수신함 |
| 23 | NotificationOutbox | 발송 큐 |
| 24 | AuditLog | 감사 로그 |

**V2+ (시연 생략)**: Payment / Invoice / RefundRequest / Supervision / InsurancePartner / InsuranceClaim / ApiKey / Webhook / FeatureFlag

#### 5.5.2 Enum 정의

```
UserRole        = EMPLOYEE | COUNSELOR | PSYCHIATRIST | HR | ADMIN
UserStatus      = PENDING | ACTIVE | SUSPENDED | DELETED
CompanyStatus   = TRIAL | ACTIVE | SUSPENDED | EXPIRED
PlanType        = STARTER | STANDARD | ENTERPRISE
SubStatus       = TRIAL | ACTIVE | SUSPENDED | EXPIRED | CANCELED
ConsentType     = SERVICE | SENSITIVE_DATA | STATISTICS | MARKETING
CounselorTier   = JUNIOR | SENIOR | SUPERVISOR
LicenseType     = CLINICAL_PSYCHOLOGIST_1 | COUNSELING_PSYCHOLOGIST_1 | MENTAL_HEALTH_NURSE
VerifyStatus    = PENDING | VERIFIED | REJECTED
Severity        = NONE | MILD | MODERATE | MODERATELY_SEVERE | SEVERE
BookingStatus   = REQUESTED | CONFIRMED | IN_SESSION | CANCELED_BY_USER
                | CANCELED_BY_COUNSELOR | NO_SHOW | COMPLETED
SessionStatus   = SCHEDULED | IN_PROGRESS | COMPLETED | NO_SHOW | CANCELED
RiskLevel       = L1_NOTICE | L2_ALERT | L3_ESCALATION | L4_EMERGENCY
RiskStatus      = OPEN | IN_REVIEW | RESOLVED | EXTERNAL_REFERRED
EscalationStatus= PENDING | IN_REVIEW | DECIDED | EXPIRED
NotifChannel    = EMAIL | IN_APP | PUSH | SMS
NotifType       = BOOKING_CONFIRMED | BOOKING_REMINDER | SESSION_COMPLETED
                | FEEDBACK_REQUEST | RISK_L2 | RISK_L3 | RISK_L4
                | HR_REPORT_READY | RENEWAL_REMINDER
OutboxStatus    = PENDING | SENT | FAILED | DLQ
```

#### 5.5.3 핵심 관계 (ERD 요약)

```
Company 1─N Department, Subscription, InviteCode, User, HRReport
User 1─N Consent, Notification, AuditLog(actor)

Employee 1─N Assessment
Assessment 1─N AssessmentResponse, MatchRecommendation

Employee 1─N Booking N─1 Counselor
Booking 1─1 Session
Session 1─N SessionMessage
Session 1─1 ClinicalNote, Feedback

Counselor 1─N CounselorCredential, CounselorAvailability
Counselor N─M Category (specialty)

RiskFlag 1─0..1 Escalation N─1 Psychiatrist
RiskFlag → polymorphic source: Assessment | SessionMessage | ClinicalNote
```

#### 5.5.4 인덱스 전략

| 테이블 | 인덱스 |
|---|---|
| User | (email) UNIQUE, (companyId, role), (anonymizedId) UNIQUE |
| Booking | (employeeId, scheduledAt), (counselorId, scheduledAt), (status, scheduledAt) |
| Session | (bookingId) UNIQUE, (status, completedAt) |
| ClinicalNote | (counselorId, createdAt), (sessionId) UNIQUE |
| RiskFlag | (level, status), (companyId, createdAt) |
| Escalation | (status, slaDeadline) |
| AuditLog | (actorId, timestamp), (resourceType, resourceId, timestamp) |
| Notification | (userId, readAt), (type, sentAt) |
| NotificationOutbox | (status, scheduledFor) |
| HRReport | (companyId, period) UNIQUE |
| MatchRecommendation | (assessmentId, score DESC) |

#### 5.5.5 암호화·익명화

- **Column-level 암호화 (앱 레이어, AES-256-GCM)**: `Assessment.transcript`, `SessionMessage.content`, `ClinicalNote.soapNote`, `ClinicalNote.summaryForEmployee`, `User.realName`, `User.phone`
- **At-rest**: DB 전체 (Neon/Supabase 기본)
- **Transit**: TLS 1.2+
- **키 관리**: Vercel 환경변수 (V1) → AWS/GCP KMS (V2)
- **익명화**: `User.anonymizedId = BLAKE2b(realId, salt)`, HR 응답 직전 k≥5 검증

#### 5.5.6 Prisma 스키마 (핵심 5개 엔티티)

```prisma
model User {
  id            String     @id @default(uuid())
  email         String     @unique
  passwordHash  String?
  role          UserRole
  status        UserStatus @default(PENDING)
  companyId     String?
  realName      String?    // encrypted at app layer
  phone         String?    // encrypted at app layer
  anonymizedId  String     @unique
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  deletedAt     DateTime?

  company       Company?   @relation(fields: [companyId], references: [id])
  consents      Consent[]
  notifications Notification[]
  auditLogs     AuditLog[] @relation("ActorLogs")

  @@index([companyId, role])
}

model Booking {
  id           String        @id @default(uuid())
  employeeId   String
  counselorId  String
  scheduledAt  DateTime
  status       BookingStatus @default(REQUESTED)
  cancelReason String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  employee     User          @relation("EmployeeBookings", fields: [employeeId], references: [id])
  counselor    User          @relation("CounselorBookings", fields: [counselorId], references: [id])
  session      Session?

  @@index([employeeId, scheduledAt])
  @@index([counselorId, scheduledAt])
  @@index([status, scheduledAt])
}

model ClinicalNote {
  id                 String   @id @default(uuid())
  sessionId          String   @unique
  counselorId        String
  soapNote           String   // encrypted
  summaryForEmployee String   // encrypted
  flags              String[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  session            Session  @relation(fields: [sessionId], references: [id])
  counselor          User     @relation(fields: [counselorId], references: [id])

  @@index([counselorId, createdAt])
}

model RiskFlag {
  id          String     @id @default(uuid())
  sourceType  String     // 'Assessment' | 'SessionMessage' | 'ClinicalNote'
  sourceId    String
  companyId   String
  level       RiskLevel
  status      RiskStatus @default(OPEN)
  confidence  Float
  keywords    String[]
  detectedBy  String     // 'claude:tool-assess_risk:v1'
  resolverId  String?
  resolvedAt  DateTime?
  createdAt   DateTime   @default(now())

  escalation  Escalation?

  @@index([level, status])
  @@index([companyId, createdAt])
}

model AuditLog {
  id           String   @id @default(uuid())
  actorId      String?
  action       String
  resourceType String
  resourceId   String
  metadata     Json?
  ipAddress    String?
  userAgent    String?
  timestamp    DateTime @default(now())

  actor        User?    @relation("ActorLogs", fields: [actorId], references: [id])

  @@index([actorId, timestamp])
  @@index([resourceType, resourceId, timestamp])
}
```

나머지 엔티티는 동일 패턴: UUID id, createdAt/updatedAt, 필요 시 deletedAt, FK 인덱스.

#### 5.5.7 데이터 생명주기·파기

| 데이터 | 보관 | 만료 처리 | 본인 즉시 파기 |
|---|---|---|---|
| Assessment / Response | 3년 | 익명화 (transcript 삭제, score만) | 하드 삭제 |
| Session / SessionMessage | 5년 (의료법) | 익명화 | 하드 삭제 |
| ClinicalNote | 5년 | 익명화 (PII 마스킹, SOAP 보존 가능) | 하드 삭제 |
| User (퇴사) | 30일 grace | 익명화 or 하드 삭제 | 즉시 |
| AuditLog | 5년 | 하드 삭제 | 사유 시 마스킹 |
| HRReport | 영구 | - | 개인 식별 없음, 영구 |

**구현**: 매일 새벽 cron, soft delete 후 30일 → 익명화 / 만료 → BLAKE2b, 모든 파기 AuditLog 기록.

#### 5.5.8 엔티티 우선순위 (Week별 P0)

| Week | 엔티티 |
|---|---|
| W1 | User, Company, Department, Consent, Counselor, CounselorCredential, CounselorAvailability, Category, AuditLog, InviteCode, Subscription(수동) |
| W2 | Assessment, AssessmentResponse, MatchRecommendation, Booking |
| W3 | Session, SessionMessage, ClinicalNote, Feedback, RiskFlag, Escalation |
| W4 | HRReport, Notification, NotificationOutbox |

---

### 5.6 권한 시스템 (3중 방어)

1. **미들웨어**: 인증 토큰 + 롤별 라우트 차단 (예: `/hr/*`는 HR·ADMIN)
2. **앱 레이어 (CASL.js)**: 자원 단위 ABAC. `can('read', 'ClinicalNote', note)`, 상담사는 `note.counselorId === userId` 케이스만
3. **DB 레이어 (V2)**: Postgres RLS 정책

**감사 의무화**: 민감 자원 접근(임상 노트·자가진단·위기 알림)은 Server Action 데코레이터로 AuditLog 자동 기록. 권한 위반 시도도 `PERMISSION_DENIED`로 기록.

---

### 5.7 Server Action API 시그니처 (핵심)

```ts
// 직원
signUpWithInvite(code, email, password): User
submitConsent(type, version): Consent
revokeConsent(type): Consent
startAssessment(): { assessmentId, sessionToken }
sendAssessmentMessage(assessmentId, text): { reply, riskFlag?, completed?, summary? }
listRecommendedCounselors(assessmentId): Counselor[3]
listCounselorSlots(counselorId, range): Slot[]
createBooking(counselorId, slotAt): Booking
cancelBooking(bookingId, reason): Booking
joinSession(sessionId): { token, transport }
sendSessionMessage(sessionId, text): SessionMessage
submitFeedback(sessionId, rating, comment, wantSameCounselor): Feedback
requestDataExport(): DataExportJob
requestAccountDeletion(): DeletionJob

// 상담사
listMyCases(filter): Case[]
getCase(caseId): CaseDetail
addClinicalMemo(sessionId, raw): { soapDraft }
saveClinicalNote(sessionId, soap, summary, flags): ClinicalNote
setAvailability(blocks): CounselorAvailability[]

// 전문의
listEscalations(filter): Escalation[]
reviewEscalation(escalationId, decision, note): Escalation
signOffEscalation(escalationId): Escalation

// HR
getDashboard(period): DashboardData (k≥5)
listReports(): HRReport[]
generateMonthlyReport(period): HRReport
issueInvites(emails[]): InviteCode[]
revokeInvite(codeId): void

// 운영자
listRiskQueue(filter): RiskFlag[]
acknowledgeRisk(riskId): RiskFlag
listCounselors(filter): Counselor[]
approveCounselor(counselorId, tier): Counselor
suspendCounselor(counselorId, reason): Counselor
runMonthlyPayout(period): PayoutSummary
searchAuditLogs(filter): AuditLog[]
```

---

### 5.8 Claude 통합

**모델**
- 자가진단·SOAP·HR 인사이트: `claude-sonnet-4-6`
- 위기 감지: `claude-opus-4-7` (정확도 우선) 또는 sonnet + 보수적 임계값

**프롬프트 캐싱**: 시스템 프롬프트(임상 가이드라인·SOAP 템플릿)에 `cache_control`. 자가진단 다턴에 캐시 적중 → 비용·지연 감소.

**Tool I/O 스키마**
```
assess_risk
  input:  { text: string, context?: { assessmentId?, sessionId? } }
  output: { level: 'L1'|'L2'|'L3'|'L4'|'NONE',
            confidence: number (0~1),
            keywords: string[],
            recommendedAction: string }

classify_category
  input:  { assessmentTranscript: string }
  output: { primaryCategory: string,
            secondaryCategories: string[],
            severity: Severity,
            summaryForCounselor: string,
            summaryForEmployee: string }

generate_soap
  input:  { memo: string,
            sessionContext: { category, severity, previousNote? } }
  output: { soapNote: { S, O, A, P },
            summaryForEmployee: string,
            actionItems: string[],
            flags: string[] }

generate_hr_insight
  input:  { aggregateMetrics: object, previousPeriod?: object }
  output: { insightParagraph: string,
            keyTakeaways: string[3],
            recommendedActions: string[] }
```

**비용 추산 (시연 한 달)**
- 자가진단 1회 ~$0.02 / SOAP 1회 ~$0.015 / HR 리포트 1회 ~$0.04
- 가상 케이스 100건 시연 데이터 전체 ≈ $5~10

**Fallback**
- Claude API 다운 시: 자가진단 정적 PHQ-9 폼 대체 / 위기 감지 키워드 룰 / 노트는 raw 저장
- Circuit breaker: 1분 내 3회 실패 → 5분 차단

---

### 5.9 알림 (Outbox 패턴)

| 이벤트 | 채널 | 수신자 | 시점 |
|---|---|---|---|
| 예약 확정 | Email + in-app | 직원, 상담사 | 즉시 |
| 리마인더 | Email | 직원 | 24h / 1h 전 |
| 세션 완료 | in-app | 직원 | 종료 후 |
| 피드백 요청 | Email + in-app | 직원 | 24h 후 |
| 위기 L2 | Email + in-app | 상담사, 운영자 | 즉시 |
| 위기 L3 | Email + SMS | 전문의 | 즉시 |
| 위기 L4 | SMS + 전화 콜 안내 | 보호자·119 | 즉시 |
| 월간 리포트 | Email | HR | 매월 1일 |
| 갱신 알림 | Email | HR, 운영자 | 만료 30일 전 |

**안정성**: 비즈니스 트랜잭션과 같은 트랜잭션에 `NotificationOutbox` insert → 워커 폴링 → 외부 채널 호출 → 실패 시 지수 백오프, 5회 실패 시 DLQ.

---

### 5.10 보안·로깅·테스트·운영

**보안**
- HTTPS 강제 (HSTS), CSP, X-Frame-Options, CSRF (NextAuth)
- Rate limiting: 자가진단 사용자당 일 5회, AI 호출 IP당 분 30회, 로그인 IP당 분 10회
- 비밀번호: bcrypt 12 라운드, 최소 10자, 토큰 30분 만료

**로깅·모니터링**
- Pino 구조화 로그, Sentry 에러 추적
- 메트릭: 인증 실패율, AI 응답 시간, 위기 감지 빈도, 알림 성공률
- Sentry P0 → 운영자 SMS

**테스트**
- Unit: 권한 체크, 매칭 알고리즘, 위기 룰 fallback (Vitest)
- Integration: 5개 핵심 Server Action 흐름
- E2E (Playwright): 5분 시연 시나리오 자동화 → 시연 직전 회귀

**백업·복구**
- Neon PITR 자동 백업
- 시연 D-1 수동 스냅샷 + 시드 재현 스크립트 격리 보관
- 시연 환경: `mindbridge-demo.example.com` + 별도 DB

---

## 6. 4주 MVP 계획

### Week 1 — Foundation
- 프로젝트 셋업, Prisma 스키마 W1 P0 엔티티, NextAuth + CASL 골격
- 5롤별 빈 대시보드
- 시드 v1: 가상 기업 1, 직원 50, 상담사 10, 전문의 3
- Sentry, Pino 셋업
- **DoD**: 5롤 로그인 → 다른 화면, 권한 위반 차단·AuditLog 1건 시연

### Week 2 — 직원 여정
- W2 엔티티, `classify_category` tool, 자가진단 챗봇 (프롬프트 캐싱)
- 매칭 알고리즘 (BR-4 가중치)
- 예약 UI + Resend 이메일 (Outbox)
- Subscription·InviteCode 수동 입력
- **DoD**: 진단 → 매칭 → 예약 → 이메일 수신 동작

### Week 3 — 상담·위기·피드백
- W3 엔티티, Pusher 세션룸 채팅
- `generate_soap` tool, SOAP 자동 변환
- `assess_risk` tool, L1~L3 흐름 + 핫라인
- UC-5 피드백
- 임상 노트 컬럼 암호화 적용
- **DoD**: 위기 시나리오 30초 내 양측 알림 + 전문의 큐 등록

### Week 4 — HR 대시보드 + 데모 polish
- W4 엔티티, 익명 집계 + k≥5 검증 + Claude 인사이트
- 감사 로그 화면 (권한·안전성 검증용)
- 시드 v2 (1개월 가상 운영 데이터)
- E2E 데모 시나리오 자동화, 데모 워크스루 스크립트
- **DoD**: 데모 리허설 1회 완료, E2E 그린

---

## 8. 응급·위기 대응 프로토콜

| 레벨 | 정의 | 트리거 | 대응 |
|---|---|---|---|
| **L1 주의** | 부정 정서, PHQ-9 ≥10 | 점수/키워드 | 상담사 플래그 |
| **L2 경고** | 자해·자살 사고 언급 | 키워드+맥락 | 상담사·운영자 즉시 + 직원 화면 1393·1577-0199 |
| **L3 위기** | 구체적 계획·수단 | 추가 키워드+시간성 | 24h 전문의 리뷰, 가족 동의 검토 |
| **L4 응급** | 임박한 자·타해 | 즉각성 표현 | 119 + 응급의료센터 + 보호자 통보 |

**검출**: Claude `assess_risk`, 모든 메시지·자가진단 호출, confidence<0.7은 인간 큐
**책임**: L3 이상 전문의 사인오프, AuditLog 영구
**외부 연계**: 1393 / 1577-0199 / 119 / 응급의료센터 사전 등록
**검증 시나리오**: 박재훈 페르소나 L2 자동 감지 30초 내 알림·핫라인 노출 (E2E 회귀 대상)

---

## Appendix B. 핵심 의존성
- Claude API (`@anthropic-ai/sdk`)
- Next.js 15, Prisma 5, NextAuth, CASL
- Neon Postgres, Resend, Pusher, Sentry, Pino
- shadcn/ui, Tailwind, Zod
- Vitest, Playwright

## Appendix C. 용어집 (Glossary)

| 약어 | 뜻 |
|---|---|
| EAP | Employee Assistance Program, 직원 지원 프로그램 |
| PHQ-9 | 우울증 자가진단 9문항 |
| GAD-7 | 불안 자가진단 7문항 |
| SOAP | Subjective/Objective/Assessment/Plan 임상 노트 표준 |
| k-익명성 | 동일 그룹 내 ≥k 개체 보장 익명화 기법 |
| PMPM | Per Member Per Month, 1인당 월 정액 |
| DTx | Digital Therapeutics, 디지털 치료기기 |
| RBAC/ABAC | Role/Attribute-Based Access Control |
| RLS | Postgres Row Level Security |
| Outbox | 메시지 손실 방지 패턴 |
| DLQ | Dead Letter Queue |
| DoD | Definition of Done |
| NPS | Net Promoter Score |
| MAU/WAU | Monthly/Weekly Active Users |
| PITR | Point-in-time Recovery |

## Appendix D. PRD·IA 작성 시 활용 가이드

- **PRD**: §1.1, §2.1~§2.4 (UC + User Stories + 비즈니스 룰 + 상태 머신), §5.7 (API 시그니처), §5.8 (Tool I/O), §5.3 (NFR)
- **IA**: §3.1~§3.11 (Sitemap, URL, Nav, 상태, Onboarding, Settings, 알림, 에러, Legal, 검색, 시각 가이드)
- **DB 스키마**: §5.5 전체 + Prisma 예시
- **E2E 데모 시나리오**: §2.1 UC-1~UC-6 + §8 위기 검증 시나리오 조합
