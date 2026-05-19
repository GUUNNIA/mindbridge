# MindBridge — Information Architecture (IA)

> 정신건강 EAP 멀티롤 플랫폼 MVP의 정보 구조 정의서.
> 기반 문서: `golden-hugging-hamster.md` §3 전체

---

## 0. Document Info

| 항목 | 값 |
|---|---|
| 버전 | 0.1 (초안) |
| 작성일 | 2026-05-19 |
| 상태 | Draft (검토 대기) |
| 기반 기획안 | `../golden-hugging-hamster.md` §3 |
| 자매 문서 | `prd.md` (요구사항), `../mindbridge-dev-plan.md` (개발 일정) |
| 본 문서의 독자 | 풀스택 개발자, 라우팅·미들웨어 설계자 |

---

## 1. IA 원칙

1. **롤별 prefix 분리** — `/app`, `/counselor`, `/psychiatrist`, `/hr`, `/admin` — 미들웨어 1차 권한 검증 단위
2. **자원 단수 vs 복수** — 컬렉션은 복수형(`/bookings`), 단일 자원은 `/:id` (`/bookings/:id`), 액션은 명시적 동사(`/bookings/:id/cancel`)
3. **위기 접근성 우선** — 직원의 `/app/emergency`는 로그인 여부와 무관하게 항상 접근 가능, 위기 발생 시 상단 고정 배너
4. **익명성 우선** — HR·운영자 화면에서는 어떤 페이지에서도 실명 컬럼·셀이 노출되지 않는다
5. **상태 표준화** — Loading / Empty / Error / Permission Denied / Maintenance 5상태가 모든 페이지에서 일관된 컴포넌트로 표현
6. **모바일 = 직원 전용** — 직원 화면은 모바일 우선, 그 외 롤은 데스크톱 우선
7. **알림은 채널 × 이벤트 매트릭스** — 사용자가 채널별로 끄고 켤 수 있다

---

## 2. Sitemap

### 2.1 공통 (비로그인 또는 전 롤)

```
/                       랜딩
/signin                 로그인
/signup?code=xxx        가입 (초대코드 필수)
/forgot-password        비밀번호 찾기
/reset-password?token=  비밀번호 재설정
/terms                  이용약관
/privacy                개인정보처리방침
/policy/refund          환불정책
/faq                    자주 묻는 질문
/contact                문의
/403                    권한 없음
/404                    페이지 없음
/500                    서버 오류
/maintenance            점검 중
```

### 2.2 직원 (`/app/*`)

```
/app                                홈 (다음 예약·진단 권유·알림 요약)
/app/onboarding                     초기 안내 (스킵 가능)

/app/assessment                     자가진단 챗봇
/app/assessment/result              결과 카드

/app/counselors                     추천 상담사 목록
/app/counselors/:id                 상담사 상세 + 예약 슬롯

/app/bookings                       내 예약 목록
/app/bookings/:id                   예약 상세 (취소·변경)

/app/session/:id                    실시간 세션룸

/app/feedback/:sessionId            피드백 작성

/app/notifications                  알림 센터

/app/emergency                      위기 핫라인 (항상 접근 가능)

/app/settings                       설정 허브
  /app/settings/account             계정 정보
  /app/settings/consents            동의 관리
  /app/settings/notifications       알림 채널 토글
  /app/settings/data-rights         데이터 열람·정정·삭제·이전 요청
  /app/settings/danger              회원 탈퇴
```

### 2.3 상담사 (`/counselor/*`)

```
/counselor                          홈 (오늘 일정 요약)
/counselor/calendar                 일정 (주간·월간)
/counselor/cases                    담당 케이스 리스트 + 필터
/counselor/cases/:id                케이스 상세 (진단·이전 노트 타임라인 포함)
/counselor/session/:id              세션룸 (상담사 측)
/counselor/availability             가용 시간 설정
/counselor/settings                 설정 (계정·알림)
# /counselor/notes                  노트 검색 — V2 (암호화 컬럼 검색 호환 필요)
```

### 2.4 전문의 (`/psychiatrist/*`)

