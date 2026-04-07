-- mona12 폰트를 물마루(Mulmaru)로 교체 + 그리운경찰감성체, 본명조체 추가

UPDATE public.shop_fonts
SET
  font_key = 'mulmaru',
  name = '물마루',
  font_family = '"Mulmaru", sans-serif',
  import_url = NULL,
  font_face_css = $$@font-face { font-family: 'Mulmaru'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-4@1.1/Mulmaru.woff2') format('woff2'); font-weight: normal; font-display: swap; }$$
WHERE font_key = 'mona12';

INSERT INTO public.shop_fonts (font_key, name, font_family, import_url, font_face_css, price)
VALUES (
  'nostalgicpolice',
  '그리운경찰감성체',
  '"NostalgicPoliceVibe", sans-serif',
  NULL,
  $$@font-face { font-family: 'NostalgicPoliceVibe'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2601-6@1.0/Griun_PolSensibility-Rg.woff2') format('woff2'); font-weight: normal; font-display: swap; }$$,
  1000
)
ON CONFLICT (font_key) DO NOTHING;

INSERT INTO public.shop_fonts (font_key, name, font_family, import_url, font_face_css, price)
VALUES (
  'bonmyeongjo',
  '본명조체',
  '"BonmyeongjoSourceHanSerif", serif',
  NULL,
  $$@font-face { font-family: 'BonmyeongjoSourceHanSerif'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NotoSerifKR.woff') format('woff'); font-weight: normal; font-display: swap; }$$,
  1000
)
ON CONFLICT (font_key) DO NOTHING;
