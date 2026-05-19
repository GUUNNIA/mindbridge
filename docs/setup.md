# Week 0 셋업 가이드

> 외부 서비스 가입·키 발급·환경변수 셋업 가이드. 단계별 UI 클릭이 아니라 **프로젝트 결정사항·이름·키 보관 위치·검증 방법**에 초점. 각 서비스 자체 UI는 변경되므로 본 문서는 "무엇을 어디에" 만들고 "어떤 키를 어디에" 둘지에 집중.

---

## 0. 핵심 결정사항

| 항목 | 결정 |
|---|---|
| 프로젝트 식별자 | `mindbridge` — GitHub repo, Vercel project, Neon project 모두 동일 이름 |
| 도메인 | Vercel 기본 도메인 (`mindbridge-*.vercel.app`). 별도 도메인 없음 |
| 환경변수 로컬 보관 | `.env.local` (gitignore 됨) |
| 환경변수 클라우드 | Vercel Project → Settings → Environment Variables (Encrypted) |
| 키 분실 대비 백업 | `.env.local` 사본을 외부 안전 위치(1Password·드라이브 암호화 폴더)에 별도 보관 |
| 가입 이메일 | 단일 이메일로 7개 서비스 모두 가입 (계정 분산 회피) |

**경고**: `.env.local`은 절대 commit 금지. `.env.example`만 commit. Vercel에 키를 등록하기 전까지는 Production 배포 금지.

---

## 1. Week 0 즉시 가입 (4개)

### 1.1 GitHub

**무엇**: 코드 저장소.

**가입 단계**
1. GitHub 계정 (이미 있으면 skip)
2. New repository → `mindbridge`
3. Private (V1은 공개 의미 없음)
4. README 체크 해제 (로컬에서 직접 init)
5. .gitignore: Node 선택

**Vercel 연동을 위해 필요**: GitHub OAuth로 Vercel가입 시 자동 연결됨. 별도 토큰 불필요.

**환경변수**: 없음.

**검증**: repo URL이 `https://github.com/{user}/mindbridge` 형태로 접근 가능.

---

### 1.2 Vercel

**무엇**: Next.js 호스팅 + 자동 배포.

**가입 단계**
1. https://vercel.com — "Continue with GitHub" 으로 가입 (GitHub repo와 동일 계정)
2. Hobby plan 선택 (무료, 개인 프로젝트)
3. Import Project → `mindbridge` repo 선택
4. **빌드는 아직 실패함 — 의도된 것**. 환경변수 없이는 build 통과 못함. Week 0 마지막에 env 채우고 재배포.
5. Project Settings → General → Production Branch = `main` (확정)

**무료 티어 한도** (Hobby plan)
- 100 GB bandwidth/월
- 100h serverless execution/월
- 10s function timeout (default)
- 1 concurrent build
- → V1 MVP에는 충분

**환경변수**: 없음 (지금은). Week 0 종료 시 모든 키를 Vercel에 등록.

**검증**: `mindbridge-*.vercel.app` 도메인이 발급됨 (실제 URL은 import 후 확인).

**주의**: Vercel 프로젝트 이름은 변경 가능하지만 도메인이 바뀌면 마찰. 처음에 `mindbridge`로 확정.

---

### 1.3 Neon Postgres

**무엇**: Postgres DB (PITR·branching 지원). Prisma와 호환.

**가입 단계**
1. https://neon.tech — GitHub 또는 이메일로 가입
2. Free plan 선택
3. New Project → name: `mindbridge` / Postgres version: 16 / Region: **AWS Singapore (`ap-southeast-1`)** — 한국 서버 부재, Singapore가 가장 낮은 지연
4. Database name: `mindbridge` (기본값)
5. Connection string 복사 (Pooled connection — `?pgbouncer=true` 포함)

**무료 티어 한도**
- 0.5 GB storage
- 단일 Postgres compute (autoscale 안 됨, Free)
- 1 project, 10 branches
- PITR 7일
- → V1 MVP에는 충분 (시드 50명 + 노트 수백 건 정도)