```
/psychiatrist                       홈 (큐 상단 우선순위)
/psychiatrist/queue                 에스컬레이션 큐
/psychiatrist/cases/:id             케이스 리뷰 + 사인오프
/psychiatrist/settings              설정 (계정·알림)
```

### 2.5 HR (`/hr/*`)

```
/hr                                 홈 (월별 핵심 지표 요약)
/hr/dashboard                       실시간 집계 (k≥5)
/hr/reports                         월간 리포트 리스트
/hr/reports/:id                     리포트 상세 + PDF 다운로드
/hr/invites                         초대코드 발급·관리
/hr/settings                        설정 (계정·알림)
```

### 2.6 운영자 (`/admin/*`)

```
/admin                              홈 (위기 알림·운영 메트릭)
/admin/companies                    기업·구독 관리
/admin/counselors                   상담사 풀·승인·등급
/admin/risk-queue                   위기 큐 (우선순위)
/admin/escalations                  에스컬레이션 SLA 모니터
/admin/payments                     정산 (수동 입력)
/admin/audit-logs                   감사 로그 검색
/admin/notifications                알림 발송 모니터(Outbox)
/admin/settings                     설정 (계정)
```

---

## 3. URL Convention

| 패턴 | 의미 | 예시 |
|---|---|---|
| `/{role-prefix}` | 롤 홈 | `/app`, `/counselor` |
| `/{role-prefix}/{resource}` | 컬렉션 | `/app/bookings` |
| `/{role-prefix}/{resource}/:id` | 단일 자원 | `/app/bookings/abc` |
| `/{role-prefix}/{resource}/:id/{action}` | 액션 | `/app/bookings/abc/cancel` |
| `?` 쿼리 | 필터·정렬 | `/counselor/cases?status=in_progress&sort=recent` |

**미들웨어 매핑**
- `/app/*` → EMPLOYEE
- `/counselor/*` → COUNSELOR
- `/psychiatrist/*` → PSYCHIATRIST
- `/hr/*` → HR
- `/admin/*` → ADMIN

미들웨어는 prefix 기준 1차 검증만 수행. 자원 단위 권한(예: 다른 상담사의 노트 접근 시도)은 CASL ability로 Server Action 레벨에서 검증.

---

## 4. Navigation Patterns

### 4.1 영역별 Nav 패턴

| 영역 | 데스크톱 | 모바일 (직원만) |
|---|---|---|
| Primary nav | 좌측 사이드바 (롤별 메뉴) | 하단 탭바 (4~5개) |
| Secondary nav | 페이지 내 탭 | 상단 탭 |
| 알림 배지 | 사이드바 아이콘 우측 상단 | 탭 아이콘 우측 상단 |
| 위기 배너 | 상단 고정 (위기 발생 시) | 동일 |
| 비상 연락처 | Footer 상시 노출 (직원만) | 동일 |
| 사용자 메뉴 | 사이드바 하단 | 상단 우측 햄버거 |

### 4.2 롤별 Primary Nav 항목

**직원** (모바일 탭바 기준 5개)
- 홈 / 자가진단 / 예약 / 알림 / 설정 (또는 비상)

**상담사**
- 홈 / 일정 / 케이스 / 가용시간 / 설정 (노트는 케이스 상세 안에서 접근, 별도 검색 페이지는 V2)

**전문의**
- 홈 / 큐 / 설정

**HR**
- 홈 / 대시보드 / 리포트 / 초대코드 / 설정

**운영자**
- 홈 / 위기 큐 / 에스컬레이션 / 기업·구독 / 상담사 / 정산 / 감사 로그 / 알림 모니터 / 설정

### 4.3 컨텍스트 Nav (Breadcrumb)

데스크톱에서 3단계 이상 깊은 페이지에 표시:
```
홈 > 케이스 > 김민지 (case-abc123) > 세션 #4 > 노트
```

---

## 5. Screen Inventory

각 페이지의 목적·핵심 액션·핵심 데이터·상태 의존성을 정의. 와이어프레임은 별도 산출물.

### 5.1 직원 화면

