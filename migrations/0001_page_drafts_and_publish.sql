alter table public.pages add column if not exists draft jsonb;
alter table public.pages add column if not exists published_at timestamptz;

create or replace function public.publish_page(_page_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d jsonb; b jsonb; i int := 0;
begin
  if not public.is_staff(auth.uid()) then raise exception 'forbidden'; end if;
  select draft into d from public.pages where id = _page_id for update;
  if d is not null then
    update public.pages set
      title = coalesce(d->>'title', title),
      seo_title = nullif(d->>'seo_title',''),
      meta_description = nullif(d->>'meta_description',''),
      og_image = nullif(d->>'og_image','')
    where id = _page_id;
    if d ? 'blocks' then
      delete from public.blocks where page_id = _page_id;
      for b in select * from jsonb_array_elements(d->'blocks') loop
        insert into public.blocks (id, page_id, type, data, sort_order)
        values (coalesce((b->>'id')::uuid, gen_random_uuid()), _page_id, b->>'type', coalesce(b->'data','{}'::jsonb), i);
        i := i + 1;
      end loop;
    end if;
  end if;
  update public.pages set draft = null, status = 'live', published_at = now(), updated_at = now() where id = _page_id;
end $$;
revoke all on function public.publish_page(uuid) from public, anon;
grant execute on function public.publish_page(uuid) to authenticated;