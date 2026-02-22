-- Agent 自售/出租房源：作为客户的一种，复用 customer_groups 表
-- group_type: 'client' | 'listing'；listing 时 property_id 指向 agent 的房源

ALTER TABLE public.customer_groups
  ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'client'
    CHECK (group_type IN ('client', 'listing'));

ALTER TABLE public.customer_groups
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;

-- intent 扩展：client 用 buy/rent，listing 用 sale/rent（出售/出租）
ALTER TABLE public.customer_groups DROP CONSTRAINT IF EXISTS customer_groups_intent_check;

ALTER TABLE public.customer_groups
  ADD CONSTRAINT customer_groups_intent_check
  CHECK (intent IN ('buy', 'rent', 'sale'));

COMMENT ON COLUMN public.customer_groups.group_type IS 'client=买家/租客, listing=出售/出租房源';
COMMENT ON COLUMN public.customer_groups.property_id IS '仅 listing 类型时设置，指向 agent 自售/出租的房源';

CREATE INDEX IF NOT EXISTS idx_customer_groups_group_type ON public.customer_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_customer_groups_property_id ON public.customer_groups(property_id);