#### `/app` — 홈
- **목적**: 다음에 할 일을 한눈에
- **핵심 데이터**: 다음 예약 카드, 진단 권유 배너 (없으면), 미읽 알림 3건, 이전 세션 요약
- **핵심 액션**: "자가진단 시작", "예약 보기", "다음 세션 입장"
- **상태**: 첫 방문(Empty: 자가진단 권유) / 예약 있음 / 위기 배너 표시

#### `/app/onboarding`
- **목적**: 7단계 가입 흐름 (§7 참조)
- **상태**: 진행 표시 (1/7 ~ 7/7)

#### `/app/assessment` — 자가진단 챗봇
- **목적**: Claude 챗봇과의 4~6턴 대화로 카테고리·심각도 분류
- **핵심 데이터**: 진행 메시지 스레드, 진단 진행률
- **핵심 액션**: 메시지 전송, 중단(임시저장)
- **상태**: 진행 중 / 완료 / 위기 키워드 감지 → 즉시 핫라인 표시

#### `/app/assessment/result`
- **목적**: 진단 결과 카드 + 다음 행동 권유
- **핵심 데이터**: 카테고리·심각도·Action Item 3개·상담사 추천 CTA
- **상태**: 정상 / 심각도 SEVERE 시 강조

#### `/app/counselors`
- **목적**: 자가진단 기반 추천 상담사 3명 + 더 보기
- **핵심 데이터**: 상담사 카드 (이름·등급·평점·전문분야·다음 가능 시간·추천 이유)
- **필터·정렬**: 카테고리·등급·평점·가능시간·언어 / 추천도·평점·가까운 시간
- **핵심 액션**: 상세 보기, 즉시 예약

#### `/app/counselors/:id`
- **목적**: 상담사 프로필 + 슬롯 선택
- **핵심 데이터**: 자기소개·자격·평점 분포·후기·주간 슬롯 캘린더
- **핵심 액션**: 슬롯 선택 → 예약 생성

#### `/app/bookings`
- **목적**: 내 예약 시간순 리스트
- **필터·정렬**: 상태(예정·완료·취소)·기간
- **핵심 액션**: 상세 보기, 취소

#### `/app/bookings/:id`
- **목적**: 단일 예약 상세
- **핵심 데이터**: 상담사·일시·상태·취소 정책 안내
- **핵심 액션**: 취소·변경·세션 입장 (시각 임박 시)

#### `/app/session/:id` — 세션룸
- **목적**: 실시간 텍스트 세션
- **핵심 데이터**: 메시지 스레드·타이머·상담사 정보 사이드
- **핵심 액션**: 메시지 전송, 세션 종료, 비상 버튼
- **상태**: SCHEDULED(대기실) / IN_PROGRESS(채팅 가능) / COMPLETED(종료 화면) / 위기 감지(상단 배너)

#### `/app/feedback/:sessionId`
- **목적**: 세션 후 평가
- **핵심 데이터**: 별점·자유 코멘트·재상담 의사·다른 상담사 요청 옵션
- **상태**: 미작성(폼) / 작성 완료(요약)

#### `/app/notifications`
- **목적**: 알림 통합 수신함
- **탭**: 전체 / 예약 / 위기 / 시스템
- **상태**: 안 읽음·읽음·보관
- **일괄 액션**: 모두 읽음, 보관

#### `/app/emergency` — 위기 핫라인 (항상 접근 가능)
- **목적**: 즉시 도움
- **핵심 데이터**: 1393 자살예방상담전화 / 1577-0199 정신건강위기상담전화 / 119 응급 / 응급의료센터 안내
- **핵심 액션**: 원터치 전화, 위치 안내
- **접근**: Footer 상시 + 위기 감지 시 상단 배너에서 진입

#### `/app/settings/*` — 설정 5개 페이지
- 계정 / 동의 관리 / 알림 설정 / 데이터 권리 / 회원 탈퇴 (각각 §6.2 IA 매트릭스 참조)

### 5.2 상담사 화면

