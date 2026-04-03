CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT '무료',
  payment_method TEXT NOT NULL DEFAULT 'kakao' CHECK (payment_method IN ('toss', 'kakao')),
  billing_key TEXT,
  kakao_sid TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  amount INTEGER NOT NULL DEFAULT 0,
  partner_order_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on subscriptions" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow all insert on subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on subscriptions" ON public.subscriptions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on subscriptions" ON public.subscriptions FOR DELETE USING (true);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();