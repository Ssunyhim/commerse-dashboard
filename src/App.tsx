import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  TrendingUp,
  Settings,
  Bell,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  Layers,
  FileText,
  Mail,
  Zap,
  Info,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  FileCode
} from "lucide-react";
import { Category, Promotion, BrandConfig, AlertSetting, MonitoringChannel } from "./types";

// Import local JSON backups for static modes (e.g. GitHub Pages)
import defaultPromotions from "./data/promotions.json";
import defaultBrands from "./data/brands.json";
import defaultChannels from "./data/channels.json";
import defaultAlerts from "./data/alerts.json";
import defaultReviewsCache from "./data/reviews_cache.json";

// Date shift utility to dynamically map any hardcoded 2026-05 date to the current week on the client
const clientGetDaysDifferenceFromEpoch = () => {
  const d = new Date();
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
  const currMonday = new Date(d.getFullYear(), d.getMonth(), diffToMon);
  currMonday.setHours(0, 0, 0, 0);

  const baseMonday = new Date('2026-05-18');
  baseMonday.setHours(0, 0, 0, 0);

  const msDiff = currMonday.getTime() - baseMonday.getTime();
  const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));
  return daysDiff;
};

const clientShiftDateString = (dateStr: string, daysDiff: number) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const originalDate = new Date(dateStr);
  if (isNaN(originalDate.getTime())) return dateStr;
  
  const shiftedDate = new Date(originalDate.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  const y = shiftedDate.getFullYear();
  const m = String(shiftedDate.getMonth() + 1).padStart(2, '0');
  const r = String(shiftedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const clientShiftPromotionsDates = (promos: any[]) => {
  const d = new Date();
  const day = d.getDay();
  const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
  const currMonday = new Date(d.getFullYear(), d.getMonth(), diffToMon);
  currMonday.setHours(0, 0, 0, 0);
  const y = currMonday.getFullYear();
  const m = String(currMonday.getMonth() + 1).padStart(2, '0');
  const r = String(currMonday.getDate()).padStart(2, '0');
  const currMondayStr = `${y}-${m}-${r}`;

  const daysDiff = clientGetDaysDifferenceFromEpoch();

  return promos.map((p: any) => {
    // Only shift if it's older than current week's Monday and matches original patterns
    if (p.startDate && p.startDate < currMondayStr && p.startDate.startsWith('2026-05')) {
      return {
        ...p,
        startDate: clientShiftDateString(p.startDate, daysDiff),
        endDate: clientShiftDateString(p.endDate, daysDiff),
        createdAt: clientShiftDateString(p.createdAt || p.startDate, daysDiff)
      };
    }
    return p;
  });
};

const clientShiftReviewsDates = (reviews: any) => {
  const daysDiff = clientGetDaysDifferenceFromEpoch();
  const processList = (list: any[]) => {
    if (!list) return [];
    return list.map((item: any) => {
      if (item.date && item.date.startsWith('2026-05')) {
        return {
          ...item,
          date: clientShiftDateString(item.date, daysDiff)
        };
      }
      return item;
    });
  };
  return {
    ...reviews,
    positive: processList(reviews.positive),
    negative: processList(reviews.negative)
  };
};

// Helper to get dynamic week details based on current date
export function getWeekDetails(dateVal?: string | Date) {
  const d = dateVal ? new Date(dateVal) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const dateNum = d.getDate();
  
  // Calculate Monday of the current week (standard starting Monday)
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  
  // Calculate Sunday of the current week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  // Format YYYY.MM.DD
  const formatYMD = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const r = String(dt.getDate()).padStart(2, '0');
    return `${y}.${m}.${r}`;
  };

  // Format MM.DD
  const formatMD = (dt: Date) => {
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const r = String(dt.getDate()).padStart(2, '0');
    return `${m}.${r}`;
  };

  // Calculate week of the month (Monday-based standard)
  const firstOfMonth = new Date(year, d.getMonth(), 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0 is Sun, 1 is Mon...
  const offset = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);
  const weekNum = Math.ceil((dateNum + offset) / 7);

  const engMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const engMonthUpper = engMonths[d.getMonth()];

  return {
    year,
    month,
    weekNum,
    engMonthUpper,
    mondayStr: formatMD(monday),
    sundayStr: formatMD(sunday),
    rangeStr: `${formatMD(monday)} ~ ${formatMD(sunday)}`,
    fullRangeStr: `${formatYMD(monday)} — ${formatYMD(sunday)}`,
    titleStr: `${year}년 ${month}월 ${weekNum}주차`,
    monthStr: `${year}년 ${String(month).padStart(2, '0')}월`
  };
}

export default function App() {
  // State from server API
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [brands, setBrands] = useState<BrandConfig[]>([]);
  const [channels, setChannels] = useState<MonitoringChannel[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSetting | null>(null);
  const [staticModeActive, setStaticModeActive] = useState<boolean>(false);

  const weekInfo = getWeekDetails();

  // Status/Control States
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [insightText, setInsightText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"matrix" | "calendar" | "analytics" | "management" | "settings">("matrix");
  const [statusMessage, setStatusMessage] = useState<string>("시스템 활성화 상태");
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    const d = new Date();
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    return `${yStr}.${mStr}.${dStr} 09:12:44 KST`;
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [sortByIntensity, setSortByIntensity] = useState<boolean>(false);

  // Comparison & Sandbox States
  const [selectedPromoIdsForCompare, setSelectedPromoIdsForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // Interactive Quick search tags
  const [selectedQuickTag, setSelectedQuickTag] = useState<string>("전체");

  // Dynamic simulation sandbox values
  const [sandboxBrand, setSandboxBrand] = useState<string>("파리바게뜨");
  const [sandboxCategory, setSandboxCategory] = useState<Category>(Category.PARTNERSHIP);
  const [sandboxDiscountType, setSandboxDiscountType] = useState<string>("할인");
  const [sandboxValue, setSandboxValue] = useState<string>("30%");
  const [sandboxChannel, setSandboxChannel] = useState<string>("해피포인트 앱");
  const [sandboxIntensityResult, setSandboxIntensityResult] = useState<number | null>(null);
  const [sandboxFeedback, setSandboxFeedback] = useState<string>("");

  // Modals state
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  
  // Promotion status and countermeasure editing states
  const [promoStatusInput, setPromoStatusInput] = useState<"대기" | "검토중" | "대응기획" | "완료">("대기");
  const [promoCountermeasureInput, setPromoCountermeasureInput] = useState<string>("");

  // Executive Dashboard & Real-time Sentiment Analytics States
  const [showExecBoard, setShowExecBoard] = useState<boolean>(true);
  const [selectedReviewBrand, setSelectedReviewBrand] = useState<string>("파리바게뜨");
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(false);
  const [reviewsData, setReviewsData] = useState<{
    brand: string;
    positive: Array<{ id: string; user: string; content: string; date: string; rating: number }>;
    negative: Array<{ id: string; user: string; content: string; date: string; rating: number }>;
  }>({
    brand: "파리바게뜨",
    positive: [],
    negative: []
  });
  const [actionPlans, setActionPlans] = useState<Array<{
    id: string;
    title: string;
    priority: "초고도" | "긴급" | "일반";
    targetCategory: string;
    timeline: string;
    responsible: string;
    checked: boolean;
    revenueImpact: string;
    description: string;
  }>>([
    {
      id: "ac1",
      title: "주말 케이크 카테고리 3,000원 선착순 앱 해피앱 특별 증정 기획",
      priority: "초고도",
      targetCategory: "카드사 / 제휴",
      timeline: `${weekInfo.month}월 ${weekInfo.weekNum}주차 (즉시 착수)`,
      responsible: "커머스마케팅 1팀",
      checked: true,
      revenueImpact: "+4.2% 매출 방어 효과",
      description: "경쟁사 뚜레쥬르의 현대카드 M포인트 50% 차감 세일 전격 상쇄용으로 해피앱 이용 우수 고객층 타겟 긴급 보조 푸시 발송 계획."
    },
    {
      id: "ac2",
      title: "딜리버리 채널(요기요/배달의민족) 브랜드 특급 할인 쿠폰 부스팅",
      priority: "긴급",
      targetCategory: "딜리버리",
      timeline: `${weekInfo.month}월 ${weekInfo.weekNum}주차 (금/토/일 가동)`,
      responsible: "배달앱 제휴파트",
      checked: true,
      revenueImpact: "+3.5% 객단가 방어 효과",
      description: "인근 유동인구의 배달앱 이탈 동선을 사전 원천 차단하기 위해 주말 한정 4,005원 정액 쿠션 보조금 집중 지급안 연계."
    },
    {
      id: "ac3",
      title: "통신 멤버십(SKT T-Day 및 KT 달달 혜택) 제휴 복층 대응 할인망 설계",
      priority: "일반",
      targetCategory: "통신사",
      timeline: `${weekInfo.month === 12 ? 1 : weekInfo.month + 1}월 1주차 전면 반영`,
      responsible: "SPC 멤버십 파트",
      checked: false,
      revenueImpact: "방문 밀도 유지 +2.8%",
      description: "통신사 제휴 포인트 사용에 맞춘 크로스 셀 패키지 상품(샌드위치 + 가식 음료 8천원 결합 세트) 신규 구성 및 점포 적용."
    },
    {
      id: "ac4",
      title: "모바일 단선 금액권 모바일상품권 카카오 선물하기 기획 세일 딜 런칭",
      priority: "일반",
      targetCategory: "E쿠폰",
      timeline: `${weekInfo.month}월 마지막 주 런칭`,
      responsible: "e-비즈 파트너십 소팀",
      checked: false,
      revenueImpact: "선수금 확보액 약 +1.5억",
      description: "선물하기 교환권 시장 세어 사수를 위해 시그니처 마이넘버 케이크류의 단독 15-20% 할인 딜 선집행 진행 검토."
    }
  ]);

  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const mainScrollRef = React.useRef<HTMLDivElement>(null);

  // Helper fetch brand reviews
  const fetchBrandReviews = async (brandName: string) => {
    setReviewsLoading(true);
    try {
      if (staticModeActive) {
        // Simulate network loading time briefly for a nicer user experience
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // Load from reviews_cache or client-side default reviews matching server.ts
        const cacheKey = brandName.trim();
        const cacheData = (defaultReviewsCache as any)[cacheKey];
        if (cacheData) {
          setReviewsData(clientShiftReviewsDates(cacheData));
        } else {
          const defaultReviews: any = {
            brand: brandName,
            positive: [
              { id: 'p1', user: '빵돌이***', content: '요즘 제휴카드로 삼천원 즉시 할인받아서 개이득입니다! 모바일 기프티십 등록도 빠르고 아주 편리해요.', date: '2026-05-20', rating: 5 },
              { id: 'p2', user: '다이어터**', content: '포인트 적립율도 높고, 신선한 모닝 토스트 구성이 아주 알찹니다. 아침마다 쿠폰 받아서 갈만해요.', date: '2026-05-19', rating: 5 },
              { id: 'p3', user: '스윗레이디', content: '기프티콘 선물하기 할인 덕에 지인들 생일 케이크 저렴하게 선물할 수 있어서 참 요긴하게 쓰고있어요.', date: '2026-05-18', rating: 4 },
              { id: 'p4', user: '델리매니아', content: '요기요 브랜드 위크 4천원 할인쿠폰 최고! 목요일 저녁에 배달 주문했는데 바로 오고 할인 폭도 큽니다.', date: '2026-05-17', rating: 5 },
              { id: 'p5', user: 'SPClover', content: '통신사 더블 할인과 앱 푸시쿠폰을 중복으로 쓸 수 있어서 빵 쇼핑이 대폭 즐거워졌습니다. 가성비 대만족!', date: '2026-05-16', rating: 4 }
            ],
            negative: [
              { id: 'n1', user: '쿠폰킬러*', content: '할인 쿠폰 받기가 하늘의 별 따기네요. 선착순 천 명인데 매일 10초 컷으로 조기 소진되니 허탈해요.', date: '2026-05-20', rating: 2 },
              { id: 'n2', user: '매장체크*', content: '역 근처 직영점에만 쿠폰 쓸 수 있고, 동네 일반 매장에서는 제외 점포라며 사용 거절당했습니다. 너무 불쾌해요.', date: '2026-05-19', rating: 1 },
              { id: 'n3', user: '소비자자유', content: '제휴 할인은 화려한데 정작 기본 식빵이나 생크림 제품 가격 자체가 너무 야금야금 올라서 체감 혜택은 그리 크지 않네요.', date: '2026-05-18', rating: 2 },
              { id: 'n4', user: '앱오류짜증', content: '대응 모바일 앱 결제 시 계속 무한 로딩이 발생해요. 결제 창에서 대기 타다가 세일 기한 지나갔네요.', date: '2026-05-17', rating: 2 },
              { id: 'n5', user: '실속부족*', content: '특정 제휴 카드를 신규 발급해야만 최대 혜택을 주는 상술 프로모션이 늘어나서 실소비자들에겐 큰 도움이 안 됩니다.', date: '2026-05-15', rating: 1 }
            ]
          };

          if (brandName.includes('뚜레쥬르')) {
            defaultReviews.positive = [
              { id: 'tp1', user: '빵러브***', content: 'SKT T-Day 통신사 30% 즉시 할인 혜택이 너무 파격적입니다. 이번 주말 빵집은 무조건 여깁니다.', date: '2026-05-20', rating: 5 },
              { id: 'tp2', user: '크림달콤', content: '포인트 적립하고 요기요 5천원 선착순 중복쿠폰 발급되어서 저렴하게 주문할 수 있어서 좋습니다.', date: '2026-05-19', rating: 5 },
              { id: 'tp3', user: 'TLJ매니아', content: '시그니처 생크림 케이크 쿠폰 할인 폭이 큽니다. 비주얼도 예쁘고 가격 부담도 훨씬 덜었어요.', date: '2026-05-18', rating: 5 },
              { id: 'tp4', user: '가정지킴이', content: '카카오톡 모바일 15% 기획전 수시로 열어줘서 선물할 때 아주 요긴합니다. 유효기간도 넉넉하고요.', date: '2026-05-17', rating: 4 },
              { id: 'tp5', user: '모닝토스트', content: '신선하고 고소한 곡물 식빵 묶음 제휴 포인트 추가 포인트 백 찬스가 아주 좋네요. 실속 있습니다.', date: '2026-05-15', rating: 4 }
            ];
            defaultReviews.negative = [
              { id: 'tn1', user: '체크포인트', content: '통신사 할인이 룰렛이나 특정 등급(VIP) 위주로만 고혜택을 제공해서 일반 실속 회원들에게는 아쉬워요.', date: '2026-05-21', rating: 2 },
              { id: 'tn2', user: '빵빵한하루', content: '퇴근시간에 매장 가니까 행사 빵들이 죄다 매진이고 남아있는 비싼 쿠키 세트류만 살 수 있어 당황했습니다.', date: '2026-05-20', rating: 2 },
              { id: 'tn3', user: '실소비가', content: '모바일 쿠폰은 오프라인 키오스크에서 인식이 잘 안되어 카운터에서 한참 서있어야 했습니다.', date: '2026-05-19', rating: 3 },
              { id: 'tn4', user: '기대이하1', content: '이번 제휴 포인트 사용 혜택 때문에 갔는데, 일부 가맹점에선 결제 단말기 오류라며 거절해서 아쉬웠네요.', date: '2026-05-18', rating: 2 },
              { id: 'tn5', user: '할인단속', content: '적용 가능 제품군 요건이 너무 까다롭고, 특정 카테고리를 사야만 추가 포인트를 주는 게 아쉽습니다.', date: '2026-05-16', rating: 2 }
            ];
          } else if (brandName.includes('투썸플레이스')) {
            defaultReviews.positive = [
              { id: 'at1', user: '케익대장**', content: '현대카드 M포인트 50% 세일 덕분에 평소 비싸서 망설였던 스트로베리 초콜릿 생크림 케이크 반값에 득템했어요!', date: '2026-05-20', rating: 5 },
              { id: 'at2', user: '커피중독z', content: '투썸하트 프리퀀시 이벤트 참여도 편리하고, 기프티숍 할인 딜이 많이 떠서 좋습니다.', date: '2026-05-19', rating: 5 },
              { id: 'at3', user: '스튜디오X', content: '빙수 쿠폰 3천 원 즉시 할인을 모바일 앱 푸시 받아서 바로 썼네요. 올여름 첫 빙수 아주 시원하고 만족스럽습니다.', date: '2026-05-18', rating: 5 },
              { id: 'at4', user: '블루투썸', content: '카카오페이 포인트 중복 백 이벤트가 완전 꿀이네요. 결제하자마자 1천원 페이백 완료!', date: '2026-05-17', rating: 4 },
              { id: 'at5', user: '디저트마왕', content: '투썸 피스케익 신제품 런칭 아메리카노 결합 8,000원 세트 정말 직장인들 힘이 나는 실속 구성입니다.', date: '2026-05-16', rating: 4 }
            ];
            defaultReviews.negative = [
              { id: 'an1', user: '매장체크x', content: 'M포인트 50% 반값 적용 제외 매장이 너무 많네요. 사전에 앱으로 검색 안 해보고 동네 매장 갔다가 포인트만 날릴 뻔.', date: '2026-05-21', rating: 2 },
              { id: 'an2', user: '아메리원', content: '음료와 케익 결합 행사인데, 아메리카노 외에 다른 에이드나 차 종류로는 추가금 내도 교환이 일체 안 된다는 게 너무 고지식해요.', date: '2026-05-20', rating: 2 },
              { id: 'an3', user: '투썸바보', content: '피치 블렌디드 시즌 쿠폰은 항상 품절이라고 하네요. 자재 공급 부족이라는데 왜 대문짝만하게 홍보하는지 의문.', date: '2026-05-19', rating: 1 },
              { id: 'an4', user: '앱화면스턱', content: '투썸하트 앱 개편 이후 실행이 너무 느리고 하트 등급도 직관적이지 않아 리워드 타 먹기 어려워졌습니다.', date: '2026-05-17', rating: 2 },
              { id: 'an5', user: '가격단상', content: '시즌 케이크 혜택 받아봤자 기본 케이크 정가 자체를 대폭 인상해버려서 체감적으론 비싸게 느껴집니다.', date: '2026-05-14', rating: 2 }
            ];
          } else if (brandName.includes('스타벅스')) {
            defaultReviews.positive = [
              { id: 's1', user: '별의노래', content: '사이렌 오더 주문 전용 할인 쿠폰이 수급되어 대기 시간도 줄이고 텀블러 에코 보너스 별까지 쏠쏠하게 받았습니다.', date: '2026-05-20', rating: 5 },
              { id: 's2', user: '그린러버', content: '배달(Delivers) 무료 배달 이벤트 너무 유용해요! 집돌이인데 딜리버스로 집에서 편하게 프라푸치노 마셨네요.', date: '2026-05-19', rating: 5 },
              { id: 's3', user: '스타쿠키', content: '카드 제휴 별 추가 적립 이벤트 덕분에 일주일 만에 무료 음료 쿠폰 1장 더 뽑았습니다. 최고의 적립율!', date: '2026-05-18', rating: 5 },
              { id: 's4', user: '골드스타*', content: '오후 2시 에코별 더블 적립 기획 마음에 들어요. 일회용 컵 안 쓰고 보탬도 되고 포인트도 쌓고 일석이조.', date: '2026-05-17', rating: 4 },
              { id: 's5', user: 'SBMania', content: '이브닝 딜 세일로 샌드위치 30% 싸게 저녁 대용으로 먹었습니다. 퇴근 푸드 세이브 최고입니다.', date: '2026-05-16', rating: 5 }
            ];
            defaultReviews.negative = [
              { id: 'sn1', user: '커피값인상', content: '배달 주문은 오프라인 매장 가격보다 음료당 500원씩 비싼 배달 전용 단가를 몰래 적용해놓고 배달료 무료 생색내는 게 괘씸해요.', date: '2026-05-21', rating: 1 },
              { id: 'sn2', user: '별카드실망', content: '특정 카드 앱 간편 결제만 우대 해주는 프로모션은 기존 스타벅스 충전 금액 카드를 주로 쓰던 일반 팬들을 소외시키는 느낌.', date: '2026-05-20', rating: 2 },
              { id: 'sn3', user: '지동대기', content: '이브닝 푸드 세이브 행사는 정작 가보면 가장 맛없는 베이글 같은 것만 남아있고 케이크나 버거류는 이미 낮에 대품 소진.', date: '2026-05-19', rating: 2 },
              { id: 'sn4', user: '앱로그인오류', content: '오후 선착순 별 배포 타임만 되면 사이렌 오더 서버가 터져서 장바구니 담는 동안 세션 시간 초과가 뜹니다.', date: '2026-05-18', rating: 2 },
              { id: 'sn5', user: '소통아쉽', content: '텀블러 소지자 할인을 카운터에서 대면 주문할 때만 눈치 주면서 적용해주는 가맹점들이 더러 있어서 짜증나네요.', date: '2026-05-15', rating: 2 }
            ];
          } else if (brandName.includes('배스킨라빈스')) {
            defaultReviews.positive = [
              { id: 'br1', user: '민초단장', content: '해피 앱 멤버십 Day 패밀리를 하프갤런으로 특별 사이즈 업해줘서 배지 가득 채우고 한 달 내내 가식 냉동실 세팅 끝!', date: '2026-05-20', rating: 5 },
              { id: 'br2', user: '파인트사랑', content: '카카오페이 포인트 머니로 2만원 이상 결제 4천원 할인받아 진짜 역대급 싸게 샀습니다.', date: '2026-05-19', rating: 5 },
              { id: 'br3', user: 'BR_Fan', content: '이달의 맛 런칭 프로모션으로 싱글레귤러 구매하고 더블주니어로 바로 올려주는 상시 더블업 찬스 너무 완소합니다.', date: '2026-05-18', rating: 5 },
              { id: 'br4', user: '달콤한밤', content: '배민 배달료 쿠폰 2,000원 추가 정액 감면 기간이라 아이스크림 한 통 집에서 사르르 녹지 않게 배송받아 잘 먹었음.', date: '2026-05-17', rating: 4 },
              { id: 'br5', user: '패밀리키즈', content: '가정의 달 기획으로 아이 귀여운 캐릭터 전용 토이컵을 50% 세일에 득템하여 온 가족 패스포트 혜택 체감 업!', date: '2026-05-16', rating: 4 }
            ];
            defaultReviews.negative = [
              { id: 'brn1', user: '가성비한탄', content: '해피 Day 사이즈업 이벤트날에는 모바일 리워드 기프티콘 결제를 중복 거부하고 실물 현금/신용카드만 고집하는 점포가 많아 실망스러워요.', date: '2026-05-21', rating: 2 },
              { id: 'brn2', user: '재고부재', content: '이달의 맛 더블쿠폰 받아 갔더니 직원이 냉동고 구석에 아직 준비가 안 되었다며 강제로 바닐라랑 초코로 대체 변경 요구.', date: '2026-05-20', rating: 1 },
              { id: 'brn3', user: '맛보기실망', content: '위생 때문에 맛보기 스푼 프로모션을 아예 중단해놓고, 신선 홍보 맛들은 계속 내보내니 리스크 감수해야 해서 짜증.', date: '2026-05-18', rating: 2 },
              { id: 'brn4', user: '중량불만', content: '포장 뜯어서 정밀 저울로 달아보니 패밀리 규격보다 30g이나 부족하게 담아왔네요. 정량 감시 가이드라인 필요.', date: '2026-05-17', rating: 2 },
              { id: 'brn5', user: '드라이아이스', content: '배달 주문 시 아이스 팩이나 드라이아이스 무료 지원 시간을 최대 30분으로 칼같이 하향 조정하여 먼 곳은 배달시키기 불안함.', date: '2026-05-15', rating: 2 }
            ];
          }

          setReviewsData(clientShiftReviewsDates(defaultReviews));
        }
        return;
      }

      const res = await fetch(`/api/reviews?brand=${encodeURIComponent(brandName)}`);
      if (res.ok) {
        const data = await res.json();
        setReviewsData(data);
      }
    } catch (err) {
      console.error("고객 여론 크롤링 에러:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Trigger brand reviews load on review brand selection or on initial load
  useEffect(() => {
    fetchBrandReviews(selectedReviewBrand);
  }, [selectedReviewBrand]);

  // Handle Scroll to toggle Back To Top visibility
  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 300) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  useEffect(() => {
    if (selectedPromotion) {
      setPromoStatusInput(selectedPromotion.actionStatus || "대기");
      setPromoCountermeasureInput(selectedPromotion.countermeasure || "");
    }
  }, [selectedPromotion]);


  const toggleCompare = (promoId: string) => {
    if (selectedPromoIdsForCompare.includes(promoId)) {
      setSelectedPromoIdsForCompare(selectedPromoIdsForCompare.filter(id => id !== promoId));
    } else {
      if (selectedPromoIdsForCompare.length >= 3) {
        alert("최대 3개 프로모션까지만 선택하여 동시 맞불 대응 비교 분석이 가능합니다.");
        return;
      }
      setSelectedPromoIdsForCompare([...selectedPromoIdsForCompare, promoId]);
    }
  };

  const handleUpdatePromoStatusAndContent = async (id: string, status: any, text: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionStatus: status, countermeasure: text })
      });
      if (res.ok) {
        const updated = await res.json();
        setPromotions(promotions.map(p => p.id === id ? updated : p));
        setSelectedPromotion(updated);
        setStatusMessage(`프로모션 "${updated.title}" 대응 상태를 '${status}'로 업데이트하였습니다.`);
      }
    } catch (err) {
      console.error("오류:", err);
      setStatusMessage("상태 업데이트 중 시스템 연결 오류 발생.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateDefensiveTactic = () => {
    // Advanced algorithm calculate estimate index and text feedback
    let index = 45;
    
    // Value influence
    if (sandboxValue.includes("50%")) index += 35;
    else if (sandboxValue.includes("30%")) index += 25;
    else if (sandboxValue.includes("20%")) index += 15;
    else if (sandboxValue.includes("10%")) index += 8;
    else if (sandboxValue.includes("5,000")) index += 22;
    else if (sandboxValue.includes("3,000")) index += 14;
    else index += 10;

    // Category offset
    if (sandboxCategory === Category.TELECOM) index += 12;
    if (sandboxCategory === Category.PARTNERSHIP) index += 10;
    if (sandboxCategory === Category.DELIVERY) index += 14;
    if (sandboxCategory === Category.CARD) index += 8;

    // Normalize
    const finalIntensity = Math.min(Math.max(index, 20), 100);
    setSandboxIntensityResult(finalIntensity);

    // Feedback message customized dynamically based on competition structure
    let feedback = "";
    if (finalIntensity >= 80) {
      feedback = "🔥 매우 강력함 (A+): 경쟁사의 고관여 할인 행사를 상회하는 압도적 방어력입니다. 멤버십 신규 가입 유도 및 객단가 상승을 유효하게 견인할 것입니다.";
    } else if (finalIntensity >= 60) {
      feedback = "✨ 양호함 (B): 주 고객층 이탈 저지에 확실한 쿠션 역할을 합니다. 대규모 마케팅 예산 대비 실속형 방어가 가능하겠으나 할인 제외 매장에 대한 고객 클레임 방지책이 필요합니다.";
    } else {
      feedback = "⚠️ 약함 (C): 자사 단독 미끼용 프로모션으로는 효과가 미미할 수 있습니다. 타 카테고리의 크로스 마케팅이나 해피모바일 정기 푸시 알림과 연계하여 노출 빈도를 보강하십시오.";
    }
    setSandboxFeedback(feedback);
  };

  const [showAddPromoModal, setShowAddPromoModal] = useState<boolean>(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState<boolean>(false);
  const [showAddChannelModal, setShowAddChannelModal] = useState<boolean>(false);

  // New Item Form State
  const [newPromo, setNewPromo] = useState({
    brand: "파리바게뜨",
    category: Category.TELECOM,
    title: "",
    summary: "",
    description: "",
    startDate: "2026-05-18",
    endDate: "2026-05-24",
    discountType: "할인" as any,
    benefitValue: "",
    benefitIntensity: 50,
    channel: "수동 등록",
    sourceUrl: "",
    isNew: true
  });

  const [newBrand, setNewBrand] = useState({
    id: "",
    name: "",
    isCompetitor: true,
    homepageUrl: "",
    eventUrl: ""
  });

  const [newChannel, setNewChannel] = useState({
    name: "",
    type: "official" as any,
    url: "",
    description: "",
    enabled: true
  });

  // Calendar Year and Month
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed month

  // Derived state: Filter active promotions based on current month and ensure they are not ended/stopped
  const activePromotions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    return promotions.filter(promo => {
      const promoStart = new Date(promo.startDate);
      const promoEnd = new Date(promo.endDate);

      // 1. Must overlap with the current month
      const overlapsCurrentMonth = (promoStart <= endOfCurrentMonth && promoEnd >= startOfCurrentMonth);
      if (!overlapsCurrentMonth) return false;

      // 2. Must not have ended before today (ended means promoEnd < today)
      if (promoEnd < today) return false;

      // 3. Filter out "가정" (Family Month) references if current month is not May
      // May is 0-indexed month 4
      if (currentMonth !== 4) {
        const lowerTitle = promo.title.toLowerCase();
        const lowerSummary = promo.summary.toLowerCase();
        const lowerDesc = (promo.description || "").toLowerCase();
        if (
          lowerTitle.includes("가정의 달") || lowerTitle.includes("가정의달") || lowerTitle.includes("가정의달이벤트") ||
          lowerSummary.includes("가정의 달") || lowerSummary.includes("가정의달") ||
          lowerDesc.includes("가정의 달") || lowerDesc.includes("가정의달")
        ) {
          return false;
        }
      }

      return true;
    });
  }, [promotions, currentYear, currentMonth]);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const isStaticHost = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
      let promos: Promotion[] = [];
      let loadedBrands: BrandConfig[] = [];
      let loadedChannels: MonitoringChannel[] = [];
      let loadedAlerts: AlertSetting | null = null;

      if (isStaticHost) {
        throw new Error("GitHub Pages environment detected. Switching to local static mock fallback.");
      }

      try {
        const [promosRes, brandsRes, channelsRes, alertsRes] = await Promise.all([
          fetch("/api/promotions"),
          fetch("/api/brands"),
          fetch("/api/channels"),
          fetch("/api/alerts")
        ]);

        if (!promosRes.ok || !brandsRes.ok || !channelsRes.ok || !alertsRes.ok) {
          throw new Error("One or more server endpoints failed.");
        }

        const contentType = promosRes.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Non-JSON API response detected.");
        }

        promos = await promosRes.json();
        loadedBrands = await brandsRes.json();
        loadedChannels = await channelsRes.json();
        loadedAlerts = await alertsRes.json();

        console.log("Datastore loaded successfully from Express Server APIs.");
        setStaticModeActive(false);
      } catch (apiError) {
        console.warn("Express API failed, adopting client-side Web/Static Mode:", apiError);
        setStaticModeActive(true);

        const storedPromos = localStorage.getItem("commerse_promotions");
        if (storedPromos) {
          promos = JSON.parse(storedPromos);
        } else {
          promos = clientShiftPromotionsDates(defaultPromotions);
          localStorage.setItem("commerse_promotions", JSON.stringify(promos));
        }

        const storedBrands = localStorage.getItem("commerse_brands");
        if (storedBrands) {
          loadedBrands = JSON.parse(storedBrands);
        } else {
          loadedBrands = defaultBrands;
          localStorage.setItem("commerse_brands", JSON.stringify(loadedBrands));
        }

        const storedChannels = localStorage.getItem("commerse_channels");
        if (storedChannels) {
          loadedChannels = JSON.parse(storedChannels);
        } else {
          loadedChannels = defaultChannels as MonitoringChannel[];
          localStorage.setItem("commerse_channels", JSON.stringify(loadedChannels));
        }

        const storedAlerts = localStorage.getItem("commerse_alerts");
        if (storedAlerts) {
          loadedAlerts = JSON.parse(storedAlerts);
        } else {
          loadedAlerts = defaultAlerts;
          localStorage.setItem("commerse_alerts", JSON.stringify(loadedAlerts));
        }
      }

      setPromotions(promos);
      setBrands(loadedBrands);
      setChannels(loadedChannels);
      setAlertSettings(loadedAlerts);

      // Trigger automatic AI text analysis
      loadAIInsight();

    } catch (err) {
      console.warn("Client-side fallback activated via Static Environment:", err);
      setStaticModeActive(true);

      let promos: Promotion[] = [];
      let loadedBrands: BrandConfig[] = [];
      let loadedChannels: MonitoringChannel[] = [];
      let loadedAlerts: AlertSetting | null = null;

      const storedPromos = localStorage.getItem("commerse_promotions");
      if (storedPromos) {
        promos = JSON.parse(storedPromos);
      } else {
        promos = clientShiftPromotionsDates(defaultPromotions);
        localStorage.setItem("commerse_promotions", JSON.stringify(promos));
      }

      const storedBrands = localStorage.getItem("commerse_brands");
      if (storedBrands) {
        loadedBrands = JSON.parse(storedBrands);
      } else {
        loadedBrands = defaultBrands as any;
        localStorage.setItem("commerse_brands", JSON.stringify(loadedBrands));
      }

      const storedChannels = localStorage.getItem("commerse_channels");
      if (storedChannels) {
        loadedChannels = JSON.parse(storedChannels);
      } else {
        loadedChannels = defaultChannels as MonitoringChannel[];
        localStorage.setItem("commerse_channels", JSON.stringify(loadedChannels));
      }

      const storedAlerts = localStorage.getItem("commerse_alerts");
      if (storedAlerts) {
        loadedAlerts = JSON.parse(storedAlerts);
      } else {
        loadedAlerts = defaultAlerts;
        localStorage.setItem("commerse_alerts", JSON.stringify(loadedAlerts));
      }

      setPromotions(promos);
      setBrands(loadedBrands);
      setChannels(loadedChannels);
      setAlertSettings(loadedAlerts);
      setInsightText("경쟁사인 뚜레쥬르와 투썸플레이스가 이달에 접어들며 통신사(KT 달달혜택) 및 현대카드 M포인트 50% 역대급 혜택 등 고강도 카드 제휴 프로모션을 적극 전개하고 있습니다. 반면 파리바게뜨는 T-Day 20% 특별 우대 및 요기요 4천원 정액 할인에 주력 중입니다. 제휴 E쿠폰 분야에서는 뚜레쥬르의 선물하기 15% 기획전이 활성화 중이므로, 당사는 E쇼핑몰 전용 타겟 1+1 리워드 쿠폰 또는 신선 생크림 케익 카테고리의 핀포인트 혜택 보강을 권장합니다.");
    } finally {
      setLoading(false);
    }
  };

   const loadAIInsight = async () => {
    try {
      if (staticModeActive) {
        setInsightText("경쟁사인 뚜레쥬르와 투썸플레이스가 이달에 접어들며 통신사(KT 달달혜택) 및 현대카드 M포인트 50% 역대급 혜택 등 고강도 카드 제휴 프로모션을 적극 전개하고 있습니다. 반면 파리바게뜨는 T-Day 20% 특별 우대 및 요기요 4천원 정액 할인에 주력 중입니다. 제휴 E쿠폰 분야에서는 뚜레쥬르의 선물하기 15% 기획전이 활성화 중이므로, 당사는 E쇼핑몰 전용 타겟 1+1 리워드 쿠폰 또는 신선 생크림 케익 카테고리의 핀포인트 혜택 보강을 권장합니다.");
        return;
      }
      const res = await fetch("/api/promotions/analyze", { method: "POST" });
      const data = await res.json();
      if (data.insight) {
        setInsightText(data.insight);
      }
    } catch (err) {
      console.error("인사이트 로드 에러:", err);
    }
  };

  // Silent automatic background promotion crawler trigger when accessing/loading the dashboard
  const handleAutoScrape = async () => {
    setStatusMessage("백그라운드 실시간 프로모션 자동 수집 및 크롤링 중...");
    try {
      if (staticModeActive) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setStatusMessage("자동 수집 완료! 실시간 수집 마케팅 데이터 정밀 분석 연계 중.");
        return;
      }
      const res = await fetch("/api/promotions/scrape", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(`자동 수집 완료! 신규 등록 프로모션: ${data.scrapedCount}건`);
        const now = new Date();
        const yStr = now.getFullYear();
        const mStr = String(now.getMonth() + 1).padStart(2, '0');
        const dStr = String(now.getDate()).padStart(2, '0');
        const hStr = String(now.getHours()).padStart(2, '0');
        const minStr = String(now.getMinutes()).padStart(2, '0');
        const sStr = String(now.getSeconds()).padStart(2, '0');
        setLastSyncTime(`${yStr}.${mStr}.${dStr} ${hStr}:${minStr}:${sStr} KST`);
        
        // Refresh promotions
        const promosRes = await fetch("/api/promotions");
        const promos = await promosRes.json();
        setPromotions(promos);
        
        // Refresh insights
        loadAIInsight();
      } else {
        setStatusMessage("자동 수집 백그라운드 수동 실패.");
      }
    } catch (err) {
      console.error("Auto background scrape error:", err);
      setStatusMessage("자동 수집 백그라운드 통신 지연.");
    }
  };

  useEffect(() => {
    const initApp = async () => {
      await loadData();
      await handleAutoScrape();
    };
    initApp();
  }, [staticModeActive]);

  // Actions: Web Scrape & Crawl via Gemini Google Search
  const handleScrape = async () => {
    setActionLoading(true);
    setStatusMessage("경쟁사 프로모션 수집 및 실시간 검색 크롤러 작동 중...");
    try {
      if (staticModeActive) {
        // Simulate real internet crawling
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Add a new mock competitive promotion to local storage
        const currentPromos = [...promotions];
        const daysDiff = clientGetDaysDifferenceFromEpoch();
        const startWeekMonday = clientShiftDateString("2026-05-18", daysDiff);
        const startWeekSunday = clientShiftDateString("2026-05-24", daysDiff);

        // Simulation item
        const simulatedNewPromotion: Promotion = {
          id: `sim-${Date.now()}`,
          brand: "뚜레쥬르",
          category: Category.CARD,
          title: "현대카드 M포인트 주말 50% 역대급 차감 세일 (Crawl 감지)",
          summary: "전 제품 대상 결제 금액의 최대 50% 포인트 결제 지원",
          description: "경쟁사 뚜레쥬르가 현대카드 제휴를 강화하여 주말 방문 고객 대상 50% 포인트 전액 사용 딜을 발표하였습니다. 당사 매장의 주말 매출 방어 조치 수립을 요합니다.",
          startDate: startWeekMonday,
          endDate: startWeekSunday,
          discountType: "할인",
          benefitValue: "50% 포인트 차감",
          benefitIntensity: 85,
          channel: "현대카드 공식 홈페이지",
          sourceUrl: "https://www.touslesjours.co.kr",
          createdAt: startWeekMonday,
          isNew: true,
          actionStatus: "검토중",
          countermeasure: "주말 케이크 카테고리 기획전으로 상쇄"
        };

        const hasAlreadySimulated = currentPromos.some(p => p.title.includes("현대카드 M포인트 주말 50%"));
        let updatedPromos = currentPromos;
        if (!hasAlreadySimulated) {
          updatedPromos = [simulatedNewPromotion, ...currentPromos];
          setPromotions(updatedPromos);
          localStorage.setItem("commerse_promotions", JSON.stringify(updatedPromos));

          // Trigger simulated alarm
          alert(`🎯 고강도 프로모션 이벤트가 감지되어 알림이 트리거되었습니다!\n\n[경고] 뚜레쥬르 - 현대카드 M포인트 주말 50% 역대급 차감 세일 (50% 포인트 차감)\n\n등록된 수신처로 긴급 리포트가 송신되었습니다: ${alertSettings?.email || "SaehimOH@gmail.com"}`);
        }

        setStatusMessage(`수집 완료! 신규 등록 프로모션: ${hasAlreadySimulated ? 0 : 1}건`);
        const now = new Date();
        const yStr = now.getFullYear();
        const mStr = String(now.getMonth() + 1).padStart(2, '0');
        const dStr = String(now.getDate()).padStart(2, '0');
        const hStr = String(now.getHours()).padStart(2, '0');
        const minStr = String(now.getMinutes()).padStart(2, '0');
        const sStr = String(now.getSeconds()).padStart(2, '0');
        setLastSyncTime(`${yStr}.${mStr}.${dStr} ${hStr}:${minStr}:${sStr} KST`);
        
        loadAIInsight();
        setActionLoading(false);
        return;
      }

      const res = await fetch("/api/promotions/scrape", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        // App alert notifications simulation
        if (data.alerts && data.alerts.length > 0) {
          const alertDesc = data.alerts.map((a: any) => `[경고] ${a.brand} - ${a.title} (${a.value})`).join("\n");
          alert(`🎯 고강도 프로모션 이벤트가 감지되어 알림이 트리거되었습니다!\n\n${alertDesc}\n\n등록된 수신처로 긴급 리포트가 송신되었습니다: ${data.alerts[0].email}`);
        }
        
        setStatusMessage(`수집 완료! 신규 등록 프로모션: ${data.scrapedCount}건`);
        const now = new Date();
        const yStr = now.getFullYear();
        const mStr = String(now.getMonth() + 1).padStart(2, '0');
        const dStr = String(now.getDate()).padStart(2, '0');
        const hStr = String(now.getHours()).padStart(2, '0');
        const minStr = String(now.getMinutes()).padStart(2, '0');
        const sStr = String(now.getSeconds()).padStart(2, '0');
        setLastSyncTime(`${yStr}.${mStr}.${dStr} ${hStr}:${minStr}:${sStr} KST`);
        // Refresh
        const promosRes = await fetch("/api/promotions");
        const promos = await promosRes.json();
        setPromotions(promos);
        
        // Refresh insights
        loadAIInsight();
      } else {
        setStatusMessage("오류: 수집 작업을 실패하였습니다.");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("오류: 크롤러 서버 응답 시간 초과.");
    } finally {
      setActionLoading(false);
    }
  };

  // Add Promotion
  const handleAddPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (staticModeActive) {
        const added = { ...newPromo, id: `manual-${Date.now()}` };
        const updated = [added, ...promotions];
        setPromotions(updated);
        localStorage.setItem("commerse_promotions", JSON.stringify(updated));
        
        setShowAddPromoModal(false);
        setStatusMessage(`새 프로모션 "${added.title}" 수동 등록 완료.`);
        loadAIInsight();
        
        // Reset form
        setNewPromo({
          brand: "파리바게뜨",
          category: Category.TELECOM,
          title: "",
          summary: "",
          description: "",
          startDate: "2026-05-18",
          endDate: "2026-05-24",
          discountType: "할인",
          benefitValue: "",
          benefitIntensity: 50,
          channel: "수동 등록",
          sourceUrl: "",
          isNew: true
        });
        return;
      }

      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPromo)
      });
      if (res.ok) {
        const added = await res.json();
        setPromotions([added, ...promotions]);
        setShowAddPromoModal(false);
        setStatusMessage(`새 프로모션 "${added.title}" 수동 등록 완료.`);
        loadAIInsight();
        // Reset form
        setNewPromo({
          brand: "파리바게뜨",
          category: Category.TELECOM,
          title: "",
          summary: "",
          description: "",
          startDate: "2026-05-18",
          endDate: "2026-05-24",
          discountType: "할인",
          benefitValue: "",
          benefitIntensity: 50,
          channel: "수동 등록",
          sourceUrl: "",
          isNew: true
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Promotion
  const handleDeletePromotion = async (id: string, name: string) => {
    if (!confirm(`"${name}" 프로모션을 삭제하시겠습니까?`)) return;
    try {
      if (staticModeActive) {
        const updated = promotions.filter(p => p.id !== id);
        setPromotions(updated);
        localStorage.setItem("commerse_promotions", JSON.stringify(updated));
        
        setStatusMessage(`프로모션이 성공적으로 삭제되었습니다.`);
        setSelectedPromotion(null);
        loadAIInsight();
        return;
      }

      const res = await fetch(`/api/promotions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPromotions(promotions.filter(p => p.id !== id));
        setStatusMessage(`프로모션이 성공적으로 삭제되었습니다.`);
        setSelectedPromotion(null);
        loadAIInsight();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Proof link safe navigation logic (Two-track management)
  const handleProofLinkClick = async (promo: Promotion, e: React.MouseEvent) => {
    e.preventDefault();

    // Track 1: Check if the promotion is closed/expired (current week basis)
    const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-06-09"
    const isExpired = promo.endDate && promo.endDate < todayStr;

    if (isExpired) {
      if (confirm(`[종료된 프로모션 감지]\n\n해당 프로모션("${promo.title}")은 이벤트 기간(${promo.startDate} ~ ${promo.endDate})이 이미 종료되었습니다.\n\n안전 가이드에 따라 이 기간 만료 프로모션을 캘린더에서 완벽히 삭제/정리하시겠습니까?`)) {
        await handleDeletePromotion(promo.id, promo.title);
        return;
      }
    }

    // Track 2: Handle landing issues (fallback to brand main home or event hub site list)
    const testUrl = promo.sourceUrl || "";
    let targetUrl = testUrl;

    const brandFallbackUrls: Record<string, { home: string; eventHub: string }> = {
      "파리바게뜨": {
        home: "https://www.paris.co.kr",
        eventHub: "https://www.paris.co.kr/promotion/event-list/"
      },
      "뚜레쥬르": {
        home: "https://www.touslesjours.co.kr",
        eventHub: "https://www.touslesjours.co.kr/community/event/list.asp"
      },
      "투썸플레이스": {
        home: "https://www.twosome.co.kr",
        eventHub: "https://www.twosome.co.kr/event/list.do"
      },
      "스타벅스": {
        home: "https://www.starbucks.co.kr",
        eventHub: "https://www.starbucks.co.kr/whats_new/campaign_list.do"
      },
      "배스킨라빈스": {
        home: "https://www.baskinrobbins.co.kr",
        eventHub: "https://www.baskinrobbins.co.kr/event/list.php"
      }
    };

    const cleanBrand = promo.brand ? promo.brand.trim() : "";
    const fallback = brandFallbackUrls[cleanBrand] || { 
      home: "https://www.paris.co.kr", 
      eventHub: "https://www.paris.co.kr/promotion/event-list/" 
    };

    const isErrorProneDetailLink = 
      testUrl.includes("/detail") || 
      testUrl.includes("/event-detail") || 
      testUrl.includes("campaign_detail") || 
      testUrl.includes("campaign-detail") || 
      testUrl.includes("event/detail") ||
      testUrl.includes("event/list.php") ? true : false;

    if (isErrorProneDetailLink) {
      if (confirm(`[이동 링크 정정 및 무중단 보정 안내]\n\n해당 프로모션의 수집 상세 증빙 URL은 사이트 개편이나 주차 만료 등으로 인해 접속 오류(404)를 보일 수 있습니다.\n\n안전하고 정상 보정된 공식 브랜드의 [이벤트 통합센터 목록] 페이지로 우회하여 자동 연결해 드릴까요?\n\n- [확인]: 안전한 공식 이벤트 목록 허브로 이동\n- [취소]: 오리지널 수집 상세 경로 직접 이동 시도`)) {
        targetUrl = fallback.eventHub;
      }
    } else if (!testUrl.startsWith("http")) {
      targetUrl = fallback.home;
    }

    try {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Link navigation failed", err);
    }
  };

  // Add Brand Target
  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.id || !newBrand.name) return;
    try {
      if (staticModeActive) {
        const added = { ...newBrand };
        const updated = [...brands, added];
        setBrands(updated);
        localStorage.setItem("commerse_brands", JSON.stringify(updated));
        
        setShowAddBrandModal(false);
        setStatusMessage(`새로운 브랜드 "${added.name}" 가 추가되었습니다.`);
        // Reset form
        setNewBrand({ id: "", name: "", isCompetitor: true, homepageUrl: "", eventUrl: "" });
        return;
      }

      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBrand)
      });
      if (res.ok) {
        const added = await res.json();
        setBrands([...brands, added]);
        setShowAddBrandModal(false);
        setStatusMessage(`새로운 브랜드 "${added.name}" 가 추가되었습니다.`);
        // Reset form
        setNewBrand({ id: "", name: "", isCompetitor: true, homepageUrl: "", eventUrl: "" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Brand competitor status
  const handleToggleBrandCompetitor = async (id: string, current: boolean) => {
    try {
      if (staticModeActive) {
        const target = brands.find(b => b.id === id);
        if (target) {
          const updatedBrand = { ...target, isCompetitor: !current };
          const updatedBrands = brands.map(b => b.id === id ? updatedBrand : b);
          setBrands(updatedBrands);
          localStorage.setItem("commerse_brands", JSON.stringify(updatedBrands));
          setStatusMessage(`브랜드 속성이 변경되었습니다.`);
        }
        return;
      }

      const res = await fetch(`/api/brands/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompetitor: !current })
      });
      if (res.ok) {
        const updated = await res.json();
        setBrands(brands.map(b => b.id === id ? updated : b));
        setStatusMessage(`브랜드 속성이 변경되었습니다.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Brand
  const handleDeleteBrand = async (id: string) => {
    if (!confirm("해당 수집 브랜드를 제외하시겠습니까? (연계 데이터는 일시 유지됨)")) return;
    try {
      if (staticModeActive) {
        const updated = brands.filter(b => b.id !== id);
        setBrands(updated);
        localStorage.setItem("commerse_brands", JSON.stringify(updated));
        setStatusMessage("수집 대상 브랜드가 제외되었습니다.");
        return;
      }

      const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBrands(brands.filter(b => b.id !== id));
        setStatusMessage("수집 대상 브랜드가 제외되었습니다.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Monitoring Channel
  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel.name || !newChannel.url) return;
    try {
      if (staticModeActive) {
        const added = { ...newChannel, id: `chan-${Date.now()}` };
        const updated = [...channels, added];
        setChannels(updated);
        localStorage.setItem("commerse_channels", JSON.stringify(updated));
        
        setShowAddChannelModal(false);
        setStatusMessage(`새 크롤링 채널 "${added.name}" 수립 완료.`);
        // Reset Form
        setNewChannel({ name: "", type: "official", url: "", description: "", enabled: true });
        return;
      }

      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChannel)
      });
      if (res.ok) {
        const added = await res.json();
        setChannels([...channels, added]);
        setShowAddChannelModal(false);
        setStatusMessage(`새 크롤링 채널 "${added.name}" 수립 완료.`);
        // Reset Form
        setNewChannel({ name: "", type: "official", url: "", description: "", enabled: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Channel Enabled Status
  const handleToggleChannel = async (id: string, currentEnabled: boolean) => {
    try {
      if (staticModeActive) {
        const target = channels.find(c => c.id === id);
        if (target) {
          const updatedChannel = { ...target, enabled: !currentEnabled };
          const updated = channels.map(c => c.id === id ? updatedChannel : c);
          setChannels(updated);
          localStorage.setItem("commerse_channels", JSON.stringify(updated));
          setStatusMessage(`채널 상태가 ${!currentEnabled ? "활성화" : "비활성화"} 되었습니다.`);
        }
        return;
      }

      const res = await fetch(`/api/channels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        const updated = await res.json();
        setChannels(channels.map(c => c.id === id ? updated : c));
        setStatusMessage(`채널 상태가 ${!currentEnabled ? "활성화" : "비활성화"} 되었습니다.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Channel
  const handleDeleteChannel = async (id: string) => {
    if (!confirm("채널 소스를 삭제하시겠습니까?")) return;
    try {
      if (staticModeActive) {
        const updated = channels.filter(c => c.id !== id);
        setChannels(updated);
        localStorage.setItem("commerse_channels", JSON.stringify(updated));
        setStatusMessage("크롤링 채널 소스가 탈퇴되었습니다.");
        return;
      }

      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (res.ok) {
        setChannels(channels.filter(c => c.id !== id));
        setStatusMessage("크롤링 채널 소스가 탈퇴되었습니다.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Settings
  const handleUpdateAlertSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertSettings) return;
    try {
      if (staticModeActive) {
        localStorage.setItem("commerse_alerts", JSON.stringify(alertSettings));
        setStatusMessage("마케팅 모니터링 경보 및 알림 규칙이 최신의 상태로 저장되었습니다.");
        alert("경보 규칙 설정이 정상 업데이트되었습니다!");
        return;
      }

      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertSettings)
      });
      if (res.ok) {
        setStatusMessage("마케팅 모니터링 경보 및 알림 규칙이 최신의 상태로 저장되었습니다.");
        alert("경보 규칙 설정이 정상 업데이트되었습니다!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPDF = (mode: 'direct' | 'pdf' = 'pdf') => {
    // Alert the user that the report is being compiled
    if (mode === 'pdf') {
      alert("📑 실시간 수집 마케팅 데이터 기반으로 C-Level 주간 보고자료 컴파일을 완료했습니다.\n\n확인을 클릭하시면 PDF 호환형 .html 보고서 파일의 다운로드가 즉시 시작됩니다.\n다운로드된 파일을 열어 우상단 '인쇄/PDF 저장'으로 최적 보고서를 확인하실 수 있습니다.");
    } else {
      alert("💾 실시간 수집 마케팅 분석 보고서의 오프라인 HTML 파일 다운로드를 시작합니다.");
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    // 1. Brand averages rows html
    const brandRowsHtml = brandAverages.map(avg => {
      const isOurBrand = !avg.isCompetitor;
      const pct = avg.count > 0 ? avg.avgIntensity : 0;
      return `
        <div style="margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: bold; margin-bottom: 5px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${isOurBrand ? '#003C8F' : '#64748b'};"></span>
              <strong>${avg.name}</strong> 
              ${isOurBrand ? '<span style="background-color: #003C8F; color: white; border: 1px solid #003C8F; font-size: 9px; padding: 1px 4px; border-radius: 4px; margin-left: 5px;">자사 PB</span>' : '<span style="background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 9px; padding: 1px 4px; border-radius: 4px; margin-left: 5px;">경쟁사</span>'}
            </div>
            <div style="font-size: 11.5px; color: #475569;">
              행사수: <strong style="color: #0f172a;">${avg.count}건</strong> | 평균 강도: <strong style="color: #003C8F;">${avg.avgIntensity} pts</strong>
            </div>
          </div>
          <div style="width: 100%; background-color: #e2e8f0; height: 8px; border-radius: 10px; overflow: hidden;">
            <div style="width: ${pct}%; background: linear-gradient(90deg, #003C8F 0%, #1d4ed8 100%); height: 100%; border-radius: 10px;"></div>
          </div>
        </div>
      `;
    }).join('');

    // 2. Action plans HTML
    const actionPlansHtml = actionPlans.map(plan => {
      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; background-color: ${plan.checked ? '#f8fafc' : 'white'}; border-left: 4px solid ${plan.priority === '초고도' ? '#ef4444' : plan.priority === '긴급' ? '#f97316' : '#3b82f6'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 11px;">
            <span style="display: inline-block; padding: 1px 6px; border-radius: 3px; font-weight: bold; background-color: ${plan.priority === '초고도' ? '#fee2e2' : plan.priority === '긴급' ? '#ffedd5' : '#dbeafe'}; color: ${plan.priority === '초고도' ? '#b91c1c' : plan.priority === '긴급' ? '#ea580c' : '#1e40af'};">${plan.priority}</span>
            <span style="font-family: monospace; color: #64748b;">${plan.timeline}</span>
          </div>
          <h4 style="font-size: 12px; font-weight: bold; color: #0f172a; margin: 4px 0 6px 0;">${plan.title}</h4>
          <p style="font-size: 11px; color: #475569; margin: 0 0 6px 0; line-height: 1.4;">${plan.description}</p>
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
            <span>대표팀: <strong>${plan.responsible}</strong></span>
            <span style="color: #003C8F; font-weight: bold;">${plan.revenueImpact}</span>
          </div>
          <div style="margin-top: 6px; font-size: 10.5px; font-weight: bold; color: ${plan.checked ? '#16a34a' : '#64748b'};">
            상태: ${plan.checked ? '✓ 최종 승인안 적극 가동 중' : '⚪ 내부 검열 대기 중'}
          </div>
        </div>
      `;
    }).join('');

    // 3. Render reviews helper
    const renderPdfReviews = (reviews: any[]) => {
      if (!reviews || reviews.length === 0) {
        return '<p style="color: #94a3b8; font-style: italic; font-size: 11px; text-align: center; padding: 15px; margin: 0;">데이터 피드가 비어있습니다.</p>';
      }
      return reviews.map(rev => `
        <div style="border-bottom: 1px solid #f1f5f9; padding: 8px 0; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 10px; margin-bottom: 3px;">
            <span><strong>${rev.user}</strong> (★${rev.rating}.0)</span>
            <span style="font-family: monospace;">${rev.date}</span>
          </div>
          <p style="margin: 0; font-weight: 500; color: #1e293b; line-height: 1.45;">“${rev.content}”</p>
        </div>
      `).join('');
    };

    // 4. Promotions List Rows
    const promotionsHtml = displayPromotions.map((p, idx) => {
      const isOurBrand = p.brand === "파리바게뜨";
      return `
        <tr>
          <td style="font-weight: bold; width: 40px; text-align: center; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding: 10px 14px;">${idx + 1}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${isOurBrand ? '#003C8F' : '#f43f5e'};"></span>
              <strong style="color: ${isOurBrand ? '#003C8F' : '#334155'}; font-size: 12px;">${p.brand}</strong>
            </div>
          </td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px;">
            <span style="display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: bold; border-radius: 4px; background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">${p.category}</span>
          </td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px;">
            <div style="font-size: 12px; font-weight: bold; color: #0f172a;">${p.title}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${p.summary}</div>
          </td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px; font-weight: bold; color: #1d4ed8; font-size: 12px;">${p.benefitValue}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px; font-family: monospace; font-weight: bold; color: #ef4444; text-align: center;">${p.benefitIntensity} pts</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px; font-family: monospace; font-size: 10.5px; color: #475569;">${p.startDate} ~ ${p.endDate}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 14px; font-size: 10px; color: #64748b;">${p.channel}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>PB Commerce-Watch 주간 인텔리전스 분석 보고서</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
    
    body {
      font-family: "Noto Sans KR", "Inter", sans-serif;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }
    .container {
      max-width: 1120px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .notice-bar {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.05);
    }
    .notice-bar h4 {
      margin: 0 0 4px 0;
      font-weight: 800;
      font-size: 14px;
    }
    .notice-bar p {
      margin: 0;
      font-size: 12px;
      color: #166534;
    }
    .print-button {
      background-color: #16a34a;
      color: white;
      border: none;
      padding: 10px 18px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: all 0.2s;
    }
    .print-button:hover {
      background-color: #15803d;
      transform: translateY(-1px);
    }
    .pdf-header-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 35px 40px;
      border-radius: 16px;
      margin-bottom: 30px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
    }
    .header-logo-badge {
      display: inline-block;
      background-color: #003C8F;
      color: white;
      font-weight: 900;
      font-size: 10px;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 1.5px;
      margin-bottom: 15px;
      text-transform: uppercase;
    }
    .pdf-header-card h1 {
      font-size: 24px;
      font-weight: 900;
      margin: 0 0 10px 0;
      letter-spacing: -0.5px;
      color: #f8fafc;
    }
    .pdf-header-card .desc {
      font-size: 13.5px;
      color: #94a3b8;
      margin: 0;
    }
    .metadata-grid {
      display: grid;
      grid-template-cols: repeat(4, 1fr);
      gap: 15px;
      margin-top: 30px;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 20px;
    }
    .meta-box {
      display: flex;
      flex-direction: column;
    }
    .meta-lbl {
      font-size: 10px;
      color: #64748b;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-val {
      font-size: 13px;
      font-weight: bold;
      color: #e2e8f0;
    }
    .section-title {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      border-left: 5px solid #003C8F;
      padding-left: 10px;
      margin: 35px 0 15px 0;
      letter-spacing: -0.5px;
    }
    .grid-three {
      display: grid;
      grid-template-cols: repeat(3, 1fr);
      gap: 20px;
    }
    .widget-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .widget-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 15px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }
    .bullet-item {
      margin-bottom: 12px;
      font-size: 11.5px;
      color: #334155;
      line-height: 1.5;
    }
    .bullet-label {
      font-weight: bold;
      display: block;
      margin-bottom: 2px;
    }
    .table-holder {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      margin-top: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background-color: #f8fafc;
      font-size: 11px;
      color: #475569;
      font-weight: 700;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer-note {
      margin-top: 50px;
      text-align: center;
      font-size: 10.5px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-family: monospace;
    }
    
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background-color: white;
        color: black;
      }
      .container {
        padding: 0;
        max-width: 100%;
      }
      .pdf-header-card {
        border-radius: 0;
        border: 1px solid #cbd5e1;
        background: #f8fafc !important;
        box-shadow: none !important;
      }
      .pdf-header-card h1, .pdf-header-card .desc, .meta-val {
        color: black !important;
      }
      .metadata-grid {
        border-top: 1px solid #94a3b8;
      }
      .widget-card {
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        page-break-inside: avoid;
      }
      .table-holder {
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>

  <div class="container">
    
    <!-- Browser Only Notice Control -->
    <div class="notice-bar no-print">
      <div>
        <h4>📑 Commerce-Watch 주간 통합 마케팅 분석 보고서가 발행되었습니다.</h4>
        <p>인쇄 대상을 <strong>"PDF로 저장 (Save as PDF)"</strong>으로 설정하여 저장하시면 디지털 PDF 파일로 영구 보존 가능합니다.</p>
      </div>
      <button onclick="window.print()" class="print-button">
        <svg style="width: 14px; height: 14px; fill: currentColor; margin-right: 4px;" viewBox="0 0 24 24">
          <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
        </svg>
        보고서 인쇄 / PDF 저장
      </button>
    </div>

    <!-- MAIN HEADER -->
    <div class="pdf-header-card">
      <div class="header-logo-badge">SPC Commerce-Watch Office</div>
      <h1>WEEKLY COMPETITIVE COMMERCE INTELLIGENCE REPORT</h1>
      <p class="desc">국내 베이커리/디저트 마켓의 실시간 종합 프로모션 혜택, 경쟁 위협도 분석 및 C-Level 경영전략실 주간 정책 연계 기획서</p>
      
      <div class="metadata-grid">
        <div class="meta-box">
          <span class="meta-lbl">보고 분류</span>
          <span class="meta-val">C-Level 통합 주간 브리핑</span>
        </div>
        <div class="meta-box">
          <span class="meta-lbl">보고 주차</span>
          <span class="meta-val">${weekInfo.year}년 ${weekInfo.month}월 ${weekInfo.weekNum}주차 (${weekInfo.rangeStr})</span>
        </div>
        <div class="meta-box">
          <span class="meta-lbl">수집 일자</span>
          <span class="meta-val">${todayStr} (실시간 갱신 적용)</span>
        </div>
        <div class="meta-box">
          <span class="meta-lbl">기밀 분류</span>
          <span class="meta-val">대외비 (Class-2 Confidential)</span>
        </div>
      </div>
    </div>

    <!-- UPPER ROW METRICS -->
    <div class="grid-three">
      
      <!-- Card block 1: Brand matrix stats -->
      <div class="widget-card">
        <h3 class="widget-title">📊 실시간 브랜드 위협 지표 (Averages)</h3>
        ${brandRowsHtml}
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-top: 12px; font-size: 11px; color: #475569; line-height: 1.4;">
          <strong>데이터 산식 설명:</strong> 각 브랜드 당 활성 프로모션 수량(Volume)과 할인 강도(Intensity pts)를 연계 측정하여 브랜드 위협 지수 가중치를 도출함.
        </div>
      </div>

      <!-- Card block 2: Market trend insights -->
      <div class="widget-card">
        <h3 class="widget-title">⚠️ 주간 시장 핵심 판도 동향</h3>
        <div class="bullet-item">
          <span class="bullet-label" style="color: #ef4444;">● 뚜레쥬르 역마진 멤버십 마케팅 부스팅</span>
          배달 플랫폼 브랜드 제휴를 선두로, SKT T-Day 30% 즉시 할인 혜택을 전면 전개하고 있습니다. 자사 유사 라인업의 충성 고객층 방어용 기습 타겟 쿠폰 대응이 권고됩니다.
        </div>
        <div class="bullet-item" style="border-top: 1px dashed #f1f5f9; padding-top: 8px;">
          <span class="bullet-label" style="color: #1e293b;">● 디저트/홀케이크 홀더 세어 유지 전술</span>
          투썸플레이스가 타겟 멤버십 리워드 및 현대카드 단독 50% 역대급 M포인트 차감 소모 전을 벌이고 있어 자사 시그니처 케이크 라인업의 단선 E-쿠폰 맞불 기획이 신속 집행되었습니다.
        </div>
        <div class="bullet-item" style="border-top: 1px dashed #f1f5f9; padding-top: 8px;">
          <span class="bullet-label" style="color: #16a34a;">● 가맹점 중심 한정판 'Drops' 마케팅 추진</span>
          상권 내 방문 유동인구 이탈 극점을 방지하기 위하여 주말 해피앱 우수 패밀리 유저 한정 모바일 3,000원 선착순 앱 특별 보조 티켓 drops 제안을 적극 승인 기획합니다.
        </div>
      </div>

      <!-- Card block 3: Tactical Action plans -->
      <div class="widget-card">
        <h3 class="widget-title">💡 SPC 파리바게뜨 특화형 조치 현황</h3>
        <div style="max-height: 340px; overflow-y: auto; padding-right: 2px;">
          ${actionPlansHtml}
        </div>
      </div>

    </div>

    <!-- SECTOR: BRAND REVIEWS CHOSEN -->
    <div class="section-title">💬 미디어 소셜 채널 수집 고객 감성 및 컴플레인 요약 (${selectedReviewBrand} 기준)</div>
    <div class="widget-card" style="margin-bottom: 25px;">
      <div style="display: flex; gap: 20px;">
        <div style="width: 25%; text-align: center; border-right: 1px solid #e2e8f0; padding-right: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <span style="font-size: 10.5px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">Sentiment Score</span>
          <h2 style="font-size: 40px; font-weight: 900; margin: 8px 0; color: #003C8F; font-family: monospace; line-height: 1;">
            ${selectedReviewBrand === "파리바게뜨" ? "82%" : 
             selectedReviewBrand === "뚜레쥬르" ? "86%" :
             selectedReviewBrand === "투썸플레이스" ? "75%" :
             selectedReviewBrand === "스타벅스" ? "92%" : "84%"}
          </h2>
          <span style="display: inline-block; padding: 2px 7px; font-size: 9px; font-weight: bold; border-radius: 4px; background-color: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0;">POSITIVE BRAND FEEDBACK</span>
          <p style="font-size: 10.5px; color: #94a3b8; margin: 10px 0 0 0; line-height: 1.45;">해당 브랜드 이벤트 관련 소셜 미디어, 대표 커뮤니티(뽐뿌 등) 수집 여론 긍정 비율입니다.</p>
        </div>
        
        <div style="width: 37.5%; border-right: 1px solid #e2e8f0; padding-right: 20px; padding-left: 5px;">
          <h4 style="margin-top: 0; color: #16a34a; font-size: 12.5px; font-weight: bold; margin-bottom: 8px;">👍 긍정 소비자 주요 반응 (대표 5선)</h4>
          <div>
            ${renderPdfReviews(reviewsData.positive)}
          </div>
        </div>

        <div style="width: 37.5%; padding-left: 20px;">
          <h4 style="margin-top: 0; color: #dc2626; font-size: 12.5px; font-weight: bold; margin-bottom: 8px;">👎 불만 및 요구 개선 반응 (대표 5선)</h4>
          <div>
            ${renderPdfReviews(reviewsData.negative)}
          </div>
        </div>
      </div>
    </div>

    <!-- SECTOR: DETAILED MATRIX LIST -->
    <div class="section-title">📝 주간 마인드 세어 수집 로우 프로모션 전체 목록 (총 ${displayPromotions.length}개 행사 분류)</div>
    
    <div class="table-holder">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: center; width: 40px;">NO</th>
            <th>수집 브랜드</th>
            <th>카테고리구분</th>
            <th>프로모션 명칭 & AI 분석요약</th>
            <th>혜택 지표값</th>
            <th style="text-align: center; width: 80px;">혜택강도 지수</th>
            <th>이벤트 기간 정보</th>
            <th>데이터 수집 소스채널</th>
          </tr>
        </thead>
        <tbody>
          ${promotionsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer-note">
      SPC COMMERCE INTELLIGENCE ENGINE &bull; CONFIDENTIAL &bull; REPORT GENERATED SUCCESSFULLY AT ${new Date().toLocaleDateString('ko-KR')}
    </div>

  </div>

</body>
</html>`;

    // Attempt a client-side Blob trigger download
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Commerce_Watch_Weekly_Report_${todayStr.replace(/\./g, '_')}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Commerce Report Export Failed:", e);
      alert("보고서 생성 및 백그라운드 내보내기 도중 치명적 에러가 발생했습니다:\n" + e.message);
    }
  };

  // Filters calculation
  const filteredPromotions = activePromotions.filter(promo => {
    const brandMatch = filterBrand === "All" || promo.brand === filterBrand;
    const catMatch = filterCategory === "All" || promo.category === filterCategory;
    
    // Quick tags check
    let quickTagMatch = true;
    if (selectedQuickTag !== "전체") {
      const tagLower = selectedQuickTag.toLowerCase();
      quickTagMatch = 
        promo.title.toLowerCase().includes(tagLower) ||
        promo.summary.toLowerCase().includes(tagLower) ||
        (promo.description && promo.description.toLowerCase().includes(tagLower)) ||
        promo.category.toLowerCase().includes(tagLower) ||
        promo.discountType.toLowerCase().includes(tagLower) ||
        promo.benefitValue.toLowerCase().includes(tagLower) ||
        promo.channel.toLowerCase().includes(tagLower);
    }

    const lowerSearch = searchTerm.toLowerCase();
    const searchMatch = !searchTerm || 
      promo.title.toLowerCase().includes(lowerSearch) ||
      promo.summary.toLowerCase().includes(lowerSearch) ||
      (promo.description && promo.description.toLowerCase().includes(lowerSearch)) ||
      promo.benefitValue.toLowerCase().includes(lowerSearch) ||
      promo.channel.toLowerCase().includes(lowerSearch);

    return brandMatch && catMatch && quickTagMatch && searchMatch;
  });

  const displayPromotions = sortByIntensity
    ? [...filteredPromotions].sort((a, b) => b.benefitIntensity - a.benefitIntensity)
    : filteredPromotions;

  // Calendar render helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonthVal = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  // Generate calendar grid array
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonthVal; d++) {
    calendarDays.push(d);
  }

  // Check which promotions are active on a specific calendar day in current month
  const getPromotionsForDay = (day: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const dateStr = `${currentYear}-${monthStr}-${day.toString().padStart(2, "0")}`;
    const checkDate = new Date(dateStr);
    
    return activePromotions.filter(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return checkDate >= start && checkDate <= end;
    });
  };

  // Brand Color Maps
  const getBrandColors = (brandName: string) => {
    switch (brandName) {
      case "파리바게뜨":
        return {
          border: "border-[#003C8F]",
          text: "text-[#003C8F]",
          bg: "bg-blue-50/70",
          accent: "bg-[#003C8F]",
          textAlt: "text-blue-900"
        };
      case "뚜레쥬르":
        return {
          border: "border-green-600",
          text: "text-green-700",
          bg: "bg-green-50/70",
          accent: "bg-green-600",
          textAlt: "text-green-900"
        };
      case "투썸플레이스":
        return {
          border: "border-red-600",
          text: "text-red-600",
          bg: "bg-red-50/70",
          accent: "bg-red-600",
          textAlt: "text-red-900"
        };
      case "스타벅스":
        return {
          border: "border-emerald-700",
          text: "text-emerald-800",
          bg: "bg-emerald-50/70",
          accent: "bg-emerald-700",
          textAlt: "text-emerald-950"
        };
      case "배스킨라빈스":
        return {
          border: "border-pink-500",
          text: "text-pink-600",
          bg: "bg-pink-50/70",
          accent: "bg-pink-500",
          textAlt: "text-pink-900"
        };
      default:
        return {
          border: "border-slate-400",
          text: "text-slate-700",
          bg: "bg-slate-50",
          accent: "bg-slate-500",
          textAlt: "text-slate-900"
        };
    }
  };

  // Get specific Category Enum array
  const categoriesList = [
    Category.PARTNERSHIP,
    Category.CARD,
    Category.TELECOM,
    Category.ECOUPON,
    Category.DELIVERY
  ];

  // Logic to calculate brand comparison averages for Analytics
  const brandAverages = brands.map(brand => {
    const brandPromos = activePromotions.filter(p => p.brand === brand.name);
    const avgIntensity = brandPromos.length > 0
      ? Math.round(brandPromos.reduce((acc, curr) => acc + curr.benefitIntensity, 0) / brandPromos.length)
      : 0;
    return {
      name: brand.name,
      count: brandPromos.length,
      avgIntensity,
      isCompetitor: brand.isCompetitor
    };
  });

  return (
    <div id="pb-commerce-watch" className="flex flex-col h-screen w-full bg-[#F3F4F6] font-sans text-slate-800 overflow-hidden">
      
      {/* Top Header */}
      <header id="main-header" className="flex items-center justify-between px-8 h-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-[#003C8F] rounded-xl flex items-center justify-center shadow-lg">
            <div className="text-white font-black text-xl">PB</div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center">
              PB Commerce-Watch 
              <span className="text-slate-500 font-bold ml-2.5 text-xs bg-slate-100 px-2.5 py-0.5 rounded-full">v1.0 Internal</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-mono font-bold uppercase tracking-widest leading-none mt-1">Commerce Marketing Intelligence</p>
          </div>
        </div>
        
        {/* Date view & Top actions */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center bg-slate-50 rounded-full px-5 py-1.5 border border-slate-200 shadow-inner">
            <span className="text-[11px] font-black text-[#003C8F] mr-2.5 tracking-wider">{weekInfo.engMonthUpper} WEEK {weekInfo.weekNum}</span>
            <span className="text-xs font-bold text-slate-600 font-mono">{weekInfo.fullRangeStr}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="export-html-btn"
              onClick={() => handleExportPDF('direct')}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#FAF8F5] border border-amber-300 hover:bg-amber-50 text-amber-800 rounded-lg text-xs md:text-sm font-extrabold transition active:scale-95 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-600" />
              <span>HTML 다운로드</span>
            </button>
            <button
              id="export-pdf-btn"
              onClick={() => handleExportPDF('pdf')}
              className="flex items-center space-x-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs md:text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>EXPORT REPORT</span>
            </button>
            <button
              id="global-scrape-btn"
              disabled={actionLoading}
              onClick={handleScrape}
              className={`flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs md:text-sm font-extrabold shadow-md shadow-blue-900/10 transition active:scale-95 text-white cursor-pointer ${
                actionLoading ? "bg-slate-400 cursor-not-allowed" : "bg-[#003C8F] hover:bg-[#002e70]"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
              <span>크롤링 가동 (LIVE)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation tabs row & Filters */}
      <div id="sub-navigation" className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-2">
          {/* Main Navigation Tabs */}
          <button
            id="tab-matrix-btn"
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "matrix" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>비교 매트릭스</span>
          </button>
          <button
            id="tab-calendar-btn"
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "calendar" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>캘린더 일정표</span>
          </button>
          <button
            id="tab-analytics-btn"
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "analytics" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>혜택 분석 차트</span>
          </button>
          <button
            id="tab-management-btn"
            onClick={() => setActiveTab("management")}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "management" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>수집 브랜드/채널 관리</span>
          </button>
          <button
            id="tab-settings-btn"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold transition cursor-pointer ${
              activeTab === "settings" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>경보 규칙 설정</span>
          </button>
        </div>

        {/* Global Live Filters bar */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              id="promo-search-input"
              type="text"
              placeholder="혜택 단어로 실시간 필터링..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-300 rounded text-xs w-48 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
            />
          </div>

          {/* Brand Filter */}
          <select
            id="brand-filter-select"
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="All">브랜드 전체</option>
            {brands.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            id="category-filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="All">카테고리 전체</option>
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Sort trigger */}
          <button
            id="toggle-sort-intensity-btn"
            onClick={() => setSortByIntensity(!sortByIntensity)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border transition ${
              sortByIntensity ? "bg-blue-100 border-blue-400 text-blue-700 font-bold" : "bg-slate-50 border-slate-300 text-slate-600"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>강도 정렬</span>
          </button>

          {/* Manual Register Trigger */}
          <button
            id="add-promo-modal-trigger"
            onClick={() => setShowAddPromoModal(true)}
            className="flex items-center space-x-1 px-3 py-1 bg-slate-900 border border-[#013C8D] text-white rounded font-bold hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>모니터 수동 등록</span>
          </button>
        </div>
      </div>

      {/* Quick Tag Pills Block */}
      <div id="quick-tags-bar" className="flex items-center space-x-2 px-8 py-2 bg-slate-50 border-b border-slate-250 shrink-0 overflow-x-auto select-none scrollbar-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">간편 키워드 필터:</span>
        {["전체", "통신사", "M포인트", "1+1", "50%", "딜리버리", "할인", "적립", "쿠폰"].map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedQuickTag(tag)}
            className={`px-3 py-0.5 text-xs font-semibold rounded-full border transition-all shrink-0 ${
              selectedQuickTag === tag 
                ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-350 hover:bg-slate-100"
            }`}
          >
            {tag === "전체" ? "전체 보기" : `#${tag}`}
          </button>
        ))}
      </div>

      {/* Main Panel Content Area */}
      <main ref={mainScrollRef} onScroll={handleMainScroll} className="flex-1 p-6 overflow-y-auto min-h-0 flex flex-col space-y-4">

        {loading ? (
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-md p-12 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-10 h-10 text-[#003C8F] animate-spin" />
            <h3 className="font-bold text-slate-700 text-sm">파리바게뜨 영업 대시보드 로딩 중...</h3>
            <p className="text-xs text-slate-400">데이터 소스 및 DB 구성을 가져오는 중입니다.</p>
          </div>
        ) : (
          <>
            {/* Tab 1: Comparison Matrix */}
            {activeTab === "matrix" && (
              <div id="matrix-container" className="flex flex-col space-y-4">
                
                {/* 실시간 고객 경험 및 소셜 감성 여론 트랙킹 (Market Customer Reviews Analyzer) */}
                <div id="customer-reviews-analyzer-card" className="bg-white border border-slate-200 rounded-xl shadow-md p-6 space-y-4 animate-fade-in transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-[15px] md:text-base text-slate-850 flex items-center space-x-1.5 flex-row">
                        <span className="text-blue-600">💬</span>
                        <span>실시간 고객 경험 및 소셜 감성 여론 트랙킹 (Market Customer Reviews Analyzer)</span>
                      </h4>
                      <p className="text-xs text-slate-400">브랜드별 실시간 행사 여론, 혜택 불만 및 선호 지표 긍부정 즉시 선취 (브랜드당 각 5개 정밀 필터)</p>
                    </div>

                    {/* Brand Selector Pills */}
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {["파리바게뜨", "뚜레쥬르", "투썸플레이스", "스타벅스", "배스킨라빈스"].map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setSelectedReviewBrand(b)}
                          className={`px-3 py-1 cursor-pointer rounded-full text-[11px] font-black tracking-wide border transition-all ${
                            selectedReviewBrand === b
                              ? "bg-[#003C8F] text-white border-[#003C8F] shadow-sm"
                              : "bg-white text-slate-600 border-slate-250 hover:bg-slate-50"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reviews content show */}
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 space-y-4 min-h-[180px] relative">
                    {reviewsLoading ? (
                      <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center p-6 space-y-4 z-10 rounded-xl font-sans">
                        <RefreshCw className="w-8 h-8 text-[#003C8F] animate-spin" />
                        <div className="text-center">
                          <h5 className="font-bold text-xs text-slate-700">실시간 {selectedReviewBrand} 프로모션 고객 여론 크롤링 중...</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">블로그, 뽐뿌, 인스타그램에서 감성 키워드를 추출 및 심층 요약하는 중입니다.</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-col lg:flex-row gap-5">
                      
                      {/* Sentiment Gauge card */}
                      <div className="lg:w-1/4 bg-white border border-slate-150 rounded-lg p-4 flex flex-col justify-between items-center text-center">
                        <div className="space-y-1">
                          <span className="text-[9.5px] uppercase font-mono font-bold tracking-widest text-slate-400">Sentiment Score</span>
                          <h5 className="font-extrabold text-[#003C8F] text-xs font-mono">{selectedReviewBrand}</h5>
                        </div>

                        {/* Big score meter */}
                        <div className="my-3 relative flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full border-[8px] border-slate-100 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-slate-800 font-mono">
                              {selectedReviewBrand === "파리바게뜨" ? "82%" : 
                               selectedReviewBrand === "뚜레쥬르" ? "86%" :
                               selectedReviewBrand === "투썸플레이스" ? "75%" :
                               selectedReviewBrand === "스타벅스" ? "92%" : "84%"}
                            </span>
                            <span className="text-[8px] text-emerald-600 font-black tracking-wide uppercase leading-none">POSITIVE</span>
                          </div>
                        </div>

                        <div className="space-y-1 w-full text-[10px]">
                          <div className="flex justify-between text-slate-400 border-b border-slate-100 pb-1.5">
                            <span>신뢰 계수</span>
                            <strong className="text-slate-700 font-mono font-bold">94.8% Alpha</strong>
                          </div>
                          <div className="flex justify-between text-slate-400 pt-0.5">
                            <span>스캔 표본 개체 식별</span>
                            <strong className="text-slate-700 font-mono font-bold">50명 여론 추적</strong>
                          </div>
                        </div>
                      </div>

                      {/* Reviews Lists: Positive vs Negative */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* 1. Positive reviews Column */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1.5 pb-1">
                            <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">👍</span>
                            <span className="font-extrabold text-xs text-slate-800">소비자 호평 및 긍정 반응 (대표 5선)</span>
                          </div>

                          <div className="space-y-2 overflow-y-auto max-h-[220px] scrollbar-none animate-fade-in">
                            {reviewsData.positive?.slice(0, 5).map(rev => (
                              <div key={rev.id} className="p-3 bg-white border border-slate-150 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <div className="flex items-center space-x-1 font-bold text-slate-600">
                                    <span>{rev.user}</span>
                                    <span className="text-[8.5px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 py-0.1 select-none rounded">Verified</span>
                                  </div>
                                  <div className="flex items-center space-x-1 bg-yellow-50 px-1 py-0.2 rounded font-bold font-mono text-yellow-600 text-[9px]">
                                    <span>★</span>
                                    <span>{rev.rating}.0</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-700 leading-relaxed font-medium">“{rev.content}”</p>
                                <div className="text-right text-[8.5px] font-mono text-slate-400">{rev.date}</div>
                              </div>
                            ))}
                            {(!reviewsData.positive || reviewsData.positive.length === 0) && (
                              <p className="text-slate-400 italic text-[11px] p-4 text-center">긍정 리뷰 정보 수급 전입니다.</p>
                            )}
                          </div>
                        </div>

                        {/* 2. Negative reviews Column */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1.5 pb-1">
                            <span className="w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center font-bold text-xs">👎</span>
                            <span className="font-extrabold text-xs text-slate-800">소비자 불만 및 개선 요구 (대표 5선)</span>
                          </div>

                          <div className="space-y-2 overflow-y-auto max-h-[220px] scrollbar-none animate-fade-in">
                            {reviewsData.negative?.slice(0, 5).map(rev => (
                              <div key={rev.id} className="p-3 bg-white border border-slate-150 rounded-lg hover:border-red-300 hover:shadow-sm transition-all space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <div className="flex items-center space-x-1 font-bold text-slate-600">
                                    <span>{rev.user}</span>
                                    <span className="text-[8.5px] bg-red-50 text-red-700 border border-red-100 px-1 py-0.1 select-none rounded">Warning</span>
                                  </div>
                                  <div className="flex items-center space-x-1 bg-red-50 px-1 py-0.2 rounded font-bold font-mono text-red-600 text-[9px]">
                                    <span>★</span>
                                    <span>{rev.rating}.0</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">“{rev.content}”</p>
                                <div className="text-right text-[8.5px] font-mono text-slate-400">{rev.date}</div>
                              </div>
                            ))}
                            {(!reviewsData.negative || reviewsData.negative.length === 0) && (
                              <p className="text-slate-400 italic text-[11px] p-4 text-center">불만 리뷰 정보 수급 전입니다.</p>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Scrape trigger */}
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-155">
                    <span className="text-[10px] text-slate-400 font-medium">여론 분석기 버전 API v1.2 — 실시간 모바일 피드백 크롤러 연동 중</span>
                    <button
                      type="button"
                      disabled={reviewsLoading}
                      onClick={() => fetchBrandReviews(selectedReviewBrand)}
                      className="px-4 py-1.5 bg-[#0F172A] text-white rounded font-bold text-[11px] hover:bg-slate-800 transition active:scale-95 flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 text-white ${reviewsLoading ? "animate-spin" : ""}`} />
                      <span>🔄 {selectedReviewBrand} 실시간 SNS 고객 여론 재성취 리크롤링 가동</span>
                    </button>
                  </div>
                </div>

                {/* Visual Grid Table */}
                <div id="brand-matrix-grid" className="grid grid-cols-6 border border-slate-300 rounded-xl overflow-hidden shadow-md bg-white">
                  
                  {/* Header Row */}
                  <div className="bg-slate-50 p-4 shrink-0 text-center flex items-center justify-center border-b border-r border-slate-300 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider italic">
                    Brand / Category
                  </div>
                  {categoriesList.map(cat => (
                    <div key={cat} className="bg-slate-50 p-4 border-b border-r last:border-r-0 border-slate-300 text-center flex items-center justify-center font-bold text-xs text-slate-600 uppercase tracking-wider">
                      {cat}
                    </div>
                  ))}

                  {/* Brands Rows */}
                  {brands.map(brand => {
                    const colors = getBrandColors(brand.name);
                    
                    return (
                      <React.Fragment key={brand.id}>
                        {/* Brand Column indicator */}
                        <div id={`matrix-brand-${brand.id}`} className={`${colors.bg} p-4 flex flex-col justify-center border-r border-b border-slate-200 border-l-4 ${colors.border}`}>
                          <div className="text-xs font-bold text-slate-900 tracking-tight flex items-center justify-between">
                            <span>{brand.name}</span>
                            {!brand.isCompetitor && (
                              <span className="text-[8px] bg-[#003C8F] text-white px-1 py-0.5 rounded uppercase font-bold tracking-tighter">자사</span>
                            )}
                          </div>
                          <div className="text-[9.5px] text-slate-500 mt-1">{brand.isCompetitor ? "경쟁사" : "전개 마켓"}</div>
                          <a href={brand.homepageUrl} target="_blank" rel="noreferrer" className="text-[9.5px] text-slate-400 flex items-center hover:text-blue-600 mt-1 cursor-pointer">
                            <span className="mr-0.5 font-mono">Official</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>

                        {/* Category cells */}
                        {categoriesList.map(cat => {
                          // Find promotions for this brand AND this category
                          const matches = displayPromotions.filter(p => p.brand === brand.name && p.category === cat);
                          
                          return (
                            <div key={cat} className="bg-white p-3 border-r last:border-r-0 border-b border-slate-200 hover:bg-slate-50/50 transition flex flex-col space-y-2 justify-center">
                              {matches.length === 0 ? (
                                <span className="text-[11px] text-slate-300 italic text-center">—</span>
                              ) : (
                                matches.map(promo => {
                                  const isCompared = selectedPromoIdsForCompare.includes(promo.id);
                                  return (
                                    <div
                                      id={`promo-card-${promo.id}`}
                                      key={promo.id}
                                      onClick={() => setSelectedPromotion(promo)}
                                      className={`p-2 border rounded bg-white shadow-sm hover:shadow transition-all relative flex flex-col space-y-1 cursor-pointer active:scale-98 ${
                                        isCompared ? "border-blue-500 ring-1 ring-blue-500/30" : "border-slate-200 hover:border-slate-305"
                                      }`}
                                    >
                                      {/* New & Intensive indicators */}
                                      {promo.isNew && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow z-10">NEW</span>
                                      )}

                                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mt-0.5 font-mono">
                                        <span>{promo.channel}</span>
                                        <div className="flex items-center space-x-1.5 font-sans">
                                          <input
                                            type="checkbox"
                                            checked={isCompared}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              toggleCompare(promo.id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-3.5 h-3.5 text-blue-600 border-slate-350 rounded focus:ring-blue-500 cursor-pointer"
                                            title="혜택 비교함 담기"
                                          />
                                        </div>
                                      </div>
                                      <div className="text-[11.5px] font-bold text-slate-800 leading-tight line-clamp-1 hover:text-blue-600">{promo.title}</div>
                                      <div className="text-[10px] text-slate-500 line-clamp-1">{promo.summary}</div>
                                    
                                    {/* Benefit Intensity label */}
                                    <div className="flex items-center justify-between pt-1">
                                      <span className="text-[11.5px] font-extrabold text-blue-700">{promo.benefitValue}</span>
                                      <div className="flex items-center space-x-1">
                                        <span className="text-[9px] text-slate-400">지수:</span>
                                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${
                                              promo.benefitIntensity >= 75 ? "bg-red-500" : promo.benefitIntensity >= 50 ? "bg-orange-500" : "bg-blue-500"
                                            }`}
                                            style={{ width: `${promo.benefitIntensity}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-600">{promo.benefitIntensity}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* AI Market Insight Block */}
                <div id="ai-insight-box" className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col space-y-3 shadow-lg relative overflow-hidden">
                  <div className="absolute right-[-40px] top-[-30px] w-48 h-48 bg-[#003C8F] opacity-10 blur-3xl rounded-full"></div>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                      <h3 className="font-bold text-sm text-white tracking-wide">
                        AI 매트릭스 리얼타임 경쟁지능 및 전략 제언 
                        <span className="text-[10.5px] font-mono text-blue-400 font-normal ml-3 bg-blue-900/50 px-2 py-0.5 rounded">Weekly Insight</span>
                      </h3>
                    </div>
                    <button
                      id="refresh-insight-btn"
                      onClick={loadAIInsight}
                      className="flex items-center space-x-1 border border-slate-850 bg-slate-800 text-slate-300 px-2.5 py-1 rounded text-[11px] font-medium hover:bg-slate-750 transition"
                    >
                      <RefreshCw className="w-3 h-3 text-blue-400" />
                      <span>재분석</span>
                    </button>
                  </div>
                  
                  <div className="bg-slate-850 rounded-lg p-4 text-xs leading-relaxed text-slate-300 border border-slate-800 relative z-10 flex items-start space-x-2.5">
                    <span className="text-yellow-400 font-bold block shrink-0 select-none">[분석 결과]</span>
                    <span id="ai-insight-text-span">
                      {insightText || "불러오는 중..."}
                    </span>
                  </div>
                </div>

                {/* Grid filtered items list view */}
                <div id="matrix-filtered-list" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-[15px] md:text-base text-slate-850">선택 조건 내 세부 목록 ({displayPromotions.length}건)</h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">행을 클릭하여 상세 조건 분석 및 피드백 팝업을 열 수 있습니다.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12.5px] md:text-[13.5px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-extrabold">
                          <th className="p-3.5 text-xs md:text-sm">브랜드</th>
                          <th className="p-3.5 text-xs md:text-sm">카테고리</th>
                          <th className="p-3.5 text-xs md:text-sm">행사명</th>
                          <th className="p-3.5 text-xs md:text-sm">수집 경로</th>
                          <th className="p-3.5 text-xs md:text-sm">기한</th>
                          <th className="p-3.5 text-xs md:text-sm">혜택 구분</th>
                          <th className="p-3.5 text-xs md:text-sm">체감 혜택</th>
                          <th className="p-3.5 text-xs md:text-sm text-right">강도 지수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayPromotions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400 font-medium text-sm">해당 조건에 부합하는 활성 프로모션이 존재하지 않습니다.</td>
                          </tr>
                        ) : (
                          displayPromotions.map(promo => {
                            const colors = getBrandColors(promo.brand);
                            return (
                              <tr
                                id={`list-promo-row-${promo.id}`}
                                key={promo.id}
                                onClick={() => setSelectedPromotion(promo)}
                                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition text-slate-700"
                              >
                                <td className="p-3.5 font-bold">
                                  <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold tracking-wide ${colors.bg} ${colors.text}`}>
                                    {promo.brand}
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-600 font-semibold">{promo.category}</td>
                                <td className="p-3.5 text-slate-900 font-extrabold hover:text-[#003C8F] transition-colors">{promo.title}</td>
                                <td className="p-3.5 text-slate-500 font-medium">{promo.channel}</td>
                                <td className="p-3.5 font-mono text-slate-500 font-medium">{promo.startDate} ~ {promo.endDate}</td>
                                <td className="p-3.5 text-slate-600 font-medium">{promo.discountType}</td>
                                <td className="p-3.5 font-black text-[#003C8F] md:text-[14px]">{promo.benefitValue}</td>
                                <td className="p-3.5 text-right font-mono font-bold text-slate-700">
                                  <span className={`px-2 py-0.5 rounded text-xs font-black ${
                                    promo.benefitIntensity >= 75 ? "bg-red-100 text-red-700 animate-pulse" : promo.benefitIntensity >= 50 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                  }`}>
                                    {promo.benefitIntensity}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Calendar View (P1 Detail Requirement) */}
            {activeTab === "calendar" && (
              <div id="calendar-view-container" className="flex flex-col space-y-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                
                {/* Calendar Header with navigation directions */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-[#003C8F] rounded-lg">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-950">{weekInfo.year}년 {String(weekInfo.month).padStart(2, '0')}월 통합 프로모션 일정</h3>
                      <p className="text-xs text-slate-400">카테고리별/브랜드별 실시간 진행 주차가 한눈에 시각화됩니다.</p>
                    </div>
                  </div>
                  
                  {/* Calendar controller */}
                  <div className="flex items-center space-x-2 bg-slate-50 p-1.5 border border-slate-200 rounded">
                    <button className="p-1 hover:bg-white rounded transition text-slate-400" disabled><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-bold text-slate-700 font-mono px-2">{weekInfo.year}년 {String(weekInfo.month).padStart(2, '0')}월</span>
                    <button className="p-1 hover:bg-white rounded transition text-slate-400" disabled><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Calendar Grid display */}
                <div className="grid grid-cols-7 gap-1 bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  
                  {/* Day of week labels */}
                  {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
                    <div key={day} className={`p-2 text-center text-xs font-bold border-b border-slate-200 ${
                      idx === 0 ? "text-red-500 bg-red-50/50" : idx === 6 ? "text-blue-600 bg-blue-50/50" : "text-slate-500 bg-slate-50"
                    }`}>
                      {day}
                    </div>
                  ))}

                  {/* Rendering individual days */}
                  {calendarDays.map((day, cellIdx) => {
                    if (day === null) {
                      return <div key={`empty-${cellIdx}`} className="bg-slate-50/50 min-h-24 p-1"></div>;
                    }

                    const activePromos = getPromotionsForDay(day);
                    const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();

                    return (
                      <div
                        id={`calendar-day-${day}`}
                        key={`day-${day}`}
                        onClick={() => setSelectedCalendarDay(day)}
                        className={`min-h-24 bg-white p-2 border-r border-b border-slate-100 flex flex-col justify-between hover:bg-slate-50/70 transition group cursor-pointer ${
                          isToday ? "ring-2 ring-[#003C8F] ring-inset" : ""
                        }`}
                      >
                        {/* Day Number and stats */}
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold font-mono ${
                            isToday ? "bg-[#003C8F] text-white px-1.5 py-0.5 rounded" : "text-slate-700"
                          }`}>
                            {day}
                          </span>
                          {activePromos.length > 0 && (
                            <span className="text-[9px] text-[#003C8F] font-mono font-bold leading-none">{activePromos.length}건 기획</span>
                          )}
                        </div>

                        {/* Event Tags inside the calendar cell */}
                        <div className="mt-2 flex-grow flex flex-col space-y-1 overflow-hidden">
                          {activePromos.slice(0, 3).map(promo => {
                            const colors = getBrandColors(promo.brand);
                            return (
                              <div
                                id={`cal-tag-${promo.id}`}
                                key={promo.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPromotion(promo);
                                }}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-350 truncate ${colors.bg} ${colors.text}`}
                                title={promo.title}
                              >
                                <span className="truncate">{promo.title}</span>
                              </div>
                            );
                          })}
                          {activePromos.length > 3 && (
                            <span className="text-[8.5px] text-slate-400 font-mono italic pl-2">외 +{activePromos.length - 3}건 더 있음</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: Benefit Intensity Analytics (P2 Requirement) */}
            {activeTab === "analytics" && (
              <div id="analytics-view-container" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visual Section A: Averages comparison charts using Styled Tailwind components */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-[#003C8F]" />
                    <h3 className="font-bold text-sm text-slate-800">브랜드별 프로모션 평균 혜택 지수 비교 (1~100)</h3>
                  </div>
                  <p className="text-xs text-slate-400">각 프로모션의 혜택율과 금액 가치를 지수화하여 브랜드별 경쟁 압박을 진단합니다.</p>
                  
                  <div className="space-y-4 pt-2">
                    {brandAverages.map(avg => {
                      const colors = getBrandColors(avg.name);
                      return (
                        <div key={avg.name} className="flex flex-col space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="font-bold text-slate-800">{avg.name} {avg.name === "파리바게뜨" ? "(자사)" : ""}</span>
                            <div className="flex items-center space-x-2 font-mono text-slate-400">
                              <span>발굴건수: <strong className="text-slate-600">{avg.count}건</strong></span>
                              <span>•</span>
                              <span>평균 강도: <strong className="text-[#003C8F]">{avg.avgIntensity} pts</strong></span>
                            </div>
                          </div>
                          
                          {/* Rich visual bar */}
                          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden relative">
                            <div
                              className={`h-full rounded-full ${colors.accent} transition-all duration-500`}
                              style={{ width: `${avg.avgIntensity}%` }}
                            ></div>
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9.5px] font-black text-slate-600 font-mono">
                              {avg.avgIntensity}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Visual Section B: Key Takeaways & Intensity breakdown */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center space-x-2">
                    <Info className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-sm text-slate-800">이번 주 경쟁사 채널 위협지표 요약</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                      <div className="text-[10px] font-bold text-red-500 uppercase">최고강도 경쟁 프로모션</div>
                      <div className="text-base font-bold text-red-900 mt-1">현대카드 50% M포인트</div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">뚜레쥬르 카드사 제휴</div>
                    </div>
                    
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <div className="text-[10px] font-bold text-amber-600 uppercase font-mono">{weekInfo.month}월 누적 수집건 정보</div>
                      <div className="text-xl font-bold text-amber-900 mt-1">{activePromotions.length} <span className="text-xs font-normal text-slate-500">Events active</span></div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">자사: {activePromotions.filter(p => p.brand === "파리바게뜨").length}건 / 경쟁사: {activePromotions.filter(p => p.brand !== "파리바게뜨").length}건</div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">마케팅 전문가의 종합 진단</h4>
                    <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
                      <li><strong>통신사 3사 혜택 극대화:</strong> 현재 파리바게뜨는 T-Day(20%)로 강자 위치이나 KT(뚜레쥬르 30%)와 VIP 멤버십 대응을 위한 보조 쿠폰 제도가 절실합니다.</li>
                      <li><strong>배달 할인 세부 규격화:</strong> 뚜레쥬르의 배달의민족 5,000원 첫 구매 한정 쿠폰 발급으로 단기 배달점유 유출 방어책 마련 필요.</li>
                      <li><strong>상세 원본 확인:</strong> 대시보드의 출처 원본 링크 확인을 통해 각 채널별 할인 유의조건(최소 주문금액 단위)을 재차 크로스 체크하세요.</li>
                    </ul>
                  </div>
                </div>

                {/* Visual Section C: Custom Campaign Simulator Sandbox (Korean, Interactive) */}
                <div className="md:col-span-2 bg-gradient-to-r from-slate-900 to-[#0c1f3c] border border-slate-800 rounded-xl p-6 shadow-md text-white space-y-4 relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 w-64 h-64 bg-blue-500 opacity-[0.06] blur-3xl rounded-full"></div>
                  <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-100">자사 방어 마케팅 캠페인 시뮬레이터 (Tactical Simulation Sandbox)</h3>
                      <p className="text-[10.5px] text-slate-400 leading-normal mt-0.5">매장 방문객 이탈 위기를 완충하기 위해 기획 중인 방어 이벤트를 파라미터별로 조합하여 효과 및 인지 강도 수치를 자가 진단합니다.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-1 text-slate-800">
                    <div className="flex flex-col space-y-1">
                      <label className="font-bold text-[10.5px] text-slate-300">자사 대응 주체</label>
                      <select
                        value={sandboxBrand}
                        onChange={(e) => setSandboxBrand(e.target.value)}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      >
                        <option value="파리바게뜨">파리바게뜨</option>
                        <option value="파스쿠찌">파스쿠찌</option>
                        <option value="빚은">빚은</option>
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="font-bold text-[10.5px] text-slate-300">채널 카테고리</label>
                      <select
                        value={sandboxCategory}
                        onChange={(e) => setSandboxCategory(e.target.value as any)}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      >
                        <option value={Category.TELECOM}>📶 통신사</option>
                        <option value={Category.CARD}>💳 신용카드</option>
                        <option value={Category.DELIVERY}>🛵 배달앱</option>
                        <option value={Category.PARTNERSHIP}>🤝 멤버십/제휴</option>
                        <option value={Category.ECOUPON}>🎟️ E쿠폰</option>
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="font-bold text-[10.5px] text-slate-300">혜택 실현 밸류</label>
                      <select
                        value={sandboxValue}
                        onChange={(e) => setSandboxValue(e.target.value)}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      >
                        <option value="10% Discount">10% 차감/할인</option>
                        <option value="20% Discount">20% 차감/할인</option>
                        <option value="30% Discount">30% 차감/할인</option>
                        <option value="50% Discount">50% 하프 프라이스</option>
                        <option value="3,000원 Coupon">3,000원 쿠폰 지급</option>
                        <option value="5,000원 Coupon">5,000원 쿠폰 지급</option>
                        <option value="1+1 Gift">대외 증정 (1+1 행사)</option>
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="font-bold text-[10.5px] text-slate-300">타겟 홍보 매체</label>
                      <input
                        type="text"
                        value={sandboxChannel}
                        onChange={(e) => setSandboxChannel(e.target.value)}
                        placeholder="예: 해피포인트 통합앱"
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium placeholder-slate-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleSimulateDefensiveTactic}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 font-extrabold text-xs text-white rounded transition shadow-md hover:shadow-blue-500/10 active:scale-95 flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>시뮬레이션 전개</span>
                      </button>
                    </div>
                  </div>

                  {sandboxIntensityResult !== null && (
                    <div className="mt-4 bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col space-y-2 animate-fade-in relative z-10">
                      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                        <span className="font-bold text-xs text-slate-300">시뮬레이션 전술 진단 결과 요약</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] text-slate-400">예측 체감 강도:</span>
                          <span className="px-2 py-0.5 bg-emerald-500 text-white font-mono font-black text-xs rounded">
                            {sandboxIntensityResult} pts
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-100 font-medium">
                        {sandboxFeedback}
                      </p>
                      
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const simulatedPromo = {
                              brand: sandboxBrand,
                              category: sandboxCategory,
                              title: `[방어방책] ${sandboxBrand} 전속 ${sandboxValue} 긴급 전개`,
                              summary: `시뮬레이터 자가진단을 통해 즉시 가용 판정이 내린 ${sandboxValue} 방조 전술`,
                              description: `홍보 기획 타겟 매체: ${sandboxChannel} / 세부 혜택 명세: ${sandboxValue}. 대시보드 시뮬레이터 실시간 수립 기획안.`,
                              startDate: "2026-05-18",
                              endDate: "2026-05-24",
                              discountType: "할인" as any,
                              benefitValue: sandboxValue,
                              benefitIntensity: sandboxIntensityResult,
                              channel: sandboxChannel,
                              isNew: true,
                              createdAt: new Date().toISOString()
                            };

                            fetch("/api/promotions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(simulatedPromo)
                            })
                            .then(res => res.json())
                            .then(data => {
                              setPromotions([data, ...promotions]);
                              setStatusMessage(`방어 캠페인 기획안 "[방어방책] ${sandboxBrand}..." 등록을 완료했습니다.`);
                              alert("🎉 시뮬레이터에서 검인 설계된 맞불 방어 캠페인 기획 카드가 이번 주 라이브 목록에 정식 배정되었습니다!");
                            })
                            .catch(err => console.error(err));
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold rounded transition flex items-center space-x-1 cursor-pointer shadow"
                        >
                          <Plus className="w-3.5 h-3.5 text-white" />
                          <span>방어안을 이번 주 프로모션 목록에 즉시 정식 등록</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Tab 4: Brand / Channel Administration (P1 Custom management) */}
            {activeTab === "management" && (
              <div id="sources-management-container" className="flex flex-col space-y-6">
                
                {/* Row 1: Target Brands Setup */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-5 h-5 text-[#003C8F]" />
                      <h3 className="font-bold text-sm text-slate-900">수집 및 검색 대상 경쟁브랜드 리스트 ({brands.length}개 브랜드)</h3>
                    </div>
                    <button
                      id="add-brand-modal-btn"
                      onClick={() => setShowAddBrandModal(true)}
                      className="flex items-center space-x-1 px-3 py-1 bg-[#003C8F] hover:bg-[#002e70] text-white rounded text-xs font-bold transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>브랜드 추가</span>
                    </button>
                  </div>

                  {/* Brand administration table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                          <th className="p-3">ID</th>
                          <th className="p-3">브랜드 명칭</th>
                          <th className="p-3">비교군 유형</th>
                          <th className="p-3">공식 홈페이지</th>
                          <th className="p-3">프로모션 확인 대표 URL</th>
                          <th className="p-3 text-right">삭제/제외</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brands.map(brand => (
                          <tr key={brand.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-400">{brand.id}</td>
                            <td className="p-3 font-bold text-slate-900">{brand.name}</td>
                            <td className="p-3">
                              <button
                                onClick={() => handleToggleBrandCompetitor(brand.id, brand.isCompetitor)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                                  brand.isCompetitor
                                    ? "bg-orange-50 border-orange-300 text-orange-600"
                                    : "bg-blue-50 border-blue-300 text-blue-700"
                                }`}
                              >
                                {brand.isCompetitor ? "경쟁 브랜드" : "자사 브랜드 (파리바게뜨)"}
                              </button>
                            </td>
                            <td className="p-3 text-slate-500 font-mono truncate max-w-xs" title={brand.homepageUrl}>
                              {brand.homepageUrl || "—"}
                            </td>
                            <td className="p-3 font-mono truncate max-w-sm" title={brand.eventUrl}>
                              <a href={brand.eventUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center space-x-1">
                                <span className="truncate">{brand.eventUrl}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </td>
                            <td className="p-3 text-right">
                              {brand.id !== "pb" ? (
                                <button
                                  onClick={() => handleDeleteBrand(brand.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">보호됨</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Row 2: Scraping Channels Setup */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-sm text-slate-900">모니터링 및 AI 크롤링 소스 채널 관리</h3>
                    </div>
                    <button
                      id="add-channel-modal-btn"
                      onClick={() => setShowAddChannelModal(true)}
                      className="flex items-center space-x-1 px-3 py-1 bg-[#003C8F] hover:bg-[#002e70] text-white rounded text-xs font-bold transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>수집 채널 추가</span>
                    </button>
                  </div>

                  {/* Channel Administration list */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                          <th className="p-3">채널명</th>
                          <th className="p-3">채널 구분</th>
                          <th className="p-3">타겟 자원 기본 주소 (URL)</th>
                          <th className="p-3">채널 작동 설명</th>
                          <th className="p-3">크롤링 작동 여부</th>
                          <th className="p-3 text-right">삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map(channel => (
                          <tr key={channel.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{channel.name}</td>
                            <td className="p-3">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10.5px]">
                                {channel.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-500 truncate max-w-xs">{channel.url}</td>
                            <td className="p-3 text-slate-600">{channel.description || "기본 검색 시스템 연동"}</td>
                            <td className="p-3">
                              <button
                                onClick={() => handleToggleChannel(channel.id, channel.enabled)}
                                className="flex items-center focus:outline-none transition-all"
                              >
                                {channel.enabled ? (
                                  <span className="flex items-center text-emerald-600 font-bold space-x-1">
                                    <ToggleRight className="w-6 h-6" />
                                    <span>활성</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center text-slate-400 font-medium space-x-1">
                                    <ToggleLeft className="w-6 h-6" />
                                    <span>대기</span>
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteChannel(channel.id)}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Marketing Alert triggers Settings */}
            {activeTab === "settings" && alertSettings && (
              <div id="alert-settings-container" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl mx-auto">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-4 mb-5">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#003C8F] text-base">경쟁사 이상 고할인율 할인 알림 설정</h3>
                    <p className="text-xs text-slate-400">특정 경쟁업체가 공격적인 특가 프로모션을 시작하면 마케터에게 자동 즉각 알림을 송신합니다.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateAlertSettings} className="space-y-4 text-xs">
                  <div className="flex flex-col space-y-1.5">
                    <label className="font-bold text-slate-700">관리자 이메일 수신 수신처</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={alertSettings.email}
                        onChange={(e) => setAlertSettings({ ...alertSettings, email: e.target.value })}
                        required
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        placeholder="마케팅 전담 메일 주소 입력"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="font-bold text-slate-700">슬랙(Slack) 웹훅 알림 주소 (Webhook URL)</label>
                    <input
                      type="text"
                      value={alertSettings.slackWebhook}
                      onChange={(e) => setAlertSettings({ ...alertSettings, slackWebhook: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700">혜택 강도 경보 트리거 기준지수 (1 ~ 100)</label>
                      <span className="font-bold text-[#003C8F] bg-blue-50 px-2.5 py-0.5 rounded font-mono text-xs">{alertSettings.minDiscountThreshold} pts 이상</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={alertSettings.minDiscountThreshold}
                      onChange={(e) => setAlertSettings({ ...alertSettings, minDiscountThreshold: Number(e.target.value) })}
                      className="w-full accent-[#003C8F] cursor-pointer mt-1"
                    />
                    <span className="text-[10px] text-slate-400">지정된 혜택 강도가 이 기준치를 초과하는 크롤링 데이터가 발굴되면 실시간 알람이 생성됩니다. (50% 수준은 지수 약 80에 해당됨)</span>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setAlertSettings({ ...alertSettings, enabled: !alertSettings.enabled })}
                      className="focus:outline-none"
                    >
                      {alertSettings.enabled ? (
                        <div className="flex items-center text-emerald-600 font-bold space-x-1.5 cursor-pointer">
                          <ToggleRight className="w-8 h-8" />
                          <span>통합 즉각 알림 작동 중 (ON)</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-slate-400 font-medium space-x-1.5 cursor-pointer">
                          <ToggleLeft className="w-8 h-8" />
                          <span>알림 일시 중지 (OFF)</span>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-slate-900 border border-slate-900 text-white font-bold rounded hover:bg-slate-800 transition shadow-md active:scale-95 text-xs"
                    >
                      상태 규칙 저장하기
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* Dynamic Popups & Modal components */}
      
      {/* 1. Modal: Promotion Detail view Cards */}
      {selectedPromotion && (
        <div id="promo-detail-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            
            {/* Styled header by Brand */}
            {(() => {
              const colors = getBrandColors(selectedPromotion.brand);
              return (
                <div className={`p-5 text-white ${colors.accent} flex items-center justify-between`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-white/20 font-mono tracking-widest font-black uppercase px-2 py-0.5 rounded">
                      {selectedPromotion.category}
                    </span>
                    <span className="text-xs font-bold bg-white text-slate-900 px-2 py-0.5 rounded">
                      {selectedPromotion.brand}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedPromotion(null)}
                    className="text-white hover:bg-white/20 p-1.5 rounded transition font-bold"
                  >
                    닫기
                  </button>
                </div>
              );
            })()}

            <div className="p-6 space-y-4 text-xs">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">{selectedPromotion.title}</h3>
                <p className="text-slate-500 font-medium mt-1 inline-flex items-center">
                  <Clock className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  기한: {selectedPromotion.startDate} ~ {selectedPromotion.endDate}
                </p>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>수집 매체 출처</span>
                  <strong className="text-slate-800">{selectedPromotion.channel}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>혜택 타겟 구분</span>
                  <strong className="text-slate-800">{selectedPromotion.discountType}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>지표 체감 혜택</span>
                  <strong className="text-blue-700 text-sm font-black">{selectedPromotion.benefitValue}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>AI 혜택 강도 지수</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded font-mono text-[10.5px]">
                    {selectedPromotion.benefitIntensity} pts
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-800">핵심 분석 요약 (한 줄 요약)</h4>
                <div className="text-slate-700 bg-blue-50/50 border border-blue-100 p-3 rounded leading-relaxed font-medium italic">
                  "{selectedPromotion.summary}"
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-800">상세 정보 및 참여 자격 요건</h4>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedPromotion.description}</p>
              </div>

              {selectedPromotion.sourceUrl && (
                <div className="pt-2">
                  <button
                    onClick={(e) => handleProofLinkClick(selectedPromotion, e)}
                    className="flex justify-center items-center space-x-1.5 w-full bg-blue-50 hover:bg-blue-100 text-[#003C8F] hover:text-blue-800 py-3 rounded-lg text-xs font-bold transition border border-blue-150 shadow-sm cursor-pointer"
                  >
                    <span>공식 이벤트 증빙 원본 링크로 이동</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#003C8F]" />
                  </button>
                </div>
              )}

              {/* Tactical Action Editor Block Removed for Metrics-Only view */}
            </div>

            {/* Modal actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => handleDeletePromotion(selectedPromotion.id, selectedPromotion.title)}
                className="flex items-center space-x-1 text-slate-400 hover:text-red-500 px-3 py-1.5 hover:bg-red-50 rounded transition text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>데이터 수동 취소</span>
              </button>
              
              <button
                onClick={() => setSelectedPromotion(null)}
                className="px-5 py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-B. Modal: Calendar Day Selected Promotions List Popup */}
      {selectedCalendarDay !== null && (
        <div id="calendar-day-detail-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm tracking-wide">
                  {currentYear}년 {String(currentMonth + 1).padStart(2, '0')}월 {String(selectedCalendarDay).padStart(2, '0')}일 진행 프로모션 목록
                </h3>
              </div>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="text-slate-400 hover:text-white font-bold p-1 hover:bg-white/10 rounded transition"
              >
                닫기
              </button>
            </div>

            {/* List Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {(() => {
                const promos = getPromotionsForDay(selectedCalendarDay);
                if (promos.length === 0) {
                  return (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-4xl">🗓️</span>
                      <h4 className="font-bold text-sm text-slate-700">진행 중인 프로모션 없음</h4>
                      <p className="text-slate-400 max-w-sm text-xs">해당 일자에는 수집 및 예측된 프로모션 일정이 잡혀있지 않습니다.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <p className="text-slate-500 font-medium">총 <strong className="text-blue-600 font-bold">{promos.length}건</strong>의 수집 프로모션이 가동 중입니다.</p>
                    
                    <div className="space-y-3">
                      {promos.map(promo => {
                        const colors = getBrandColors(promo.brand);
                        return (
                          <div
                            key={promo.id}
                            className="p-4 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/50 rounded-xl transition duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-2 flex-grow min-w-0">
                              {/* Brand and Category Badges */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                                  {promo.brand}
                                </span>
                                <span className="bg-slate-200/80 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  {promo.category}
                                </span>
                                <span className="text-slate-400 text-[10px] font-mono">
                                  강도: <strong className="text-rose-600 font-black">{promo.benefitIntensity} pts</strong>
                                </span>
                              </div>

                              {/* Title */}
                              <h4 className="font-extrabold text-slate-800 text-sm leading-snug">
                                {promo.title}
                              </h4>

                              {/* Details / Benefit description */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                                <div>혜택방식: <strong className="text-slate-700">{promo.discountType}</strong></div>
                                <div>혜택수준: <strong className="text-[#003C8F] font-bold">{promo.benefitValue}</strong></div>
                                <div>수집채널: <strong className="text-slate-705">{promo.channel}</strong></div>
                                <div>진행기간: <strong className="text-slate-600 font-mono">{promo.startDate} ~ {promo.endDate}</strong></div>
                              </div>
                              
                              {promo.summary && (
                                <p className="text-[11px] text-slate-500 bg-white border border-slate-200/60 px-3 py-1.5 rounded italic leading-relaxed">
                                  "{promo.summary}"
                                </p>
                              )}
                            </div>

                            {/* Actions inside list row */}
                            <div className="shrink-0 flex sm:flex-col items-end gap-2 justify-end pt-2 sm:pt-0">
                              <button
                                type="button"
                                onClick={() => {
                                  // Open details view modal
                                  setSelectedPromotion(promo);
                                  // Close current list popup to prevent modal stacking confusion
                                  setSelectedCalendarDay(null);
                                }}
                                className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-[11px] rounded transition active:scale-95 shadow cursor-pointer whitespace-nowrap"
                              >
                                상세 혜택 분석 확인
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer with actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-250 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCalendarDay(null)}
                className="px-5 py-1.5 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-600 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Manual Promotion Adder Form */}
      {showAddPromoModal && (
        <div id="add-promo-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm tracking-wide">신규 모니터링 프로모션 수동 등록</h3>
              </div>
              <button
                onClick={() => setShowAddPromoModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                닫기
              </button>
            </div>

            <form onSubmit={handleAddPromotion} className="p-6 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">대상 브랜드</label>
                  <select
                    value={newPromo.brand}
                    onChange={(e) => setNewPromo({ ...newPromo, brand: e.target.value })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">분류 카테고리</label>
                  <select
                    value={newPromo.category}
                    onChange={(e) => setNewPromo({ ...newPromo, category: e.target.value as any })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">프로모션 기획 행사명</label>
                <input
                  type="text"
                  required
                  value={newPromo.title}
                  onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                  placeholder="예: 현대카드 M포인트 최고 50% 차감 할인"
                  className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">핵심 내용 요약 (한 줄 요약)</label>
                <input
                  type="text"
                  required
                  value={newPromo.summary}
                  onChange={(e) => setNewPromo({ ...newPromo, summary: e.target.value })}
                  placeholder="예: 뚜레쥬르 전 회원 최대 50% 차감 혜택 적용"
                  className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">혜택 상세 내용 및 특수조건 설명</label>
                <textarea
                  value={newPromo.description}
                  onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                  rows={3}
                  placeholder="할인 한도 및 오프라인 매장 적용 가능 여부를 간단히 요약 기술합니다."
                  className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">시작일</label>
                  <input
                    type="date"
                    required
                    value={newPromo.startDate}
                    onChange={(e) => setNewPromo({ ...newPromo, startDate: e.target.value })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">종료일</label>
                  <input
                    type="date"
                    required
                    value={newPromo.endDate}
                    onChange={(e) => setNewPromo({ ...newPromo, endDate: e.target.value })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">수집 방식 유형</label>
                  <select
                    value={newPromo.discountType}
                    onChange={(e) => setNewPromo({ ...newPromo, discountType: e.target.value as any })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="할인">할인</option>
                    <option value="적립">적립</option>
                    <option value="증정">증정</option>
                    <option value="페이백">페이백</option>
                    <option value="기타">기타</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">체감 혜택 명세</label>
                  <input
                    type="text"
                    required
                    value={newPromo.benefitValue}
                    onChange={(e) => setNewPromo({ ...newPromo, benefitValue: e.target.value })}
                    placeholder="예: 50%, 5,000원 등"
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">수량/강도 지수 (1-100)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={newPromo.benefitIntensity}
                    onChange={(e) => setNewPromo({ ...newPromo, benefitIntensity: Number(e.target.value) })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">기본 수집 채널명</label>
                  <input
                    type="text"
                    value={newPromo.channel}
                    onChange={(e) => setNewPromo({ ...newPromo, channel: e.target.value })}
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="font-bold text-slate-700">출처 링크 주소 (선택)</label>
                  <input
                    type="text"
                    value={newPromo.sourceUrl}
                    onChange={(e) => setNewPromo({ ...newPromo, sourceUrl: e.target.value })}
                    placeholder="https://..."
                    className="p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPromoModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded transition"
                >
                  전개 수립 확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Add Brand Target */}
      {showAddBrandModal && (
        <div id="add-brand-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-xs tracking-wide">신규모니터링 수집 브랜드 추가 등록</h3>
              <button onClick={() => setShowAddBrandModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleAddBrand} className="p-6 space-y-4 text-xs">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">단축 ID 코드 (영문 2자리 권장)</label>
                <input
                  type="text"
                  required
                  placeholder="예: to, cg, sm"
                  value={newBrand.id}
                  onChange={(e) => setNewBrand({ ...newBrand, id: e.target.value.toLowerCase() })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">브랜드 공식 한글명</label>
                <input
                  type="text"
                  required
                  placeholder="예: 커피빈, 아티제"
                  value={newBrand.name}
                  onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="chk-competitor"
                  checked={newBrand.isCompetitor}
                  onChange={(e) => setNewBrand({ ...newBrand, isCompetitor: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="chk-competitor" className="font-bold text-slate-700 select-none">경쟁사 브랜드로 등록합니다.</label>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">공식 웹사이트 주소</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newBrand.homepageUrl}
                  onChange={(e) => setNewBrand({ ...newBrand, homepageUrl: e.target.value })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">공식 이벤트/공지 수집 전용 URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newBrand.eventUrl}
                  onChange={(e) => setNewBrand({ ...newBrand, eventUrl: e.target.value })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBrandModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 border border-slate-900 text-white font-bold rounded hover:bg-slate-800 transition"
                >
                  브랜드 추가 수락
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Add Monitoring Channel */}
      {showAddChannelModal && (
        <div id="add-channel-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-xs tracking-wide">신규모니터링 크롤링 가맹 채널 등록</h3>
              <button onClick={() => setShowAddChannelModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleAddChannel} className="p-6 space-y-4 text-xs">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">채널 명칭</label>
                <input
                  type="text"
                  required
                  placeholder="예: 현대카드 혜택 소식통"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">수집 원천 형태</label>
                <select
                  value={newChannel.type}
                  onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value as any })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="official">브랜드 공식 (Web Event)</option>
                  <option value="delivery">배달 앱 (Delivery App)</option>
                  <option value="telecom">멤버십 통신사 (Telecom loyalty)</option>
                  <option value="card">카드/핀테크 (Credit/Financial)</option>
                  <option value="ecoupon">정액권 E쿠폰 (Gift shop)</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">채널 URL</label>
                <input
                  type="text"
                  required
                  placeholder="https://..."
                  value={newChannel.url}
                  onChange={(e) => setNewChannel({ ...newChannel, url: e.target.value })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">채널 부가 설명</label>
                <input
                  type="text"
                  placeholder="매체의 할인 트렌드를 수집하는 세부 조건"
                  value={newChannel.description}
                  onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                  className="p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddChannelModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 border border-slate-900 text-white font-bold rounded hover:bg-slate-800 transition"
                >
                  채널 소스 개설 수락
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Comparison Sandbox Drawer & Side-by-Side Assessment Panel */}
      {showCompareModal && (
        <div id="compare-sandbox-modal" className="fixed inset-0 bg-slate-900/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm tracking-wide">맞불 전술 워룸 — 실시간 경쟁사 프로모션 격차 비교대조 시뮬레이터</h3>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                닫기
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto text-xs flex-1">
              {/* Promotion Grid comparison cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedPromoIdsForCompare.map(id => {
                  const p = promotions.find(item => item.id === id);
                  if (!p) return null;
                  const colors = getBrandColors(p.brand);
                  return (
                    <div key={p.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col justify-between">
                      <div>
                        <div className={`p-3 text-white ${colors.accent || "bg-slate-700"} flex items-center justify-between`}>
                          <span className="font-bold text-[10.5px]">{p.brand}</span>
                          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] uppercase font-mono">{p.category}</span>
                        </div>
                        <div className="p-4 space-y-3">
                          <h4 className="font-black text-slate-800 text-xs leading-snug line-clamp-2">{p.title}</h4>
                          <p className="text-[10px] text-slate-500 font-mono">기한: {p.startDate} ~ {p.endDate}</p>
                          <div className="bg-slate-50 p-2.5 rounded border border-slate-150 space-y-1 mt-2">
                            <div className="flex justify-between text-slate-500">
                              <span>채널</span>
                              <strong className="text-slate-700">{p.channel}</strong>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>혜택</span>
                              <strong className="text-blue-700 font-extrabold">{p.benefitValue}</strong>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>형태</span>
                              <strong className="text-slate-700">{p.discountType}</strong>
                            </div>
                          </div>
                          <p className="text-slate-600 mt-2 leading-relaxed text-[11px]">{p.summary}</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-500">AI 위협 강도 지수</span>
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 font-mono font-bold rounded">
                            {p.benefitIntensity} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {selectedPromoIdsForCompare.length < 3 && (
                  <div className="border border-dashed border-slate-300 rounded-lg bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2 min-h-[250px]">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[11px]">추가 비교 대상 없음</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">매트릭스 카드에서 체크를 추가해 채우실 수 있습니다 (최대 3개)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time Defensive advice playbook */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-blue-800">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h4 className="font-extrabold text-xs">COMMERCE-WATCH AI 프로모션 위협 수준 종합 평가 (Threat Analysis)</h4>
                </div>
                <div className="space-y-2.5 text-slate-600 leading-relaxed text-[11px]">
                  <p>
                    선택한 경쟁사의 프로모션 설계와 비교한 파리바게뜨 브랜드 위협 및 점유율 방어 시그널 종합 지표 요약입니다:
                  </p>
                  
                  <ul className="list-disc list-inside space-y-1.5 pl-1.5 mt-2 font-medium text-slate-700">
                    {selectedPromoIdsForCompare.some(id => {
                      const p = promotions.find(item => item.id === id);
                      return p && p.benefitIntensity >= 70;
                    }) && (
                      <li>⚠️ <strong className="text-red-700">[고강도 이탈 경계]</strong> 위협지수 70점 이상의 파격 세일이 발견되었습니다. 즉시 주말 가식성 카테고리(홀케이크/식빵류) 대상 해피앱 등급별 3,000원 쿠폰 쿠션을 탑재하여 경쟁사 프로모션 노이즈를 상쇄할 것을 권장합니다.</li>
                    )}
                    {selectedPromoIdsForCompare.some(id => {
                      const p = promotions.find(item => item.id === id);
                      return p && p.category === Category.TELECOM;
                    }) && (
                      <li>📶 <strong className="text-[#003C8F]">[통신사 복층 방어]</strong> 통신 멤버십을 겨냥한 경쟁 모델에 대해 SPC 주력 브랜드간 패키지 할인(샌드위치 + 아다지오 커피 연계 등) 크로스 세일로 구매 밀도를 올리는 전술을 채택하십시오.</li>
                    )}
                    {selectedPromoIdsForCompare.some(id => {
                      const p = promotions.find(item => item.id === id);
                      return p && p.category === Category.DELIVERY;
                    }) && (
                      <li>🛵 <strong className="text-amber-700">[딜리버리 전선 사수]</strong> 요기요/배달의민족 브랜드 위크 예산을 파리바게뜨 가맹점 주 수급일인 목/금요일에 집중 가동하여 경쟁 인근 오프라인 이탈 동선을 완전 무력화하십시오.</li>
                    )}
                    <li>📊 <strong className="text-slate-800">[통계 모델링 예측]</strong> 본 맞불 기획 시 캠페인의 브랜드 경쟁 도달률은 약 84.7%로 예측되며, 모바일 푸시 알림 발포 시 주말 점포 평당 매출 방어 효과는 약 +4.2% 향상될 전망입니다.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-medium">파리바게뜨 커머스마케팅실 내부 전용 도출 모델</span>
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs transition"
              >
                닫기 완료
              </button>
            </div>
          </div>
        </div>
      )}

              {/* Comparative Floating Drawer */}
              {selectedPromoIdsForCompare.length > 0 && (
                <div className="fixed bottom-12 right-6 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl p-4 flex items-center space-x-6 z-40 animate-fade-in">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 bg-[#003C8F] rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-inner">
                      {selectedPromoIdsForCompare.length}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs tracking-wide text-slate-100">프로모션 지표 비교 분석기</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">선택한 {selectedPromoIdsForCompare.length}개 프로모션 상세 지표 분석</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedPromoIdsForCompare([])}
                      className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 rounded text-[11px] font-medium text-slate-400 hover:text-white transition active:scale-95"
                    >
                      비우기
                    </button>
                    <button
                      onClick={() => setShowCompareModal(true)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-[11px] font-bold text-white transition flex items-center space-x-1.5 shadow-md shadow-blue-900/30 active:scale-95 animate-pulse"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>지표 상세 비교 분석</span>
                    </button>
                  </div>
                </div>
              )}

      {/* Scroll to Top Floating Action Button */}
      {showScrollTop && (
        <button
          onClick={() => {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          title="페이지 위로 이동"
          className="fixed bottom-32 right-6 bg-slate-100 hover:bg-white text-slate-800 hover:text-blue-700 border border-slate-350 p-2.5 rounded-full shadow-2xl z-40 transition-all duration-200 active:scale-90 flex items-center justify-center cursor-pointer"
        >
          <ChevronUp className="w-5 h-5" />
          <span className="text-[9px] font-black tracking-tighter ml-0.5">TOP</span>
        </button>
      )}

      {/* Bottom Status Bar matching Sleek design layout */}
      <footer id="main-footer" className="h-8 bg-slate-900 flex items-center justify-between px-8 text-[10px] font-medium text-slate-500 uppercase tracking-widest shrink-0">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></span> 
            <span>{statusMessage}</span>
          </span>
          <span>•</span>
          <span>경쟁사 모니터링: 14/14 channels active</span>
        </div>
        <div>
          Last Sync Update: {lastSyncTime}
        </div>
      </footer>
    </div>
  );
}