#### `/counselor` — 홈
- **목적**: 오늘 일정 요약 + 즉시 처리 항목
- **핵심 데이터**: 오늘 세션 카드 (시간·내담자 익명 ID·진단 카테고리), 미작성 노트 카운트, 위기 플래그 카운트
- **상태**: 일정 없음(Empty) / 위기 알림 있음(상단 강조)

#### `/counselor/calendar`
- **목적**: 주간·월간 일정
- **핵심 데이터**: 시간 블록(예약·가용·휴식), 색상 코딩
- **핵심 액션**: 블록 클릭 → 케이스/예약 상세

#### `/counselor/cases`
- **목적**: 담당 케이스 리스트
- **필터·정렬**: 상태(진행/완료)·기간·위험도 / 최신순
- **핵심 데이터**: 카드 (내담자 익명 ID·카테고리·다음 세션·위험도)

#### `/counselor/cases/:id`
- **목적**: 단일 케이스 상세
- **핵심 데이터**: 자가진단 요약·이전 노트 타임라인·세션 이력
- **핵심 액션**: 세션 입장, 노트 작성, 후속 권고 메모

#### `/counselor/session/:id` — 세션룸 (상담사 측)
- **목적**: 직원 세션룸의 상담사 측
- **추가 데이터**: 메모 사이드 패널, AI 메모 → SOAP 변환 버튼
- **핵심 액션**: 메시지 / 메모 / SOAP 생성 / 세션 종료

> `/counselor/notes` 노트 검색 페이지는 **V2**. V1에서 노트는 `/counselor/cases/:id` 케이스 상세 안에서 타임라인으로만 접근.

#### `/counselor/availability`
- **목적**: 가용 시간 슬롯 설정
- **핵심 데이터**: 주간 캘린더, 반복 패턴
- **핵심 액션**: 슬롯 추가·삭제, 휴가 등록

### 5.3 전문의 화면

#### `/psychiatrist` — 홈
- **목적**: 큐 우선순위 + SLA 임박 알림
- **핵심 데이터**: 큐 상위 5건, SLA 잔여 시간

#### `/psychiatrist/queue`
- **목적**: 전체 에스컬레이션 큐
- **필터·정렬**: 위험도·SLA 잔여시간·상태 / SLA 임박 우선
- **핵심 데이터**: 카드 (내담자 익명 ID·위험도·SLA·상담사·요약)

#### `/psychiatrist/cases/:id` — 사인오프
- **목적**: 케이스 리뷰 + 의사 결정
- **핵심 데이터**: 자가진단·세션 요약·위기 키워드·상담사 의견
- **핵심 액션**: 의견 입력, 약물 권고 메모, 가족 동의 체크, 사인오프

### 5.4 HR 화면

#### `/hr` — 홈
- **목적**: 월별 핵심 지표 요약
- **핵심 데이터**: 이용률·카테고리 Top 3·번아웃 추세 (모두 k≥5)

#### `/hr/dashboard`
- **목적**: 실시간 익명 집계
- **핵심 데이터**: 추이 차트(이용률·카테고리·번아웃 지표), 부서별 비교(k≥5)
- **마스킹**: k<5 셀은 "<5명"으로 표시

#### `/hr/reports`
- **목적**: 월간 리포트 목록
- **핵심 데이터**: 기간·생성일·PDF 다운로드

#### `/hr/reports/:id`
- **목적**: 단일 리포트 상세
- **핵심 데이터**: 1페이지 인사이트 + 차트 3개 + Action Item
- **핵심 액션**: PDF 다운로드, 이메일 공유

#### `/hr/invites`
- **목적**: 초대코드 발급·관리
- **핵심 데이터**: 코드 목록 (발급일·사용 여부·만료일)
- **핵심 액션**: 일괄 발급, 폐기

### 5.5 운영자 화면

#### `/admin` — 홈
- **목적**: 위기·운영 핵심 메트릭
- **핵심 데이터**: 위기 큐 상위 / Outbox 실패 카운트 / 오늘 인증 실패율 / 신규 가입자

#### `/admin/risk-queue`
- **목적**: 위기 신호 통합 큐
- **필터·정렬**: 위험도 L1~L4·상태·회사·기간 / SLA 잔여 시간
- **핵심 액션**: 확인(Ack), 상담사·전문의 재배정, 디스미스(사유 입력 필수)