**발급할 키**
| 환경변수 | 값 | 어디서 |
|---|---|---|
| `DATABASE_URL` | Pooled connection string | Neon Dashboard → Connection Details → Pooled connection |
| `DIRECT_URL` | Direct connection string (마이그레이션용) | Connection Details → Direct connection |

**왜 두 개 URL**: Prisma migration은 transaction pooler와 호환 안 되므로 `DIRECT_URL`을 마이그레이션·인트로스펙션에 사용. 런타임은 pooled `DATABASE_URL` 사용.

**검증**:
```bash
# 가입 후 connection string 받으면:
psql "$DATABASE_URL" -c "SELECT 1;"
# 또는 Neon Console의 SQL Editor에서 SELECT 1 실행
```

**주의**: Free tier는 5분 idle 후 compute suspend됨 (cold start ~1-2초). V1 시연·개발에 무해.

---

### 1.4 Anthropic API

**무엇**: Claude API. 자가진단·SOAP·위기 감지·HR 인사이트 4종 모두 여기서 호출.

**가입 단계**
1. https://console.anthropic.com — 가입
2. Workspace 생성 (개인 프로젝트면 기본 workspace 사용 가능)
3. **Billing 설정**: Credit card 등록 + 초기 credit ($5~10 권장)
4. **Usage Limit 설정** (필수): Settings → Limits → Monthly limit = $20 (V1 MVP 추정 $5-10이지만 안전 마진)
5. **Spend Alert 설정**: Email alert at 50%, 80%, 100%
6. API Key 발급 → Settings → API Keys → Create Key → name: `mindbridge-dev`

**예상 비용** (V1 MVP 1개월)
- 자가진단 1회 ~$0.02 (multi-turn, 캐시 적중)
- SOAP 1회 ~$0.015
- 위기 감지 매 메시지 ~$0.001
- HR 리포트 1회 ~$0.04
- 가상 케이스 100건 시뮬레이션 → 총 $5~10 예상

**발급할 키**
| 환경변수 | 값 | 비고 |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | 발급 즉시 복사 (다시 표시 안 됨) |

**모델 ID 사용 정책** (코드에서)
- 자가진단·SOAP·HR 인사이트: `claude-sonnet-4-6`
- 위기 감지: `claude-opus-4-7` 또는 sonnet + 보수적 임계값 (Day 19에 결정)

**검증**:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```
응답에 `"content":[{"type":"text","text":"..."}]`이 포함되면 OK.

**주의**: API 키는 발급 시 한 번만 표시됨. 분실 시 새 키 발급 후 이전 키 폐기.

---

## 2. Deferred 가입 (3개) — 필요 시점 요약만

각 서비스는 코드가 실제로 호출하는 Day까지 가입 미루기. 무료 티어 만료·환경변수 무더기 관리를 회피.

### 2.1 Sentry (→ Day 7)
- **무엇**: 에러 추적·성능 모니터링.
- **Day 7에 작성될 작업**: `instrumentation.ts` 셋업, CSP 정책에 Sentry CDN 허용
- **가입 시 결정**: organization name = `mindbridge-dev`, project type = Next.js
- **발급 키**: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (source map 업로드용)
- **무료 티어**: 5K errors/월, 10K performance events/월
- **참고 URL**: https://sentry.io

### 2.2 Resend (→ Day 12, Sandbox 모드)
- **무엇**: 이메일 발송 (예약 확정·리마인더·피드백 요청).
- **Day 12에 작성될 작업**: `lib/notifications/outbox.ts` + 워커 + 이메일 템플릿
- **가입 시 결정**: **Sandbox 모드만 사용** — `onboarded@resend.dev` 또는 본인 인증한 이메일 주소로만 발송 가능. V1 시연 가상 계정 50명은 직접 등록.
- **발급 키**: `RESEND_API_KEY`
- **무료 티어**: 3K emails/월, 100 emails/일
- **주의**: 본인 도메인 인증 없이도 발송 가능하지만, 보낸이 주소는 `onboarding@resend.dev` 고정. V2에서 본인 도메인 인증.
- **참고 URL**: https://resend.com

### 2.3 Pusher (→ Day 15)
- **무엇**: 세션룸 실시간 텍스트 채팅 (WebSocket pub/sub).
- **Day 15에 작성될 작업**: `app/session/[id]` + Pusher 채널 구독·발행 로직
- **가입 시 결정**: cluster = `ap3` (Asia Pacific - Tokyo, 한국에서 가장 가까움)
- **발급 키**: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
- **무료 티어** (Sandbox plan)
  - 100 concurrent connections
  - 200K messages/일
  - → V1 MVP 동시 접속 10명에 충분
- **참고 URL**: https://pusher.com

---

## 3. 환경변수 전체 목록 (.env.example)

Week 0 종료 시점 `.env.local`은 아래 항목 중 **Week 0 즉시 가입한 4개 서비스 키만** 채워져 있어야 함. 나머지는 deferred Day에 추가.

```bash
# === Week 0 즉시 (필수) ===

