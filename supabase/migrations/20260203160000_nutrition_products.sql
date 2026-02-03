-- Products database for nutrition planning
-- Stores common sports nutrition products with their nutritional data

create table if not exists public.nutrition_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  
  -- Basic info
  name text not null,
  brand text,
  category text not null check (category in ('drink', 'food', 'supplement', 'bar', 'gel', 'salt_capsule', 'other')),
  description text,
  
  -- Serving info
  serving_size numeric not null,
  serving_unit text not null check (serving_unit in ('g', 'ml', 'pieces', 'packet', 'capsule', 'tablet')),
  
  -- Nutritional data per serving
  calories numeric,
  carbs_g numeric,
  protein_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  potassium_mg numeric,
  magnesium_mg numeric,
  caffeine_mg numeric,
  
  -- Product details
  price_usd numeric,
  availability text, -- 'common', 'specialty', 'online_only'
  is_vegan boolean default false,
  is_gluten_free boolean default false,
  is_dairy_free boolean default false,
  allergens text, -- comma-separated
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_default boolean not null default false -- Pre-loaded products
);

-- User's custom products
create table if not exists public.user_nutrition_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Reference to default product or custom data
  product_id uuid references public.nutrition_products(id) on delete set null,
  
  -- Custom product info (if not referencing default product)
  custom_name text,
  custom_serving_size numeric,
  custom_serving_unit text,
  custom_carbs_g numeric,
  custom_protein_g numeric,
  custom_sodium_mg numeric,
  
  -- Usage
  rating numeric check (rating >= 0 and rating <= 5),
  notes text,
  last_used_at timestamptz,
  usage_count int default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists nutrition_products_category_idx on public.nutrition_products (category);
create index if not exists nutrition_products_brand_idx on public.nutrition_products (brand);
create index if not exists nutrition_products_is_default_idx on public.nutrition_products (is_default);
create index if not exists user_nutrition_products_user_id_idx on public.user_nutrition_products (user_id);
create index if not exists user_nutrition_products_product_id_idx on public.user_nutrition_products (product_id);

-- Enable RLS
alter table public.nutrition_products enable row level security;
alter table public.user_nutrition_products enable row level security;

-- RLS Policies for nutrition_products
-- Public can read default products
create policy "nutrition_products_public_read" on public.nutrition_products
  for select using (is_default = true);

-- Users can read their own custom products
create policy "nutrition_products_user_read_own" on public.nutrition_products
  for select using (user_id = auth.uid());

-- Users can create custom products
create policy "nutrition_products_user_create" on public.nutrition_products
  for insert with check (user_id = auth.uid());

-- Users can update their own products
create policy "nutrition_products_user_update" on public.nutrition_products
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admins only can delete
create policy "nutrition_products_admin_delete" on public.nutrition_products
  for delete using (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for user_nutrition_products
create policy "user_nutrition_products_select_own" on public.user_nutrition_products
  for select using (user_id = auth.uid());

create policy "user_nutrition_products_insert_own" on public.user_nutrition_products
  for insert with check (user_id = auth.uid());

create policy "user_nutrition_products_update_own" on public.user_nutrition_products
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user_nutrition_products_delete_own" on public.user_nutrition_products
  for delete using (user_id = auth.uid());

-- Insert default products
insert into public.nutrition_products (
  name, brand, category, serving_size, serving_unit,
  calories, carbs_g, protein_g, sodium_mg, is_default, description
) values
  ('Sports Drink - Orange', 'Gatorade', 'drink', 250, 'ml', 60, 15, 0, 200, true, 'Isotonic sports drink with carbs and electrolytes'),
  ('Sports Drink - Tropical', 'Pocari Sweat', 'drink', 250, 'ml', 50, 12, 0, 180, true, 'Ion supply drink'),
  ('Energy Bar', 'Clif Bar', 'bar', 68, 'g', 240, 43, 9, 160, true, 'Whole grain energy bar'),
  ('Sports Gel', 'GU', 'gel', 32, 'g', 100, 25, 0, 40, true, 'Quick carbs energy gel'),
  ('Electrolyte Drink', 'Nuun', 'drink', 500, 'ml', 10, 2, 0, 500, true, 'Low calorie electrolyte drink'),
  ('Protein Drink', 'Chocolate Milk', 'drink', 240, 'ml', 200, 26, 8, 150, true, 'Chocolate milk with protein'),
  ('Banana', 'Fresh', 'food', 100, 'g', 89, 23, 1, 1, true, 'Natural carbs and potassium'),
  ('Oatmeal', 'Generic', 'food', 50, 'g', 190, 27, 5, 2, true, 'Slow-release carbs'),
  ('Salt Capsules', 'Hammer Nutrition', 'salt_capsule', 300, 'mg', 0, 0, 0, 300, true, 'Electrolyte replacement'),
  ('Caffeine Tablet', 'GU', 'supplement', 100, 'mg', 0, 0, 0, 0, true, 'Caffeine for endurance')
on conflict do nothing;
