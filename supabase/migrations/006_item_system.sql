-- ============================================================
-- 006: Item System (아이템 시스템)
-- 가디용품점 + 인벤토리 + 돌보기 + 아이템 도감
-- ============================================================

-- ── 아이템 타입 (정적 데이터) ──
CREATE TABLE public.item_types (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('food','play','hygiene','sleep')),
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  asset_key TEXT NOT NULL,           -- e.g. "food/apple_pie" → /ui/items/food/apple_pie.png
  season_id INTEGER REFERENCES public.seasons(id),  -- NULL = 시즌 무관
  description TEXT DEFAULT ''
);

ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_types_select_all" ON public.item_types FOR SELECT USING (true);

-- ── 인벤토리 (유저 소지품) ──
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type_id INTEGER NOT NULL REFERENCES public.item_types(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE(user_id, item_type_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_select_own" ON public.inventory
  FOR SELECT USING (auth.uid() = user_id);

-- ── 아이템 도감 ──
CREATE TABLE public.item_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type_id INTEGER NOT NULL REFERENCES public.item_types(id),
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type_id)
);

ALTER TABLE public.item_collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_collection_select_own" ON public.item_collection
  FOR SELECT USING (auth.uid() = user_id);

-- ── 돌봄 기록 (하루 카테고리당 1회 제한) ──
CREATE TABLE public.care_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.active_guardians(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('food','play','hygiene','sleep')),
  item_type_id INTEGER NOT NULL REFERENCES public.item_types(id),
  used_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guardian_id, category, used_date)
);

ALTER TABLE public.care_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "care_log_select_own" ON public.care_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- RPC Functions
-- ============================================================

