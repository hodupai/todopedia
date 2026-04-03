CREATE OR REPLACE FUNCTION public.add_gold(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET gold = GREATEST(gold + p_amount, 0),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;
