-- ============================================================
-- 007: Potion System (점술관 포션)
-- 진화 시 레어도 확률 보정 포션
-- ============================================================

-- ── 포션 타입 ──
CREATE TABLE public.potion_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  asset_key TEXT NOT NULL,
  -- 효과: 각 레어도 확률 배율 (1.0 = 변화 없음, 1.5 = 50% UP, 2.0 = 100% UP)
  -- normal_guarantee: true이면 무조건 노말
  normal_guarantee BOOLEAN NOT NULL DEFAULT false,
  rare_mult NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  epic_mult NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  unique_mult NUMERIC(3,2) NOT NULL DEFAULT 1.0
);

ALTER TABLE public.potion_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "potion_types_select_all" ON public.potion_types FOR SELECT USING (true);

-- ── 포션 인벤토리 ──
CREATE TABLE public.potion_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  potion_type_id INTEGER NOT NULL REFERENCES public.potion_types(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE(user_id, potion_type_id)
);

ALTER TABLE public.potion_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "potion_inventory_select_own" ON public.potion_inventory
  FOR SELECT USING (auth.uid() = user_id);

-- ── 포션 구매 ──
CREATE OR REPLACE FUNCTION public.buy_potion(
  p_user_id UUID,
  p_potion_type_id INTEGER,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_potion potion_types%ROWTYPE;
  v_total_cost INTEGER;
  v_gold INTEGER;
BEGIN
  IF p_quantity < 1 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;

  SELECT * INTO v_potion FROM potion_types WHERE id = p_potion_type_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'potion_not_found'; END IF;

  v_total_cost := v_potion.price * p_quantity;

  SELECT gold INTO v_gold FROM profiles WHERE id = p_user_id;
  IF v_gold < v_total_cost THEN RAISE EXCEPTION 'not_enough_gold'; END IF;

  PERFORM add_gold(p_user_id, -v_total_cost);

  INSERT INTO potion_inventory (user_id, potion_type_id, quantity)
  VALUES (p_user_id, p_potion_type_id, p_quantity)
  ON CONFLICT (user_id, potion_type_id)
  DO UPDATE SET quantity = potion_inventory.quantity + p_quantity;

  RETURN json_build_object(
    'success', true,
    'potion_name', v_potion.name,
    'quantity', p_quantity,
    'total_cost', v_total_cost
  );
END;
$$;

-- ── 시드 데이터 (11종) ──
INSERT INTO public.potion_types (name, description, price, asset_key, normal_guarantee, rare_mult, epic_mult, unique_mult) VALUES
  ('맑은 물약',     '노말 가디언이 확정으로 나옵니다.',           500,  'potion/empty_bottle',    true,  1.0, 1.0, 1.0),
  ('초록 물약 I',   '레어 확률이 25% 증가합니다.',              700,  'potion/green_potion',    false, 1.25, 1.0, 1.0),
  ('초록 물약 II',  '레어 확률이 50% 증가합니다.',              1000, 'potion/green_potion_2',  false, 1.5,  1.0, 1.0),
  ('초록 물약 III', '레어 확률이 100% 증가합니다.',             2000, 'potion/green_potion_3',  false, 2.0,  1.0, 1.0),
  ('푸른 물약 I',   '에픽 확률이 25% 증가합니다.',              1500, 'potion/blue_potion',     false, 1.0,  1.25, 1.0),
  ('푸른 물약 II',  '에픽 확률이 50% 증가합니다.',              2000, 'potion/blue_potion_2',   false, 1.0,  1.5,  1.0),
  ('푸른 물약 III', '에픽 확률이 100% 증가합니다.',             4000, 'potion/blue_potion_3',   false, 1.0,  2.0,  1.0),
  ('붉은 물약 I',   '유니크 확률이 25% 증가합니다.',            3000, 'potion/red_potion',      false, 1.0,  1.0,  1.25),
  ('붉은 물약 II',  '유니크 확률이 50% 증가합니다.',            4000, 'potion/red_potion_2',    false, 1.0,  1.0,  1.5),
  ('붉은 물약 III', '유니크 확률이 100% 증가합니다.',           8000, 'potion/red_potion_3',    false, 1.0,  1.0,  2.0),
  ('행운의 물약',   '레어, 에픽, 유니크 확률이 모두 20% 증가합니다.', 5000, 'potion/water_bottle', false, 1.2, 1.2, 1.2);