# Neon Postgres
DATABASE_URL="postgresql://...?pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://..."

# Anthropic Claude API
ANTHROPIC_API_KEY="sk-ant-api03-..."

# NextAuth (Week 1 Day 2에 생성)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"  # 로컬 생성

# 컬럼 암호화 키 (Week 3 Day 18 사용, V1 단일 키)
ENCRYPTION_KEY="$(openssl rand -base64 32)"  # 32 bytes base64
ENCRYPTION_KEY_VERSION="1"

# 익명화 salt (User.anonymizedId BLAKE2b)
ANONYMIZATION_SALT="$(openssl rand -base64 32)"

# === Deferred (Day 7+) ===

# Sentry (Day 7+)
# SENTRY_DSN=""
# SENTRY_AUTH_TOKEN=""

# Resend (Day 12+)
# RESEND_API_KEY=""

# Pusher (Day 15+)
# PUSHER_APP_ID=""
# PUSHER_KEY=""
# PUSHER_SECRET=""
# PUSHER_CLUSTER="ap3"

# === 기타 ===

# Node 환경
NODE_ENV="development"

# 데모 환경 토글 (V1 기본 true)
NEXT_PUBLIC_DEMO_BANNER="true"
```

**왜 ENCRYPTION_KEY·ANONYMIZATION_SALT를 Week 0에 미리?**
Week 1 Day 1 Prisma 스키마에 `User.realName` (암호화)·`anonymizedId` (BLAKE2b) 컬럼이 포함됨. 키가 없으면 시드 데이터 생성 시 충돌. Week 0에 무작위 생성하여 `.env.local`에 저장 → 변경 금지 (변경 시 기존 데이터 복호화 불가).

---

## 4. 키 생성 명령 (로컬, Week 0 종료 전)

```bash
# 4개 키 한 번에 생성, 출력 확인 후 .env.local에 복사
echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\""
echo "ENCRYPTION_KEY=\"$(openssl rand -base64 32)\""
echo "ANONYMIZATION_SALT=\"$(openssl rand -base64 32)\""
```

PowerShell (Windows):
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
# 세 번 실행하여 NEXTAUTH_SECRET / ENCRYPTION_KEY / ANONYMIZATION_SALT 각각 채움
```

---

## 5. Week 0 종료 시 검증 체크리스트

- [ ] GitHub repo 접근 가능
- [ ] Vercel project가 GitHub repo 연동됨 (빌드는 실패해도 OK, 환경변수 미설정)
- [ ] `psql "$DATABASE_URL" -c "SELECT 1;"` 통과
- [ ] Anthropic API curl 호출 200 응답
- [ ] `.env.local`에 모든 변수 채워짐 (4개 서비스 + 3개 로컬 생성)
- [ ] `.env.local`이 `.gitignore`에 포함됨 (커밋되지 않음)
- [ ] secretlint pre-commit 훅 활성 (`pnpm exec husky` 후 `.husky/pre-commit` 존재 확인)
- [ ] Vercel Settings → Environment Variables에 모든 키 등록됨 (다른 머신에서 `vercel env pull`로 복원 가능)

위 8개가 통과하면 **Week 1 Day 1 시작 준비 완료**.

### 5.1 Pre-commit secret 차단 활성화 (한 번만)

```powershell
pnpm install              # husky devDep 포함됨
pnpm exec husky           # .husky/ 초기화 (이미 있으면 skip)
git config core.hooksPath .husky
```

