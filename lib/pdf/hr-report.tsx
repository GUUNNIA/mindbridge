/**
 * HR 월간 리포트 PDF 레이아웃 (Day 24).
 *
 * @react-pdf/renderer 의 JSX-style API. server 측 buffer 생성 후 route handler 가 응답.
 *
 * 익명성 가드:
 *   - 모든 셀에 마스킹 라벨 ("<5명") 적용
 *   - 부서별 표는 부서 인원·이용자 수만 (개인 식별 0건)
 *   - 인사이트 텍스트는 generateHRInsight 가 사전 검증한 결과만 사용
 *
 * 한글 폰트: 시스템 기본 폰트는 한글이 깨질 수 있어 Pretendard 등록 시도.
 *   V1 은 CDN 우회 없이 system fallback. 한글이 안 보이면 V2 에서 폰트 패키지 추가.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import * as React from "react";

import type { DashboardData, KMasked } from "@/lib/hr/aggregate";
import type { HRInsightResult } from "@/lib/ai/insight";

// Pretendard 한글 폰트 등록 (jsDelivr CDN).
// V1 best-effort — 등록 실패 시 system fallback (한글 깨짐 가능).
try {
  Font.register({
    family: "Pretendard",
    fonts: [
      {
        src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf",
        fontWeight: 700,
      },
    ],
  });
  // 한글 자동 줄바꿈을 위해 hyphenation 비활성
  Font.registerHyphenationCallback((word: string) => [word]);
} catch {
  // ignore — fallback to system
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Pretendard",
    fontSize: 10,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#0d9488",
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
    color: "#0d9488",
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
  },
  meta: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "#0f172a",
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#0f172a",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  kpiCard: {
    flex: 1,
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
  },
  kpiLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
  },
  bulletList: {
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletMarker: {
    width: 10,
    fontSize: 10,
    color: "#0d9488",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
  },
  table: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    fontWeight: 700,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    paddingHorizontal: 4,
  },
  tableCellRight: {
    flex: 1,
    fontSize: 9,
    paddingHorizontal: 4,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
});

function renderCell(cell: KMasked, unit: string): string {
  if (cell.masked) return "<5명";
  return `${cell.value}${unit}`;
}

const SEVERITY_LABEL: Record<string, string> = {
  NONE: "없음",
  MILD: "경미",
  MODERATE: "중등도",
  MODERATELY_SEVERE: "중증",
  SEVERE: "심각",
};

export interface HRReportPdfProps {
  data: DashboardData;
  insight: HRInsightResult;
  companyName: string;
  periodLabel: string;
  generatedAtLabel: string;
}

export function HRReportPdf({
  data,
  insight,
  companyName,
  periodLabel,
  generatedAtLabel,
}: HRReportPdfProps) {
  return (
    <Document title={`MindBridge HR 리포트 — ${companyName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>MindBridge HR 월간 리포트</Text>
          <Text style={styles.subtitle}>{companyName} · 익명 집계 (k≥5 마스킹)</Text>
          <Text style={styles.meta}>
            기간: {periodLabel} · 생성: {generatedAtLabel}
          </Text>
        </View>

        {/* KPI 4종 */}
        <View style={styles.section}>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>이용 직원</Text>
              <Text style={styles.kpiValue}>
                {renderCell(data.activeAssessmentUsers, "명")}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>자가진단 응답</Text>
              <Text style={styles.kpiValue}>
                {renderCell(data.assessmentCount, "회")}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>번아웃 비율</Text>
              <Text style={styles.kpiValue}>
                {data.burnoutRatePercent.masked
                  ? "<5명"
                  : `${data.burnoutRatePercent.value}%`}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>통계 동의자</Text>
              <Text style={styles.kpiValue}>
                {data.statisticsConsenters}명
              </Text>
            </View>
          </View>
        </View>

        {/* 인사이트 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>핵심 인사이트</Text>
          <Text style={styles.paragraph}>{insight.insightParagraph}</Text>
        </View>

        {/* Key Takeaways */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Takeaways</Text>
          <View style={styles.bulletList}>
            {insight.keyTakeaways.map((t, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bulletMarker}>{i + 1}.</Text>
                <Text style={styles.bulletText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recommended Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Actions</Text>
          <View style={styles.bulletList}>
            {insight.recommendedActions.map((a, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bulletMarker}>{i + 1}.</Text>
                <Text style={styles.bulletText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 카테고리 표 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카테고리 분포</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>카테고리</Text>
              <Text style={styles.tableCellRight}>응답 수</Text>
            </View>
            {data.categoryDistribution.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>—</Text>
                <Text style={styles.tableCellRight}>데이터 없음</Text>
              </View>
            ) : (
              data.categoryDistribution.map((c) => (
                <View key={c.slug} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{c.name}</Text>
                  <Text style={styles.tableCellRight}>{renderCell(c.count, "회")}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 부서별 표 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>부서별 이용</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>부서</Text>
              <Text style={styles.tableCellRight}>인원</Text>
              <Text style={styles.tableCellRight}>이용 직원</Text>
            </View>
            {data.byDepartment.map((d) => (
              <View key={d.departmentId} style={styles.tableRow}>
                <Text style={styles.tableCell}>{d.name}</Text>
                <Text style={styles.tableCellRight}>{d.headcount}명</Text>
                <Text style={styles.tableCellRight}>
                  {renderCell(d.activeAssessmentUsers, "명")}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 심각도 표 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>심각도 분포 (PHQ-9/GAD-7 기준)</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>심각도</Text>
              <Text style={styles.tableCellRight}>응답 수</Text>
            </View>
            {data.severityDistribution.map((s) => (
              <View key={s.severity} style={styles.tableRow}>
                <Text style={styles.tableCell}>
                  {SEVERITY_LABEL[s.severity] ?? s.severity}
                </Text>
                <Text style={styles.tableCellRight}>{renderCell(s.count, "회")}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          이 리포트는 k≥5 익명성 가드와 STATISTICS 동의자 모집단 기준으로 생성되었습니다.
          개인 식별 정보는 포함되어 있지 않습니다.
        </Text>
      </Page>
    </Document>
  );
}
