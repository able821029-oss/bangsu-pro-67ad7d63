-- 1. posts 테이블에 user_id 컬럼 추가
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. videos 테이블에 user_id 컬럼 추가
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. posts RLS: USING(true) → auth.uid() = user_id
DROP POLICY IF EXISTS "Allow all select" ON public.posts;
DROP POLICY IF EXISTS "Allow all insert" ON public.posts;
DROP POLICY IF EXISTS "Allow all update" ON public.posts;
DROP POLICY IF EXISTS "Allow all delete" ON public.posts;

CREATE POLICY "Users can view own posts" ON public.posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- 4. videos RLS: USING(true) → auth.uid() = user_id
DROP POLICY IF EXISTS "Allow all select on videos" ON public.videos;
DROP POLICY IF EXISTS "Allow all insert on videos" ON public.videos;
DROP POLICY IF EXISTS "Allow all update on videos" ON public.videos;
DROP POLICY IF EXISTS "Allow all delete on videos" ON public.videos;

CREATE POLICY "Users can view own videos" ON public.videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own videos" ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON public.videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON public.videos FOR DELETE USING (auth.uid() = user_id);

-- 5. subscriptions RLS: USING(true) → auth.uid() = user_id (이미 user_id 존재)
DROP POLICY IF EXISTS "Allow all select on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow all insert on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow all update on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow all delete on subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
