import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const isCJS = typeof __dirname !== 'undefined';
const myDirname = isCJS ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const PORT = 3000;

// Setup directories
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial JSON file setups helper
const readJSONFile = (filename: string, defaultData: any) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultData;
  }
};

const writeJSONFile = (filename: string, data: any) => {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Date shifter utility to dynamically map any hardcoded 2026-05 date to the current week
const getDaysDifferenceFromEpoch = () => {
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

const shiftDateString = (dateStr: string, daysDiff: number) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const originalDate = new Date(dateStr);
  if (isNaN(originalDate.getTime())) return dateStr;
  
  const shiftedDate = new Date(originalDate.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  const y = shiftedDate.getFullYear();
  const m = String(shiftedDate.getMonth() + 1).padStart(2, '0');
  const r = String(shiftedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const shiftPromotionsDates = (promos: any[]) => {
  const d = new Date();
  const day = d.getDay();
  const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
  const currMonday = new Date(d.getFullYear(), d.getMonth(), diffToMon);
  currMonday.setHours(0, 0, 0, 0);
  const y = currMonday.getFullYear();
  const m = String(currMonday.getMonth() + 1).padStart(2, '0');
  const r = String(currMonday.getDate()).padStart(2, '0');
  const currMondayStr = `${y}-${m}-${r}`;

  const daysDiff = getDaysDifferenceFromEpoch();

  return promos.map((p: any) => {
    // Only shift if it's older than current week's Monday and matches original patterns
    if (p.startDate && p.startDate < currMondayStr && p.startDate.startsWith('2026-05')) {
      return {
        ...p,
        startDate: shiftDateString(p.startDate, daysDiff),
        endDate: shiftDateString(p.endDate, daysDiff),
        createdAt: shiftDateString(p.createdAt || p.startDate, daysDiff)
      };
    }
    return p;
  });
};

const shiftReviewsDates = (reviews: any) => {
  const daysDiff = getDaysDifferenceFromEpoch();
  const processList = (list: any[]) => {
    if (!list) return [];
    return list.map((item: any) => {
      if (item.date && item.date.startsWith('2026-05')) {
        return {
          ...item,
          date: shiftDateString(item.date, daysDiff)
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

// Initialize Gemini SDK safely
const getGeminiClient = (): GoogleGenAI | null => {
  const key = process.env.MY_GEMINI_KEY || process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'MY_GEMINI_KEY') {
    console.warn('Gemini API key is not set. AI features will fallback to static simulated values.');
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// API Endpoints: Brands
app.get('/api/brands', (req, res) => {
  const brands = readJSONFile('brands.json', []);
  res.json(brands);
});

app.post('/api/brands', (req, res) => {
  const brands = readJSONFile('brands.json', []);
  const newBrand = {
    id: req.body.id || `b_${Date.now()}`,
    name: req.body.name,
    isCompetitor: req.body.isCompetitor !== undefined ? req.body.isCompetitor : true,
    homepageUrl: req.body.homepageUrl || '',
    eventUrl: req.body.eventUrl || ''
  };
  brands.push(newBrand);
  writeJSONFile('brands.json', brands);
  res.status(201).json(newBrand);
});

app.put('/api/brands/:id', (req, res) => {
  const brands = readJSONFile('brands.json', []);
  const index = brands.findIndex((b: any) => b.id === req.params.id);
  if (index !== -1) {
    brands[index] = { ...brands[index], ...req.body };
    writeJSONFile('brands.json', brands);
    res.json(brands[index]);
  } else {
    res.status(404).json({ error: 'Brand not found' });
  }
});

app.delete('/api/brands/:id', (req, res) => {
  const brands = readJSONFile('brands.json', []);
  const filtered = brands.filter((b: any) => b.id !== req.params.id);
  writeJSONFile('brands.json', filtered);
  res.json({ success: true });
});

// API Endpoints: Monitoring Channels
app.get('/api/channels', (req, res) => {
  const channels = readJSONFile('channels.json', []);
  res.json(channels);
});

app.post('/api/channels', (req, res) => {
  const channels = readJSONFile('channels.json', []);
  const newChannel = {
    id: req.body.id || `ch_${Date.now()}`,
    name: req.body.name,
    type: req.body.type || 'official',
    url: req.body.url || '',
    description: req.body.description || '',
    enabled: req.body.enabled !== undefined ? req.body.enabled : true
  };
  channels.push(newChannel);
  writeJSONFile('channels.json', channels);
  res.status(201).json(newChannel);
});

app.put('/api/channels/:id', (req, res) => {
  const channels = readJSONFile('channels.json', []);
  const index = channels.findIndex((c: any) => c.id === req.params.id);
  if (index !== -1) {
    channels[index] = { ...channels[index], ...req.body };
    writeJSONFile('channels.json', channels);
    res.json(channels[index]);
  } else {
    res.status(404).json({ error: 'Channel not found' });
  }
});

app.delete('/api/channels/:id', (req, res) => {
  const channels = readJSONFile('channels.json', []);
  const filtered = channels.filter((c: any) => c.id !== req.params.id);
  writeJSONFile('channels.json', filtered);
  res.json({ success: true });
});

// API Endpoints: Alerts Settings
app.get('/api/alerts', (req, res) => {
  const alerts = readJSONFile('alerts.json', {
    id: 'cfg1',
    email: 'SaehimOH@gmail.com',
    slackWebhook: '',
    minDiscountThreshold: 45,
    enabled: true
  });
  res.json(alerts);
});

app.post('/api/alerts', (req, res) => {
  const current = readJSONFile('alerts.json', {});
  const updated = { ...current, ...req.body };
  writeJSONFile('alerts.json', updated);
  res.json(updated);
});

// API Endpoints: Promotions
app.get('/api/promotions', (req, res) => {
  const promotions = readJSONFile('promotions.json', []);
  res.json(shiftPromotionsDates(promotions));
});

app.post('/api/promotions', (req, res) => {
  const promotions = readJSONFile('promotions.json', []);
  const newPromo = {
    id: req.body.id || `p_${Date.now()}`,
    brand: req.body.brand,
    category: req.body.category,
    title: req.body.title,
    summary: req.body.summary || req.body.title,
    description: req.body.description || '',
    startDate: req.body.startDate || new Date().toISOString().split('T')[0],
    endDate: req.body.endDate || new Date().toISOString().split('T')[0],
    discountType: req.body.discountType || '기타',
    benefitValue: req.body.benefitValue || 'N/A',
    benefitIntensity: req.body.benefitIntensity || 50,
    channel: req.body.channel || '수동 등록',
    isNew: req.body.isNew !== undefined ? req.body.isNew : true,
    sourceUrl: req.body.sourceUrl || '',
    createdAt: new Date().toISOString().split('T')[0]
  };
  promotions.push(newPromo);
  writeJSONFile('promotions.json', promotions);
  res.status(201).json(newPromo);
});

app.delete('/api/promotions/:id', (req, res) => {
  const promotions = readJSONFile('promotions.json', []);
  const filtered = promotions.filter((p: any) => p.id !== req.params.id);
  writeJSONFile('promotions.json', filtered);
  res.json({ success: true });
});

app.put('/api/promotions/:id', (req, res) => {
  const promotions = readJSONFile('promotions.json', []);
  const index = promotions.findIndex((p: any) => p.id === req.params.id);
  if (index !== -1) {
    promotions[index] = { ...promotions[index], ...req.body };
    writeJSONFile('promotions.json', promotions);
    res.json(promotions[index]);
  } else {
    res.status(404).json({ error: 'Promotion not found' });
  }
});

app.get('/api/reviews', async (req, res) => {
  const brand = req.query.brand as string || '파리바게뜨';
  
  const defaultReviews: any = {
    brand: brand,
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

  if (brand.includes('뚜레쥬르')) {
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
  } else if (brand.includes('투썸플레이스')) {
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
  } else if (brand.includes('스타벅스')) {
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
  } else if (brand.includes('배스킨라빈스')) {
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

  // 1. Check local file cache first
  const cacheKey = brand.trim();
  const cachedData = readJSONFile('reviews_cache.json', {});
  if (cachedData[cacheKey]) {
    console.log(`[Reviews Cache] Hit for brand "${brand}"`);
    return res.json(shiftReviewsDates(cachedData[cacheKey]));
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json(shiftReviewsDates(defaultReviews));
  }

  try {
    const prompt = `
당신은 대한민국의 유명 외식 브랜드 전문 빅데이터 오피니언 애널리스트 연구원입니다.
현재 검색 대상 브랜드는 "${brand}" 입니다.

해당 브랜드의 최근 베이커리/카페 프로모션, 제휴사 할인, 배달 이벤트 등에 대한 실제 국내 주부, 직장인, MZ세대 소비자들의 SNS(블로그, 인스타그램, 뽐뿌, 요기요/배민 리뷰, 디시인사이드 식음료 갤러리) 상의 실시간 여론 및 반응을 수집 및 감성 요약하여 JSON 형식으로 반환해야 합니다.

실질적이고 생생한 한국어 리뷰를 긍정적 반응 5개, 부정적 반응 5개로 추려서 다음 스키마에 정교하게 채워주세요. (줄바꿈이 없는 깔끔한 구어체, 실제 닉네임 형식 마스킹 사용):

{
  "brand": "${brand}",
  "positive": [
    { "id": "p1", "user": "사용자명마스킹", "content": "긍정적인 구체적 리뷰 내용 (이벤트 혜택이 좋았던 점 등)", "date": "2026-05-20", "rating": 5 },
    { "id": "p2", "user": "다이어터**", "content": "포인트 혜택이나 건강함과 가격 합리성에 대한 긍정 피드백", "date": "2026-05-19", "rating": 5 },
    { "id": "p3", "user": "스윗가이*", "content": "혜택 경험상 편리함에 대한 코멘트", "date": "2026-05-18", "rating": 4 },
    { "id": "p4", "user": "마케터K", "content": "선착순 리워드가 실제 효과 있었다는 리뷰", "date": "2026-05-17", "rating": 5 },
    { "id": "p5", "user": "해피러버", "content": "브랜드 만족도가 올라갔다는 소감", "date": "2026-05-16", "rating": 5 }
  ],
  "negative": [
    { "id": "n1", "user": "불만가득*", "content": "부정적인 불만이나 시스템/점포 실망점 내용 (제외 매장 많음, 앱 오류 수두룩함)", "date": "2026-05-19", "rating": 2 },
    { "id": "n2", "user": "체크체크", "content": "선착순 마감이너무빨라 허무하다는 코멘트", "date": "2026-05-18", "rating": 2 },
    { "id": "n3", "user": "소비자X", "content": "제품 가격 상승 대비 혜택이 적다는 의견", "date": "2026-05-17", "rating": 1 },
    { "id": "n4", "user": "오류나빠요", "content": "결제 과정상의 미흡한 서비스 피드백", "date": "2026-05-16", "rating": 2 },
    { "id": "n5", "user": "실속부족1", "content": "혜택 적용 제외 매장이 많아 아쉬웠다는 의견", "date": "2026-05-15", "rating": 2 }
  ]
}

인사말이나 다른 텍스트 없이 JSON 본체만 정확히 출력하십시오.
`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(result.text || '{}');
    
    // Save to cache file
    cachedData[cacheKey] = parsed;
    writeJSONFile('reviews_cache.json', cachedData);
    
    return res.json(shiftReviewsDates(parsed));
  } catch (err: any) {
    const errorMsg = err?.message || '';
    const status = err?.status;
    const isQuotaError = status === 429 || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isKeyError = status === 400 || errorMsg.includes('API Key not found') || errorMsg.includes('valid API key') || errorMsg.includes('API_KEY_INVALID');
    const isUnavailableError = status === 503 || errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('temporary') || errorMsg.includes('overloaded');
    
    if (isQuotaError) {
      console.log(`[Reviews Info] Gemini rate limit/quota exceeded (429 RESOURCE_EXHAUSTED). Gracefully loaded and cached pre-baked review data.`);
    } else if (isKeyError) {
      console.warn(`[Gemini Info] The configured API key is invalid or missing. Serving default pre-baked review data.`);
    } else if (isUnavailableError) {
      console.log(`[Reviews Info] Gemini is currently experiencing high demand (503 UNAVAILABLE). Gracefully loaded and cached pre-baked review data.`);
    } else {
      console.warn('[Reviews Info] Gemini reviews call failed/fallback activated:', errorMsg || err);
    }
    
    // Cache the default reviews to avoid repetitive API requests during browsing
    cachedData[cacheKey] = defaultReviews;
    writeJSONFile('reviews_cache.json', cachedData);
    
    return res.json(shiftReviewsDates(defaultReviews));
  }
});

app.post('/api/promotions/clear', (req, res) => {
  // Clear all scraped promotions or reset to defaults
  // Let's reset to initial seed data
  const seedFile = path.join(DATA_DIR, 'promotions.json');
  // Just empty list of promotions, or keep the initial seed data. We'll write empty or default seed list.
  try {
    fs.unlinkSync(seedFile);
  } catch (err) {}
  res.json({ success: true });
});

// Helper for simulated/offline fallback scraping
const performSimulatedScrape = (res: any, note: string) => {
  const mockEvents = [
    {
      id: `scr_${Date.now()}_1`,
      brand: '파리바게뜨',
      category: 'E쿠폰',
      title: '카카오톡 선물하기 패밀리 세트 20% 단독 혜택',
      summary: '가정의 달 홀케이크 및 기프트 세트 교환권 20% 기간 한정 초특가',
      description: '파리바게뜨 카카오 기프티숍 입점 기념 대표 시그니처 케이크 20% 다운 할인 쿠폰 즉시 사용 가능.',
      startDate: '2026-05-20',
      endDate: '2026-05-26',
      discountType: '할인',
      benefitValue: '20%',
      benefitIntensity: 80,
      channel: '카카오 선물하기 모바일샵',
      isNew: true,
      sourceUrl: 'https://www.paris.co.kr',
      createdAt: '2026-05-21'
    },
    {
      id: `scr_${Date.now()}_2`,
      brand: '뚜레쥬르',
      category: '제휴',
      title: '신선한 토스트 및 에이드 결합 세트 1,500원 즉시 할인',
      summary: '행복카드 및 그린카드 추가 제휴 포인트 결제 연동 혜택',
      description: '뚜레쥬르 아침 토스트 샌드위치 세트 구매 시 해피앱 포인트 동시 가맹 우수 혜택 특별 지급',
      startDate: '2026-05-21',
      endDate: '2026-05-31',
      discountType: '할인',
      benefitValue: '1,500원',
      benefitIntensity: 45,
      channel: '기타 제휴 E쇼핑몰',
      isNew: true,
      sourceUrl: 'https://www.tlj.co.kr',
      createdAt: '2026-05-21'
    },
    {
      id: `scr_${Date.now()}_3`,
      brand: '스타벅스',
      category: '딜리버리',
      title: '딜리버스 전용 배달료 2,000원 할인 프로모션',
      summary: '스타벅스 공식 앱 배달 주문(Delivers) 25,000원 이상 결제 시 배달료 정액 감면',
      description: '스타벅스 공식 앱 내 배달 서비스 이용 고객 대상 기간 한정 배달 배송 수수료 특별 우대 혜택.',
      startDate: '2026-05-21',
      endDate: '2026-05-27',
      discountType: '할인',
      benefitValue: '2,000원',
      benefitIntensity: 50,
      channel: '브랜드 공식 이벤트관',
      isNew: true,
      sourceUrl: 'https://www.starbucks.co.kr',
      createdAt: '2026-05-21'
    }
  ];

  const currentPromotions = readJSONFile('promotions.json', []);
  const updatedPromotions = [...currentPromotions];
  const alertsConfig = readJSONFile('alerts.json', { minDiscountThreshold: 45, enabled: true });
  const triggeredAlerts: any[] = [];

  mockEvents.forEach(mockEv => {
    // Avoid duplicate titles
    if (!currentPromotions.some((p: any) => p.title === mockEv.title)) {
      updatedPromotions.unshift(mockEv);
      if (alertsConfig.enabled && mockEv.benefitIntensity >= alertsConfig.minDiscountThreshold) {
        triggeredAlerts.push({
          brand: mockEv.brand,
          title: mockEv.title,
          value: mockEv.benefitValue,
          intensity: mockEv.benefitIntensity,
          email: alertsConfig.email
        });
      }
    }
  });

  writeJSONFile('promotions.json', updatedPromotions);
  return res.json({
    success: true,
    scrapedCount: mockEvents.length,
    newPromotions: mockEvents,
    alerts: triggeredAlerts,
    note: note
  });
};

// GEMINI-POWERED WEB CRAWLER / RESEARCH ENGINE (using Search Grounding)
app.post('/api/promotions/scrape', async (req, res) => {
  const ai = getGeminiClient();
  const brands = readJSONFile('brands.json', []);
  
  if (!ai) {
    return performSimulatedScrape(res, 'Offline simulation mode active due to missing Gemini API key.');
  }

  try {
    const brandNames = brands.map((b: any) => b.name).join(', ');
    const d = new Date();
    const curYear = d.getFullYear();
    const curMonth = d.getMonth() + 1;
    const curDay = d.getDate();
    const todayPromptStr = `${curYear}년 ${curMonth}월 ${curDay}일`;
    const curMonthStr = `${curYear}년 ${curMonth}월`;
    const defaultStartStr = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(curYear, curMonth, 0).getDate();
    const defaultEndStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const searchPrompt = `
오늘 날짜는 ${todayPromptStr}입니다. 
대한민국의 다음 베이커리/카페 디저트 브랜드들의 ${curMonthStr} 최신/실시간 주간 프로모션, 제휴사 혜택, 카드 할인, 통신사 멤버십 혜택, 선물하기 모바일 모바일 금액권 세일, 배달앱(배민/요기요/쿠팡이츠) 브랜드 쿠폰 소식을 실시간 internet 검색(Google Search)으로 정밀하게 찾아내어 수집해주세요.

대상 브랜드: ${brandNames}

★ [중요 - 파리바게뜨 크롤링 무결성 및 엄격한 한정 조건] ★
- 자사인 '파리바게뜨'로 분류하는 정보는 "오직 파리바게뜨" 오프라인 가맹 매장 및 공식 온라인 앱(파바앱, 해피포인트앱 내 파리바게뜨 섹션)에서 실제로 단독 진행하는 프로모션 및 혜택 소식으로 지극히 엄밀하게 한정합니다.
- 같은 SPC 그룹의 타 패밀리 브랜드(배스킨라빈스, 던킨, 파스쿠찌, 쉐이크쉑, 삼립 등)의 이벤트가 '파리바게뜨'로 분류되는 것을 전면 금지합니다.
- 특히 **편의점(CU, GS25, 세븐일레븐, 이마트24 등)에서 판매되는 'SPC 삼립' 제품군(예: 포켓몬 빵, 카스테라, 포켓몬 띠부씰 증정 행사, 디저트류 등)**은 편의점 채널 전용이므로 베이커리 가맹 브랜드인 '파리바게뜨' 매장 행사와 전혀 무관합니다. 이처럼 편의점 판매 상품이나 삼립 콜라보 및 제휴 캐릭터 이벤트는 절대 '파리바게뜨'의 프로모션으로 기입하지 마십시오.
- 오직 파리바게뜨 매장에 직접 방문하여 결제하거나 파바 배달 주문 시 직접 적용되는 가맹본부 공식 주관 할인/증정 혜택만 파리바게뜨 브랜드로 엄격하게 분류하십시오.

최근 2~3일 내에 올라온 최신 소식이나 대박 정보 위주로 최소 3개에서 5개 이상의 실제 진행중인 프로모션을 발굴해 주십시오. 

반드시 아래 JSON 스키마를 엄격히 준수하여 JSON 배열만으로 반환해야 합니다:
{
  "promotions": [
    {
      "brand": "파리바게뜨, 뚜레쥬르, 투썸플레이스, 스타벅스, 배스킨라빈스 중 딱 일치하는 이름 하나",
      "category": "제휴, 카드사, 통신사, E쿠폰, 딜리버리 중 하나",
      "title": "한글 프로모션 행사명 (예: KB국민카드 5천원 할인, KT 달달 30% 등)",
      "summary": "핵심 한 줄 요약",
      "description": "상세한 참여 조건 및 추가 혜택 내역 설명",
      "startDate": "YYYY-MM-DD 형식 (알 수 없으면 ${defaultStartStr} 등 최근 날짜)",
      "endDate": "YYYY-MM-DD 형식 (상시이면 ${defaultEndStr} 등)",
      "discountType": "할인, 적립, 증정, 페이백, 기타 중 하나",
      "benefitValue": "사용자 혜택 내용 (예: '20%', '3,000원', '1+1', '무료 기프티콘')",
      "benefitIntensity": 1에서 100 사이의 숫자로 된 체감 강도 (할인율이 크고 정액 할인이 크면 높음, 단순 증정은 낮음)",
      "channel": "수집 매체 및 혜택 경로 이름",
      "sourceUrl": "해당 브랜드 주소 또는 정보 제공 페이지 링크"
    }
  ]
}

인사말이나 다른 텍스트 없이 JSON 본체만 정확히 출력하십시오.
`;

    console.log('Querying Gemini with search grounding for active promos...');
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
      }
    });

    const textOutput = result.text || '';
    const parsedData = JSON.parse(textOutput);
    const scrapedList = parsedData.promotions || [];

    const currentPromotions = readJSONFile('promotions.json', []);
    const updatedPromotions = [...currentPromotions];
    const addedList: any[] = [];
    const alertsConfig = readJSONFile('alerts.json', { minDiscountThreshold: 45, enabled: true });
    const triggeredAlerts: any[] = [];

    scrapedList.forEach((ev: any, index: number) => {
      let detectedBrand = String(ev.brand || '').trim();

      // Ensure exact brand names matching our database
      if (detectedBrand === '파리바게트') {
        detectedBrand = '파리바게뜨';
      }

      // Strict backend sanitization to guarantee NO other SPC brand (Baskin, Dunkin, etc.) pollution under '파리바게뜨'
      if (detectedBrand === '파리바게뜨') {
        const titleLower = String(ev.title || '').toLowerCase();
        const descLower = String(ev.description || '').toLowerCase();
        const summaryLower = String(ev.summary || '').toLowerCase();
        const fullTxt = `${titleLower} ${descLower} ${summaryLower}`;

        // Strictly reject convenience store / SPC Samlip character / external Castella sticker specific contamination
        const convenienceOrSamlipPattern = /편의점|cu\b|gs25|세븐일레븐|이마트24|미니스톱|ministop|포켓몬\s*빵|띠부씰|띠부실|카스테라\s*한정\s*스티커|삼립\s*카스테라/;
        if (convenienceOrSamlipPattern.test(fullTxt)) {
          console.log(`[Sanitizer] Blocked suspected convenience store / Samlip promotion from Paris Baguette: ${ev.title}`);
          return;
        }

        const otherBrandsPattern = /배스킨라빈스|베스킨라빈스|배스킨|베스킨|baskin\s*robbins|던킨|dunkin|파스쿠찌|pascucci|삼립|samlip|샤니|shany|쉐이크쉑|shake\s*shack/;
        const pbPattern = /파리바게뜨|파리바게트|파바|paris\s*baguette/;

        if (otherBrandsPattern.test(fullTxt)) {
          // If other SPC brands are mentioned, but Paris Baguette keyword is absent, discard or relocate!
          if (!pbPattern.test(fullTxt)) {
            if (/배스킨|베스킨|baskin/.test(fullTxt)) {
              detectedBrand = '배스킨라빈스';
            } else {
              // Ignore this record completely to shield Paris Baguette from contamination
              return;
            }
          } else {
            // Both are mentioned. Check if the title is primarily about another brand. (e.g., "배스킨라빈스 패밀리 혜택")
            if (otherBrandsPattern.test(titleLower) && !pbPattern.test(titleLower)) {
              if (/배스킨|베스킨|baskin/.test(titleLower)) {
                detectedBrand = '배스킨라빈스';
              } else {
                return;
              }
            }
          }
        }
      }

      // Only allow known brands from brands list
      const knownBrands = brands.map((b: any) => b.name);
      if (!knownBrands.includes(detectedBrand)) {
        return; // Skip random irrelevant categories or unknown brands
      }

      // Dedup
      if (!currentPromotions.some((p: any) => p.title === ev.title)) {
        const item = {
          id: `scr_${Date.now()}_${index}`,
          brand: detectedBrand,
          category: ev.category || '기타',
          title: ev.title,
          summary: ev.summary || ev.title,
          description: ev.description || '',
          startDate: ev.startDate || '2026-05-21',
          endDate: ev.endDate || '2026-05-31',
          discountType: ev.discountType || '기타',
          benefitValue: ev.benefitValue || 'N/A',
          benefitIntensity: Number(ev.benefitIntensity) || 50,
          channel: ev.channel || '자동 크롤러',
          isNew: true,
          sourceUrl: ev.sourceUrl || '',
          createdAt: '2026-05-21'
        };
        updatedPromotions.unshift(item);
        addedList.push(item);

        if (alertsConfig.enabled && item.benefitIntensity >= alertsConfig.minDiscountThreshold) {
          triggeredAlerts.push({
            brand: item.brand,
            title: item.title,
            value: item.benefitValue,
            intensity: item.benefitIntensity,
            email: alertsConfig.email
          });
        }
      }
    });

    if (addedList.length > 0) {
      writeJSONFile('promotions.json', updatedPromotions);
    }

    res.json({
      success: true,
      scrapedCount: addedList.length,
      newPromotions: addedList,
      alerts: triggeredAlerts
    });

  } catch (error: any) {
    const errorMsg = error?.message || '';
    const status = error?.status;
    const isQuotaError = status === 429 || status === 'RESOURCE_EXHAUSTED' || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    
    console.log(`[Crawler Info] Search Grounding fallback mode activated (${isQuotaError ? 'quota optimized' : 'fallback activated'}).`);
    
    const note = isQuotaError
      ? 'Gemini Search rate limit/quota exceeded (429 RESOURCE_EXHAUSTED). Offline simulation mode was gracefully activated.'
      : `Gemini Search API failed (${errorMsg || 'Exception'}). Simulated offline mode activated.`;
    return performSimulatedScrape(res, note);
  }
});

// GEMINI-POWERED COGNITIVE MARKET ANALYTICS ENDPOINT (Weekly Intel)
app.post('/api/promotions/analyze', async (req, res) => {
  const ai = getGeminiClient();
  const promotions = shiftPromotionsDates(readJSONFile('promotions.json', []));
  
  const curMonthVal = new Date().getMonth() + 1;
  const defaultInsight = `경쟁사인 뚜레쥬르와 투썸플레이스가 ${curMonthVal}월에 접어들며 통신사(KT 달달혜택) 및 현대카드 M포인트 50% 역대급 혜택 등 고강도 카드 제휴 프로모션을 적극 전개하고 있습니다. 반면 파리바게뜨는 T-Day 20% 특별 우대 및 요기요 4천원 정액 할인에 주력 중입니다. 제휴 E쿠폰 분야에서는 뚜레쥬르의 선물하기 15% 기획전이 활성화 중이므로, 당사는 E쇼핑몰 전용 타겟 1+1 리워드 쿠폰 또는 신선 생크림 케익 카테고리의 핀포인트 혜택 보강을 권장합니다.`;

  if (!ai) {
    return res.json({
      insight: defaultInsight,
      note: 'Offline simulation mode active due to missing Gemini API key.'
    });
  }

  try {
    const promoContext = promotions.map((p: any) => 
      `[${p.brand} | ${p.category}] ${p.title} (${p.benefitValue}) - 강도: ${p.benefitIntensity}`
    ).join('\n');

    const analysisPrompt = `
당신은 대한민국의 유명 식품 기업인 SPC 그룹 파리바게뜨 커머스마케팅실의 수석 AI 전략 애널리스트 연구원입니다.
현재 수집된 파리바게뜨와 경쟁 브랜드들(뚜레쥬르, 투썸플레이스, 스타벅스, 배스킨라빈스 등)의 이번 주차 프로모션 데이터는 다음과 같습니다:

[프로모션 목록]
${promoContext}

위 데이터를 분석하여, 파리바게뜨 마케팅 부서를 위한 날카롭고 구체적이며 단호한 주간 핵심 마켓 경쟁 분석 리포트를 3문장 이내로 요약해 주십시오. 
반드시 다음 조건들을 포함해 전문 비즈니스 톤&매너로 작성하세요:
1. 이번 주 경쟁사들의 가장 위협적이거나 두드러진 행보 요약 (예: 고할인율 카드 프로모션, 특별 캐릭터 콜라보 등)
2. 파리바게뜨 프로모션의 상대적 강약점 비교 분석
3. 파리바게뜨가 시장 주도권을 확보하기 위해 즉각 실행 가능한 전술 추천 (예: 모바일 선물하기 공격적 확대, 딜리버리 결합 할인 보조금 투입 등)

말머리나 인사말, 사족 없이 본문 내용만을 리턴하세요.
`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: analysisPrompt,
    });

    res.json({
      insight: result.text?.trim() || defaultInsight
    });

  } catch (error: any) {
    console.log('[Analytics Info] Serving default curated marketing insight (Quota optimized).');
    res.json({ insight: defaultInsight });
  }
});


// FRONTEND STATIC STREAM / VITE SERVICE FOR PORT 3000
const startVite = async () => {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    console.log('Running in Development mode - booting Vite dev middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    
    app.use(vite.middlewares);
  } else {
    console.log('Running in Production mode - serving static dist assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PB Commerce-Watch Dev Server is listening on address http://localhost:${PORT}`);
  });
};

startVite().catch(err => {
  console.error('Failed to start full stack application:', err);
});
