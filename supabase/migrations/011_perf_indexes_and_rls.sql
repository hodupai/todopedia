-- ============================================
-- 성능 개선: RLS auth.uid() 캐싱 + FK 인덱스
-- ============================================
-- Supabase advisor 결과 적용:
-- 1. RLS 정책의 auth.uid() 를 (SELECT auth.uid())로 감싸 행마다 재평가하지 않도록 변경
-- 2. unindexed foreign key에 인덱스 추가
-- 3. profiles/invite_codes의 다중 permissive 정책 통합

-- ============================================
-- 1. FK 인덱스 추가
-- ============================================
CREATE INDEX IF NOT EXISTS idx_active_guardians_season_id ON public.active_guardians(season_id);
CREATE INDEX IF NOT EXISTS idx_care_log_item_type_id ON public.care_log(item_type_id);
CREATE INDEX IF NOT EXISTS idx_collection_guardian_type_id ON public.collection(guardian_type_id);
CREATE INDEX IF NOT EXISTS idx_collection_season_id ON public.collection(season_id);
CREATE INDEX IF NOT EXISTS idx_guardian_daily_growth_user_id ON public.guardian_daily_growth(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_type_id ON public.inventory(item_type_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_owner_id ON public.invite_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by ON public.invite_codes(used_by);
CREATE INDEX IF NOT EXISTS idx_item_collection_item_type_id ON public.item_collection(item_type_id);
CREATE INDEX IF NOT EXISTS idx_item_types_season_id ON public.item_types(season_id);
CREATE INDEX IF NOT EXISTS idx_owned_backgrounds_background_id ON public.owned_backgrounds(background_id);
CREATE INDEX IF NOT EXISTS idx_owned_fonts_font_id ON public.owned_fonts(font_id);
CREATE INDEX IF NOT EXISTS idx_owned_themes_theme_id ON public.owned_themes(theme_id);
CREATE INDEX IF NOT EXISTS idx_parties_leader_id ON public.parties(leader_id);
CREATE INDEX IF NOT EXISTS idx_party_activity_log_user_id ON public.party_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_party_daily_records_user_id ON public.party_daily_records(user_id);
CREATE INDEX IF NOT EXISTS idx_party_todos_created_by ON public.party_todos(created_by);
CREATE INDEX IF NOT EXISTS idx_party_todos_party_id ON public.party_todos(party_id);
CREATE INDEX IF NOT EXISTS idx_potion_inventory_potion_type_id ON public.potion_inventory(potion_type_id);
CREATE INDEX IF NOT EXISTS idx_todos_tag_id ON public.todos(tag_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON public.user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_wall_hearts_user_id ON public.wall_hearts(user_id);
CREATE INDEX IF NOT EXISTS idx_wall_posts_user_id ON public.wall_posts(user_id);

-- ============================================
-- 2. RLS 정책: auth.uid() → (SELECT auth.uid())
-- ============================================
-- profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
-- profiles_select_public이 true였으므로 _own은 흡수됨. SELECT는 1개로 통합.
CREATE POLICY profiles_select_public ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

-- invite_codes (다중 permissive 정책 통합)
DROP POLICY IF EXISTS invite_codes_select_available ON public.invite_codes;
DROP POLICY IF EXISTS invite_codes_select_own ON public.invite_codes;
CREATE POLICY invite_codes_select ON public.invite_codes FOR SELECT
  USING (used_by IS NULL OR (SELECT auth.uid()) = owner_id);

-- tags
DROP POLICY IF EXISTS tags_select_own ON public.tags;
DROP POLICY IF EXISTS tags_insert_own ON public.tags;
DROP POLICY IF EXISTS tags_update_own ON public.tags;
DROP POLICY IF EXISTS tags_delete_own ON public.tags;
CREATE POLICY tags_select_own ON public.tags FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY tags_insert_own ON public.tags FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY tags_update_own ON public.tags FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY tags_delete_own ON public.tags FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- todos
DROP POLICY IF EXISTS todos_select_own ON public.todos;
DROP POLICY IF EXISTS todos_insert_own ON public.todos;
DROP POLICY IF EXISTS todos_update_own ON public.todos;
DROP POLICY IF EXISTS todos_delete_own ON public.todos;
CREATE POLICY todos_select_own ON public.todos FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY todos_insert_own ON public.todos FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY todos_update_own ON public.todos FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY todos_delete_own ON public.todos FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- daily_records
DROP POLICY IF EXISTS daily_records_select_own ON public.daily_records;
DROP POLICY IF EXISTS daily_records_insert_own ON public.daily_records;
DROP POLICY IF EXISTS daily_records_update_own ON public.daily_records;
CREATE POLICY daily_records_select_own ON public.daily_records FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY daily_records_insert_own ON public.daily_records FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY daily_records_update_own ON public.daily_records FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- active_guardians
DROP POLICY IF EXISTS active_guardians_select_own ON public.active_guardians;
CREATE POLICY active_guardians_select_own ON public.active_guardians FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- guardian_daily_growth
DROP POLICY IF EXISTS guardian_daily_growth_select_own ON public.guardian_daily_growth;
CREATE POLICY guardian_daily_growth_select_own ON public.guardian_daily_growth FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- collection
DROP POLICY IF EXISTS collection_select_own ON public.collection;
CREATE POLICY collection_select_own ON public.collection FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- inventory
DROP POLICY IF EXISTS inventory_select_own ON public.inventory;
CREATE POLICY inventory_select_own ON public.inventory FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- item_collection
DROP POLICY IF EXISTS item_collection_select_own ON public.item_collection;
CREATE POLICY item_collection_select_own ON public.item_collection FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- care_log
DROP POLICY IF EXISTS care_log_select_own ON public.care_log;
CREATE POLICY care_log_select_own ON public.care_log FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- potion_inventory
DROP POLICY IF EXISTS potion_inventory_select_own ON public.potion_inventory;
CREATE POLICY potion_inventory_select_own ON public.potion_inventory FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- owned_backgrounds
DROP POLICY IF EXISTS owned_backgrounds_select_own ON public.owned_backgrounds;
CREATE POLICY owned_backgrounds_select_own ON public.owned_backgrounds FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- owned_themes
DROP POLICY IF EXISTS owned_themes_select_own ON public.owned_themes;
CREATE POLICY owned_themes_select_own ON public.owned_themes FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- owned_fonts
DROP POLICY IF EXISTS owned_fonts_select_own ON public.owned_fonts;
CREATE POLICY owned_fonts_select_own ON public.owned_fonts FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- user_achievements
DROP POLICY IF EXISTS user_achievements_select_own ON public.user_achievements;
CREATE POLICY user_achievements_select_own ON public.user_achievements FOR SELECT USING ((SELECT auth.uid()) = user_id);
