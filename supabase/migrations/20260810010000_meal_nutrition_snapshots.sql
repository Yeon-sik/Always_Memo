-- Immutable Fitness meal composition snapshots stored with the shared meal parent.

begin;

create table if not exists public.meal_record_items (
  id uuid primary key,
  user_id text not null,
  meal_record_id uuid not null,
  food_id text,
  food_name_snapshot text not null,
  food_kind_snapshot text,
  quantity double precision not null,
  unit text not null,
  basis_amount_snapshot double precision,
  basis_unit_snapshot text,
  prep_state_snapshot text,
  calories double precision not null default 0,
  protein_grams double precision not null default 0,
  carbs_grams double precision not null default 0,
  fat_grams double precision not null default 0,
  sodium_mg double precision,
  saturated_fat_grams double precision,
  sugars_grams double precision,
  fiber_grams double precision,
  added_sugars_grams double precision,
  trans_fat_grams double precision,
  cholesterol_mg double precision,
  source_type_snapshot text,
  source_reference_snapshot text,
  source_version_snapshot text,
  food_data_version_snapshot integer,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint meal_record_items_meal_fk
    foreign key (meal_record_id)
    references public.meal_records(id),
  constraint meal_record_items_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_record_item_nutrients (
  id uuid primary key,
  user_id text not null,
  meal_record_id uuid not null,
  meal_record_item_id uuid not null,
  nutrient_code text not null,
  amount double precision not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint meal_record_item_nutrients_item_code_key
    unique (meal_record_item_id, nutrient_code),
  constraint meal_record_item_nutrients_meal_fk
    foreign key (meal_record_id)
    references public.meal_records(id),
  constraint meal_record_item_nutrients_item_fk
    foreign key (meal_record_item_id)
    references public.meal_record_items(id),
  constraint meal_record_item_nutrients_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists meal_record_items_user_meal_order_idx
  on public.meal_record_items (user_id, meal_record_id, order_index);

create index if not exists meal_record_item_nutrients_user_meal_idx
  on public.meal_record_item_nutrients (user_id, meal_record_id, nutrient_code);

revoke all on table
  public.meal_record_items,
  public.meal_record_item_nutrients
from anon;

grant select, insert, update, delete on table
  public.meal_record_items,
  public.meal_record_item_nutrients
to authenticated;

alter table public.meal_record_items enable row level security;
alter table public.meal_record_item_nutrients enable row level security;

create policy meal_record_items_select_own
  on public.meal_record_items for select to authenticated
  using ((select auth.uid())::text = user_id);

create policy meal_record_items_insert_own
  on public.meal_record_items for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_records parent
      where parent.id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

create policy meal_record_items_update_own
  on public.meal_record_items for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_records parent
      where parent.id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

create policy meal_record_items_delete_own
  on public.meal_record_items for delete to authenticated
  using ((select auth.uid())::text = user_id);

create policy meal_record_item_nutrients_select_own
  on public.meal_record_item_nutrients for select to authenticated
  using ((select auth.uid())::text = user_id);

create policy meal_record_item_nutrients_insert_own
  on public.meal_record_item_nutrients for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_record_items parent
      where parent.id = meal_record_item_id
        and parent.meal_record_id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

create policy meal_record_item_nutrients_update_own
  on public.meal_record_item_nutrients for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_record_items parent
      where parent.id = meal_record_item_id
        and parent.meal_record_id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

create policy meal_record_item_nutrients_delete_own
  on public.meal_record_item_nutrients for delete to authenticated
  using ((select auth.uid())::text = user_id);

commit;