#### `/admin/escalations`
- **목적**: SLA 모니터
- **핵심 데이터**: 전체 에스컬 + SLA 카운트다운

#### `/admin/counselors`
- **목적**: 상담사 풀
- **핵심 액션**: 승인, 등급 변경, 정지(사유), 슈퍼비전 이력

#### `/admin/companies`
- **목적**: 기업·구독 관리
- **핵심 데이터**: 회사 리스트·Subscription 상태·Seat 사용률

#### `/admin/payments`
- **목적**: 정산 (수동 입력)
- **핵심 데이터**: 월별 정산 대상자·금액·지급 상태

#### `/admin/audit-logs`
- **목적**: 감사 로그 검색
- **필터**: actor·resourceType·action·기간 / 최신순
- **핵심 액션**: 로그 상세, CSV 내보내기

#### `/admin/notifications`
- **목적**: 알림 Outbox 모니터
- **핵심 데이터**: PENDING / SENT / FAILED / DLQ 카운트, 실패 메시지 상세
- **핵심 액션**: 재시도, DLQ 폐기

---

## 6. Screen States Standard

모든 페이지에서 일관된 컴포넌트로 표현. shadcn/ui 기반.

### 6.1 상태 5종

| 상태 | UX 컴포넌트 | 트리거 |
|---|---|---|
| **Loading** | `<Skeleton />` (테이블 행·카드 단위) | fetch 진행 중 |
| **Empty** | `<EmptyState>` (아이콘 + 메시지 + CTA) | 데이터 없음 |
| **Error** | `<Alert variant="destructive">` + 재시도 + Sentry trace id | fetch 실패 |
| **Permission Denied** | `/403` 페이지 또는 인라인 Alert + AuditLog 자동 기록 | CASL 거부 |
| **Maintenance** | `/maintenance` 자동 리다이렉트 | 환경변수 토글 |

### 6.2 Empty State 패턴

각 페이지마다 고유의 빈 상태 카피·CTA:

| 페이지 | Empty 카피 | CTA |
|---|---|---|
| `/app` (신규) | "안녕하세요! 자가진단으로 시작해보세요" | 자가진단 시작 |
| `/app/bookings` | "예정된 예약이 없어요" | 상담사 찾기 |
| `/counselor/cases` | "담당 케이스가 없습니다" | 가용 시간 확인 |
| `/admin/risk-queue` | "현재 처리 중인 위기 신호가 없습니다" | (CTA 없음, 안정 상태) |

### 6.3 Error Page 카피

| 페이지 | 카피 | 액션 |
|---|---|---|
| 404 | "찾으시는 페이지가 없어요" | 홈으로 / 검색 |
| 403 | "접근 권한이 없습니다" | 로그아웃 / 문의 |
| 500 | "일시적 오류가 발생했어요" | 재시도 / Sentry id 복사 / 문의 |
| 503 | "점검 중입니다" | 예상 복구 시간 |

---

## 7. Key User Flows

### 7.1 직원 Onboarding (7화면)

```
[1] /signup?code=xxx          초대코드 검증
       │
       ▼ 코드 유효
[2] 이메일·비밀번호 입력       비밀번호 강도 표시
       │
       ▼
[3] 이메일 인증 메일 발송      대기 화면
       │
       ▼ 인증 링크 클릭
[4] 본인 인증 완료 진입
       │
       ▼
[5] 동의 3단계                서비스 / 민감정보 / 통계·마케팅
                              각 단계 약관 표시, 동의 버전 기록
       │
       ▼
[6] 익명 닉네임 설정          실명 입력 없음
       │
       ▼
[7] 초기 자가진단 권유         스킵 시 /app 홈
```

### 7.2 자가진단 → 매칭 → 예약 (직원)