검증: 일부러 비밀 패턴이 든 파일 만들고 add → commit 시도하면 secretlint가 차단.
```powershell
"DATABASE_URL=postgresql://u:realpass@host/db" | Out-File test-leak.txt
git add test-leak.txt
git commit -m "test"
# → secretlint 가 차단해야 함
Remove-Item test-leak.txt
git restore --staged test-leak.txt
```

---

## 6. 트러블슈팅

### Vercel 빌드 실패
- 환경변수 미설정 단계에서는 정상. Week 0 마지막에 Vercel Settings → Environment Variables에서 `.env.local`의 모든 키를 등록한 후 Redeploy.

### Neon 연결 실패
- Free tier는 5분 idle 후 suspend됨. 첫 쿼리에서 1~2초 지연 정상.
- IP 화이트리스트 없음 (Free tier 기본 0.0.0.0/0).
- Pool size 초과 시 `prepared statement does not exist` 에러 발생 가능 → `?pgbouncer=true&connect_timeout=15`가 connection string에 포함되었는지 확인.

### Anthropic 401
- API key가 정확히 복사되었는지 (앞뒤 공백·줄바꿈 주의).
- workspace의 spend limit이 0으로 설정되어 있지 않은지.

### `.env.local`이 git에 들어감
즉시:
```bash
git rm --cached .env.local
git commit -m "remove .env.local from tracking"
# 이미 push 했다면 키 모두 재발급 + 새 push 필요 (이전 커밋 히스토리는 영구적)
```

---

## 7. 다른 컴퓨팅 환경에서 이어가기

핵심 원칙: **Vercel을 환경변수 단일 출처(source of truth)로 두고 Vercel CLI로 끌어오기**. USB·메신저·이메일로 비밀 전송 금지.

### 7.1 새 머신 셋업 (한 번)

```powershell
# Vercel CLI 전역 설치
npm i -g vercel

# 브라우저 SSO 로그인 (한 번만, 머신별)
vercel login

# repo 클론 + 의존성
git clone https://github.com/{user}/mindbridge.git
cd mindbridge
pnpm install

# Vercel 프로젝트와 로컬 디렉토리 링크
vercel link
# 프롬프트:
#   - Set up project? Y
#   - Scope: 본인 계정 선택
#   - Link to existing project? Y → mindbridge 선택
# 결과: .vercel/ 폴더 생성 (gitignore 됨)
```

### 7.2 환경변수 동기화 (매 변경 시)

```powershell
# Vercel 에 등록된 env vars 를 .env.local 로 다운로드
vercel env pull .env.local --environment=development
```

- `vercel env pull` 한 줄로 모든 환경변수 자동 복원
- 1번 머신에서 Vercel Settings 에 새 키를 추가했다면 2번 머신은 `vercel env pull` 만 다시 실행하면 동기화

### 7.3 핵심 전제·주의

- **첫 머신에서 Vercel Settings → Environment Variables 등록 완료가 선행**되어 있어야 함. 그게 단일 출처
- `ENCRYPTION_KEY`와 `ANONYMIZATION_SALT`는 머신 간 **반드시 동일** — 다르면 기존 암호화 데이터·익명 ID 매칭 불가
- `NEXTAUTH_URL`은 환경별로 다름:
  - Production: `https://mindbridge-*.vercel.app`
  - Preview: Vercel 자동 부여 URL
  - Development: `http://localhost:3000`
  - → `vercel env pull --environment=development`로 끌면 dev 값으로 채워짐
- 같은 GitHub 계정으로 Vercel 로그인. 다른 계정이면 Vercel Project Settings → Members에서 초대 후 사용

### 7.4 비추천 방법

- ❌ **USB·메신저로 `.env.local` 전송** — 분실 시 즉시 노출, 메신저 서비스 로그에 영구 보존됨
- ❌ **GitHub Secret + Action으로 키 가져오기** — 1인 개발 오버킬, 자동화 가치 낮음
- ❌ **공유 비밀번호 매니저 entry로 키 한 줄씩 복붙** — 키 7개라 손 실수 + 매번 복원 시간 큼