-- ── 아이템 구매 ──
CREATE OR REPLACE FUNCTION public.buy_item(
  p_user_id UUID,
  p_item_type_id INTEGER,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item item_types%ROWTYPE;
  v_total_cost INTEGER;
  v_gold INTEGER;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  SELECT * INTO v_item FROM item_types WHERE id = p_item_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  v_total_cost := v_item.price * p_quantity;

  SELECT gold INTO v_gold FROM profiles WHERE id = p_user_id;
  IF v_gold < v_total_cost THEN
    RAISE EXCEPTION 'not_enough_gold';
  END IF;

  -- 골드 차감
  PERFORM add_gold(p_user_id, -v_total_cost);

  -- 인벤토리 추가
  INSERT INTO inventory (user_id, item_type_id, quantity)
  VALUES (p_user_id, p_item_type_id, p_quantity)
  ON CONFLICT (user_id, item_type_id)
  DO UPDATE SET quantity = inventory.quantity + p_quantity;

  RETURN json_build_object(
    'success', true,
    'item_name', v_item.name,
    'quantity', p_quantity,
    'total_cost', v_total_cost
  );
END;
$$;

-- ── 돌보기 (아이템 사용) ──
CREATE OR REPLACE FUNCTION public.use_care_item(
  p_user_id UUID,
  p_item_type_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardian active_guardians%ROWTYPE;
  v_item item_types%ROWTYPE;
  v_today DATE;
  v_inv_qty INTEGER;
  v_is_new_collection BOOLEAN := false;
BEGIN
  v_today := kst_today();

  -- 활성 가디 확인
  SELECT * INTO v_guardian FROM active_guardians
  WHERE user_id = p_user_id AND status = 'growing';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_guardian';
  END IF;

  -- 아이템 확인
  SELECT * INTO v_item FROM item_types WHERE id = p_item_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- 오늘 해당 카테고리 이미 사용했는지 체크
  IF EXISTS (
    SELECT 1 FROM care_log
    WHERE guardian_id = v_guardian.id AND category = v_item.category AND used_date = v_today
  ) THEN
    RAISE EXCEPTION 'already_cared_today';
  END IF;

  -- 인벤토리 수량 체크
  SELECT quantity INTO v_inv_qty FROM inventory
  WHERE user_id = p_user_id AND item_type_id = p_item_type_id;
  IF v_inv_qty IS NULL OR v_inv_qty < 1 THEN
    RAISE EXCEPTION 'not_in_inventory';
  END IF;

  -- 인벤토리 차감
  UPDATE inventory SET quantity = quantity - 1
  WHERE user_id = p_user_id AND item_type_id = p_item_type_id;

  -- 0개면 삭제
  DELETE FROM inventory
  WHERE user_id = p_user_id AND item_type_id = p_item_type_id AND quantity <= 0;

  -- 돌봄 기록
  INSERT INTO care_log (guardian_id, user_id, category, item_type_id, used_date)
  VALUES (v_guardian.id, p_user_id, v_item.category, p_item_type_id, v_today);

  -- 아이템 도감 등록 (첫 사용 시)
  INSERT INTO item_collection (user_id, item_type_id)
  VALUES (p_user_id, p_item_type_id)
  ON CONFLICT (user_id, item_type_id) DO NOTHING;

  IF FOUND THEN
    v_is_new_collection := true;
  END IF;

  -- 성장치 +1 (guardian_daily_growth에 반영)
  INSERT INTO guardian_daily_growth (guardian_id, user_id, record_date, growth_points, daily_goal, completed_count)
  VALUES (v_guardian.id, p_user_id, v_today, 0, 1, 0)
  ON CONFLICT (guardian_id, record_date)
  DO UPDATE SET growth_points = guardian_daily_growth.growth_points + 1;

  -- active_guardians total_growth도 +1
  UPDATE active_guardians SET total_growth = total_growth + 1, updated_at = now()
  WHERE id = v_guardian.id;

  RETURN json_build_object(
    'success', true,
    'category', v_item.category,
    'item_name', v_item.name,
    'new_collection', v_is_new_collection
  );
END;
$$;

-- ── 오늘 돌봄 현황 조회 ──
CREATE OR REPLACE FUNCTION public.get_today_care(p_user_id UUID)
RETURNS TABLE(category TEXT, item_type_id INTEGER, item_name TEXT, asset_key TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cl.category, cl.item_type_id, it.name, it.asset_key
  FROM care_log cl
  JOIN item_types it ON it.id = cl.item_type_id
  WHERE cl.user_id = p_user_id
    AND cl.used_date = kst_today()
  ORDER BY cl.created_at;
$$;

-- ── 아이템 도감 요약 ──
CREATE OR REPLACE FUNCTION public.get_item_collection_summary(p_user_id UUID)
RETURNS TABLE(category TEXT, collected BIGINT, total BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    it.category,
    COUNT(DISTINCT ic.item_type_id) AS collected,
    COUNT(DISTINCT it.id) AS total
  FROM item_types it
  LEFT JOIN item_collection ic ON ic.item_type_id = it.id AND ic.user_id = p_user_id
  GROUP BY it.category
  ORDER BY it.category;
$$;

-- ============================================================
-- 시즌 1 아이템 시드 데이터 (카테고리당 30종)
-- ============================================================

-- 음식 (pixelfood 에셋 30종, 가격 50~500G)
INSERT INTO public.item_types (category, name, price, asset_key, season_id) VALUES
  ('food', '사과파이',     100, 'food/apple_pie', 1),
  ('food', '식빵',         50,  'food/bread', 1),
  ('food', '바게트',       80,  'food/baguette', 1),
  ('food', '와플',         120, 'food/waffle', 1),
  ('food', '모닝빵',       60,  'food/bun', 1),
  ('food', '베이컨',       150, 'food/bacon', 1),
  ('food', '햄버거',       200, 'food/burger', 1),
  ('food', '브리또',       180, 'food/burrito', 1),
  ('food', '베이글',       90,  'food/bagel', 1),
  ('food', '치즈케이크',   250, 'food/cheesecake', 1),
  ('food', '치즈퍼프',     70,  'food/cheesepuff', 1),
  ('food', '초콜릿',       100, 'food/chocolate', 1),
  ('food', '쿠키',         80,  'food/cookies', 1),
  ('food', '초코케이크',   300, 'food/chocolatecake', 1),
  ('food', '카레',         200, 'food/curry', 1),
  ('food', '도넛',         100, 'food/donut', 1),
  ('food', '만두',         150, 'food/dumplings', 1),
  ('food', '계란후라이',   60,  'food/friedegg', 1),
  ('food', '에그타르트',   180, 'food/eggtart', 1),
  ('food', '감자튀김',     100, 'food/frenchfries', 1),
  ('food', '과일케이크',   350, 'food/fruitcake', 1),
  ('food', '마늘빵',       90,  'food/garlicbread', 1),
  ('food', '젤리곰',       500, 'food/giantgummybear', 1),
  ('food', '핫도그',       120, 'food/hotdog', 1),
  ('food', '아이스크림',   150, 'food/icecream', 1),
  ('food', '젤리',         70,  'food/jelly', 1),
  ('food', '레몬파이',     200, 'food/lemonpie', 1),
  ('food', '마카로니',     180, 'food/macncheese', 1),
  ('food', '피자',         250, 'food/pizza', 1),
  ('food', '팬케이크',     130, 'food/pancakes', 1);

-- 놀이 (64x64 에셋 임시 배정, 가격 50~500G)
INSERT INTO public.item_types (category, name, price, asset_key, season_id) VALUES
  ('play', '나무검',       50,  'play/fc1', 1),
  ('play', '작은 방패',    80,  'play/fc2', 1),
  ('play', '고무공',       60,  'play/fc3', 1),
  ('play', '실뜨기',       70,  'play/fc4', 1),
  ('play', '팽이',         90,  'play/fc5', 1),
  ('play', '딱지',         50,  'play/fc6', 1),
  ('play', '구슬',         100, 'play/fc7', 1),
  ('play', '색종이',       60,  'play/fc8', 1),
  ('play', '퍼즐 조각',   120, 'play/fc9', 1),
  ('play', '요요',         80,  'play/fc10', 1),
  ('play', '비눗방울',     70,  'play/fc11', 1),
  ('play', '종이비행기',   50,  'play/fc12', 1),
  ('play', '장난감 활',    150, 'play/fc13', 1),
  ('play', '오뚝이',       100, 'play/fc14', 1),
  ('play', '풍선',         80,  'play/fc15', 1),
  ('play', '레고 블록',    200, 'play/fc16', 1),
  ('play', '인형',         250, 'play/fc17', 1),
  ('play', '물총',         180, 'play/fc18', 1),
  ('play', '미니 기차',    300, 'play/fc19', 1),
  ('play', '만화경',       150, 'play/fc20', 1),
  ('play', '카드 덱',      120, 'play/fc21', 1),
  ('play', '보드게임',     350, 'play/fc22', 1),
  ('play', '모래놀이 세트', 200, 'play/fc23', 1),
  ('play', '장난감 로봇',  400, 'play/fc24', 1),
  ('play', '공룡 피규어',  300, 'play/fc25', 1),
  ('play', '미니 피아노',  350, 'play/fc26', 1),
  ('play', '마술 키트',    500, 'play/fc27', 1),
  ('play', '크레용 세트',  100, 'play/fc28', 1),
  ('play', '점토',         90,  'play/fc29', 1),
  ('play', '소꿉놀이',     150, 'play/fc30', 1);

-- 위생 (64x64 에셋 임시 배정, 가격 50~500G)
INSERT INTO public.item_types (category, name, price, asset_key, season_id) VALUES
  ('hygiene', '비누',         50,  'hygiene/fc31', 1),
  ('hygiene', '수건',         60,  'hygiene/fc32', 1),
  ('hygiene', '칫솔',         70,  'hygiene/fc33', 1),
  ('hygiene', '치약',         60,  'hygiene/fc34', 1),
  ('hygiene', '샴푸',         80,  'hygiene/fc35', 1),
  ('hygiene', '린스',         80,  'hygiene/fc36', 1),
  ('hygiene', '바디워시',     90,  'hygiene/fc37', 1),
  ('hygiene', '거품 목욕제',  120, 'hygiene/fc38', 1),
  ('hygiene', '로션',         100, 'hygiene/fc39', 1),
  ('hygiene', '선크림',       150, 'hygiene/fc40', 1),
  ('hygiene', '빗',           50,  'hygiene/fc41', 1),
  ('hygiene', '면봉',         50,  'hygiene/fc42', 1),
  ('hygiene', '핸드크림',     100, 'hygiene/fc43', 1),
  ('hygiene', '립밤',         80,  'hygiene/fc44', 1),
  ('hygiene', '물티슈',       60,  'hygiene/fc45', 1),
  ('hygiene', '목욕 장난감',  150, 'hygiene/fc46', 1),
  ('hygiene', '향초',         200, 'hygiene/fc47', 1),
  ('hygiene', '입욕제',       180, 'hygiene/fc48', 1),
  ('hygiene', '때수건',       70,  'hygiene/fc49', 1),
  ('hygiene', '헤어밴드',     90,  'hygiene/fc50', 1),
  ('hygiene', '폼클렌징',     120, 'hygiene/fc51', 1),
  ('hygiene', '아로마 오일',  250, 'hygiene/fc52', 1),
  ('hygiene', '스크럽',       200, 'hygiene/fc53', 1),
  ('hygiene', '훼이스팩',     300, 'hygiene/fc54', 1),
  ('hygiene', '발 마사지기',  350, 'hygiene/fc55', 1),
  ('hygiene', '족욕 세트',    400, 'hygiene/fc56', 1),
  ('hygiene', '스파 세트',    500, 'hygiene/fc57', 1),
  ('hygiene', '미스트',       150, 'hygiene/fc58', 1),
  ('hygiene', '데오드란트',   100, 'hygiene/fc59', 1),
  ('hygiene', '치실',         50,  'hygiene/fc60', 1);

-- 수면 (64x64 에셋 임시 배정, 가격 50~500G)
INSERT INTO public.item_types (category, name, price, asset_key, season_id) VALUES
  ('sleep', '작은 베개',     50,  'sleep/fc61', 1),
  ('sleep', '담요',          80,  'sleep/fc62', 1),
  ('sleep', '양말',          50,  'sleep/fc63', 1),
  ('sleep', '안대',          60,  'sleep/fc64', 1),
  ('sleep', '허브티',        70,  'sleep/fc65', 1),
  ('sleep', '따뜻한 우유',   80,  'sleep/fc66', 1),
  ('sleep', '수면등',        120, 'sleep/fc67', 1),
  ('sleep', '오르골',        150, 'sleep/fc68', 1),
  ('sleep', '백색소음기',    200, 'sleep/fc69', 1),
  ('sleep', '향 주머니',     100, 'sleep/fc70', 1),
  ('sleep', '귀마개',        60,  'sleep/fc71', 1),
  ('sleep', '수면 양말',     80,  'sleep/fc72', 1),
  ('sleep', '이불',          150, 'sleep/fc73', 1),
  ('sleep', '슬리퍼',        90,  'sleep/fc74', 1),
  ('sleep', '잠옷',          120, 'sleep/fc75', 1),
  ('sleep', '무드등',        180, 'sleep/fc76', 1),
  ('sleep', '라벤더 향초',   200, 'sleep/fc77', 1),
  ('sleep', '수면 안경',     150, 'sleep/fc78', 1),
  ('sleep', '명상 쿠션',     250, 'sleep/fc79', 1),
  ('sleep', '별빛 프로젝터', 300, 'sleep/fc80', 1),
  ('sleep', '꿈 일기장',     100, 'sleep/fc81', 1),
  ('sleep', '수면 스프레이', 180, 'sleep/fc82', 1),
  ('sleep', '구름 쿠션',     350, 'sleep/fc83', 1),
  ('sleep', '온열 패드',     200, 'sleep/fc84', 1),
  ('sleep', '자장가 LP',     250, 'sleep/fc85', 1),
  ('sleep', '달빛 모빌',     300, 'sleep/fc86', 1),
  ('sleep', '메모리폼',      400, 'sleep/fc87', 1),
  ('sleep', '황금 이불',     500, 'sleep/fc88', 1),
  ('sleep', '수면 인형',     350, 'sleep/fc89', 1),
  ('sleep', '드림캐쳐',      250, 'sleep/fc90', 1);