```
/app 홈
   │ "자가진단 시작" 클릭
   ▼
/app/assessment
   │ Claude 챗봇 4~6턴
   │ 각 메시지마다 assess_risk 도구 호출
   │ 위기 키워드 감지 시 → 상단 핫라인 배너 + 운영자 알림
   │
   │ classify_category 도구로 종합 분류
   ▼
/app/assessment/result
   │ 카테고리·심각도·Action Item 3개 표시
   │ "상담사 찾기" CTA
   ▼
/app/counselors
   │ BR-4 가중치로 상위 3명 추천
   │ 카드에 추천 이유 표시
   ▼
/app/counselors/:id
   │ 프로필·후기·주간 슬롯
   ▼
[슬롯 선택]
   │ createBooking Server Action
   │ DB 유니크 제약으로 동시성 처리
   │ NotificationOutbox에 예약 확정 알림 enqueue
   ▼
/app/bookings/:id
   │ 예약 확정 화면 + 이메일 발송됨 안내
```

### 7.3 세션 → SOAP → 피드백 (상담사·직원)

```
[상담사 측]                                    [직원 측]
/counselor → 세션 카드 클릭                    /app → 다음 세션 카드 클릭
       │                                              │
       ▼                                              ▼
/counselor/session/:id                         /app/session/:id
   │ 메시지 + 메모 사이드                          │ 메시지 채팅
   │ assess_risk 매 메시지마다 호출                │
   │ Pusher 또는 SSE로 양방향                      │
       │                                              │
       │ [세션 종료 클릭]                              │
       ▼                                              ▼
   메모 작성 → "SOAP 생성" 클릭                    세션 완료 화면
   │ generate_soap 도구 호출                       │
   │ SOAP 4섹션 + 직원용 요약 + Action Item          │
   │ 수정 후 저장                                    │
   ▼                                                ▼
   ClinicalNote 생성 (암호화 컬럼)               24h 후 피드백 알림
                                                    │
                                                    ▼
                                              /app/feedback/:sessionId
                                                   │ 별점·코멘트·재상담 의사
                                                   ▼
                                              매칭 가중치 반영
```

### 7.4 위기 감지 → 에스컬레이션 (직원·상담사·운영자·전문의)

```
[L2 감지]
직원 메시지 → assess_risk(confidence ≥ 0.7, level=L2)
   │
   ├──→ 직원 화면 상단: 1393·1577-0199·119 핫라인 배너
   ├──→ RiskFlag.OPEN 생성
   ├──→ NotificationOutbox: 상담사·운영자 즉시 알림
   ▼
[운영자 또는 상담사 확인]
RiskFlag → IN_REVIEW
   │
   ├──→ 해결 → RESOLVED
   └──→ 외부 의뢰 → EXTERNAL_REFERRED

[L3 감지]
   │
   ├──→ 위 L2 동작 + Escalation.PENDING 생성
   ├──→ NotificationOutbox: 전문의 즉시 알림 (Email + SMS)
   ▼
/psychiatrist/queue
   │ 전문의 진입 → Escalation.IN_REVIEW
   ▼
/psychiatrist/cases/:id
   │ 리뷰·의견·약물 권고·가족 동의 체크
   │ "사인오프" 클릭
   ▼
Escalation.DECIDED + AuditLog 영구 기록

[L3 SLA 만료]
24h 경과 시 cron으로 Escalation.EXPIRED
   │
   ├──→ 다른 전문의에게 재배정
   └──→ NotificationOutbox: 운영자 즉시 알림
```

### 7.5 HR 월간 리포트 생성

```
[매월 1일 cron 또는 HR 수동 트리거]
generateMonthlyReport(period)
   │
   │ BR-7 검증: 직원 수 ≥20 또는 동의자 ≥10
   │ 미충족 → 차단 + HR에 사유 알림
   │
   ▼ 통과
1. 집계 쿼리 실행 (이용률·카테고리 분포·번아웃 지표)
2. k-익명성 가드: 각 셀 k≥5 검증, 미달은 "<5명"으로 마스킹
3. generate_hr_insight 도구 호출
   │ 입력: 집계 메트릭 + 전월 비교
   │ 출력: 1단락 인사이트 + Key Takeaways 3 + Action 3
4. PDF 생성 (react-pdf 또는 puppeteer)
5. HRReport 저장 + 인사이트 PDF URL
   │
   ▼
NotificationOutbox: HR에 "리포트 준비됨" 이메일
   │
   ▼
/hr/reports/:id 에서 열람·다운로드
```

