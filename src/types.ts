export enum Category {
  PARTNERSHIP = "제휴",
  CARD = "카드사",
  TELECOM = "통신사",
  ECOUPON = "E쿠폰",
  DELIVERY = "딜리버리",
}

export interface Promotion {
  id: string;
  brand: string; // "파리바게뜨", "뚜레쥬르", "투썸플레이스", "스타벅스" 등
  category: Category;
  title: string;
  summary: string; // AI가 요약한 핵심 한 줄 요약
  description: string; // 상세 조건 및 혜택 내역
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  discountType: "할인" | "적립" | "증정" | "페이백" | "기타";
  benefitValue: string; // e.g. "50%", "3,000원", "1+1"
  benefitIntensity: number; // 혜택 강도 (수치화된 비교 지수: 1 ~ 100)
  channel: string; // 수집 채널 이름
  isNew?: boolean; // 신규 브랜드 프로모션 표시 (New 마크)
  sourceUrl?: string; // 출처 원본 링크
  createdAt: string; // 데이터 등록/수집 일자
  actionStatus?: "대기" | "검토중" | "대응기획" | "완료"; // 대응 전술 워크플로우 상태
  countermeasure?: string; // 맞불 기획 세부 대응 전략 기록
}

export interface BrandConfig {
  id: string;
  name: string;
  isCompetitor: boolean;
  homepageUrl: string;
  eventUrl: string;
}

export interface AlertSetting {
  id: string;
  email: string;
  slackWebhook: string;
  minDiscountThreshold: number; // 이 할인율 이상일 때 즉각 경보 발송 (예: 50%)
  enabled: boolean;
}

export interface MonitoringChannel {
  id: string;
  name: string;
  type: "official" | "delivery" | "telecom" | "card" | "ecoupon";
  url: string;
  description: string;
  enabled: boolean;
}