---

## 8. Search & Filter Patterns

| 페이지 | 필터 | 정렬 |
|---|---|---|
| `/app/counselors` | 카테고리(태그)·등급·평점·가능 시간·언어 | 추천도 / 평점 / 가까운 시간 |
| `/counselor/cases` | 상태(진행/완료)·기간·위험도 | 최신순 / 위험도 높은 순 |
| `/admin/risk-queue` | 위험도 L1~L4·상태·회사·기간 | SLA 잔여 시간 |
| `/admin/audit-logs` | actor·resourceType·action·기간 | 최신순 |
| `/admin/companies` | 상태(TRIAL/ACTIVE/...)·플랜 | Seat 사용률 |

**공통 패턴**
- 필터는 URL 쿼리 파라미터로 직렬화 (`?status=in_progress&from=2026-05-01`)
- 정렬은 단일 정렬 키 + 방향
- 페이지네이션은 cursor 기반 (큰 리스트) 또는 offset (작은 리스트)

---

## 9. Notification Center Architecture

### 9.1 알림 센터 (`/app/notifications`)

**탭 구성**
- 전체 / 예약 / 위기 / 시스템

**상태**
- 안 읽음 (badge count 반영) / 읽음 / 보관 (별도 보기)

**일괄 액션**
- 모두 읽음 표시
- 선택 보관
- 보관 해제

### 9.2 알림 이벤트 매트릭스

| 이벤트 | 직원 | 상담사 | 전문의 | HR | 운영자 |
|---|---|---|---|---|---|
| 예약 확정 | E+I | E+I | - | - | - |
| 리마인더 24h/1h | E | E | - | - | - |
| 세션 완료 | I | - | - | - | - |
| 피드백 요청 (24h후) | E+I | - | - | - | - |
| 평점 3.0↓ 발생 | - | - | - | - | I |
| 위기 L2 | (배너) | E+I | - | - | E+I |
| 위기 L3 | (배너) | E+I | E+S | - | E+I |
| 위기 L4 | (배너+화면 안내) | E+I | E+S | - | E+S |
| SLA 만료 임박 | - | - | I | - | I |
| SLA 만료 | - | - | I | - | E+I |
| 월간 리포트 준비 | - | - | - | E | - |
| 구독 갱신 30일 전 | - | - | - | E | E |
| Outbox 실패 (5회) | - | - | - | - | E+I |

(E = Email, I = In-app, S = SMS)

### 9.3 이메일 템플릿 표준

**공통 구조**
```
[Header: 로고 + 데모 환경 배지]

[제목 라인]
[안녕하세요, {닉네임}님]

[본문 핵심 정보]

[CTA 버튼]

[Footer: 위기 핫라인 1393 / 1577-0199 / 119 · 수신거부 · 운영 약관]
```

**예: 예약 확정**
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

**필수 요소**
- 모든 이메일에 위기 핫라인 footer
- 수신거부 링크 (마케팅성만, 거래성 알림은 옵션)
- 텍스트 버전 (이메일 클라이언트 호환)

---

## 10. Visual Guide

> **디자인 산출물 정책**: V1 MVP는 와이어프레임·고화질 Figma 시안 없이 진행. shadcn/ui 기본 컴포넌트 + Tailwind 토큰만으로 구현. 이 IA 문서가 화면 결정의 단일 출처. 디자인 시안은 V2로 미룸.

### 10.1 색상 시스템

**위험도 색상 (브랜드 색과 분리)**
| 레벨 | Tailwind 토큰 | 용도 |
|---|---|---|
| L1 주의 | `yellow-500` | 플래그 배지 |
| L2 경고 | `orange-500` | 알림 배너 |
| L3 위기 | `red-500` | 큐 강조 |
| L4 응급 | `red-700` (+ 점멸) | 응급 배너 |

**일반 시맨틱**
- Primary: 차분한 blue-green (psychology-safe)
- Success: green-600
- Info: blue-500
- Warning: amber-500
- Destructive: red-600

### 10.2 타이포그래피

- 폰트: **Pretendard**
- 사이즈: 14 / 16 / 20 / 24 / 32px
- 본문 라인 높이 1.6
- 한글 letter-spacing -0.01em

### 10.3 톤앤매너

- 차분한 blue-green 계열 (불안 유발 피함)
- 카드·여백 중심 레이아웃
- 챗봇·세션룸은 messaging UI 표준 (말풍선, 시간 표시)
- 위기·응급 상황만 강한 색·점멸 사용 — 일반 UI에서 빨강 남용 금지

### 10.4 롤별 시각 차별화

- 직원: 부드럽고 친근한 톤 (둥근 카드·일러스트 강조)
- 상담사: 정보 밀도 높은 데이터 테이블 + 사이드 패널
- 전문의: 큐 중심, SLA 카운트다운 강조
- HR: 차트·인사이트 중심, 대시보드 톤
- 운영자: 운영 콘솔 톤 (밀도·표·필터 강조)

---

## 11. Accessibility Notes

V1 best-effort, V2에서 WCAG 2.1 AA 정식 인증.

- 키보드 navigation: 모든 핵심 흐름은 키보드만으로 동작 가능
- focus ring: `outline-2 outline-offset-2 outline-blue-500`
- 색만으로 정보 전달 금지 (위험도는 색+아이콘+텍스트 라벨)
- form label 명시·error 메시지 aria-live
- 챗봇 메시지 스레드: `role="log" aria-live="polite"`
- 비상 배너: `role="alert"`

---

## 12. Deferred Decisions & V2 Backlog

> IA에서 다뤄지는 미결 항목은 PRD §11과 통합 관리. 본 절은 IA 고유 항목만 요약. 전체 결정 표는 `prd.md` §11 참조.

### 12.A IA 고유 Deferred Decisions

- 상담사 자기 프로필 편집 페이지 `/counselor/profile` (직원이 보는 프로필과 별개의 편집 화면) → **Day 16**
- 세션 시작 UX (한쪽만 입장한 상태 — 대기실 vs 즉시 입장) → **Day 15**
- 예약 변경 범위 (직원의 시각 변경만 vs 상담사도 변경 가능) → **Day 11**
- 세션룸 재진입 시 메시지 히스토리 노출 범위 → **Day 15**
- 알림 채널별 우선순위·중복 제어 (in-app + email 동시 발송 시 순서) → **Day 12**
- 알림 그루핑 (같은 케이스 내 다중 신호의 묶음 처리) → **Day 19**
- 상담사·HR의 모바일 최소 동작 (위기 알림 수신만? 본격 사용?) → **Week 4 점검**
- shadcn 컴포넌트 매핑 (페이지별 컴포넌트 선택) → 작업 진행하면서 자연 결정

### 12.B V2 Backlog (V1 범위 제외)

- **와이어프레임·고화질 디자인 시안** — V1은 shadcn/ui + Tailwind 기본만 (§10 참조)
- **운영자 시스템 헬스 페이지** — V1은 Sentry 대시보드로 대체
- **공지·점검 안내 페이지** — V1은 환경변수 토글로 `/maintenance` 페이지 리다이렉트만
- **상담사 슈퍼비전 노트 공유** — V1은 운영자 화면의 텍스트 이력만
- **임상 노트 검색 페이지** (`/counselor/notes`) — 컬럼 암호화와 검색 호환이 V1 범위 밖이라 페이지 자체를 V2로

---

## 13. 부록

### 13.1 관련 문서
- `../golden-hugging-hamster.md` — 기획안 §3
- `./prd.md` — Product Requirements Document
- `../mindbridge-dev-plan.md` — 4주 개발 일정

### 13.2 다음 단계
1. PRD/IA 검토·결정 사항 합의 (Open Questions 처리)
2. Week 0 환경 셋업 (계정·도메인·키)
3. Week 1 Day 1 — Next.js 프로젝트 부트스트랩 + Prisma 스키마 W1 P0 엔티티
