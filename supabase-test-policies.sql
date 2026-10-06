-- TEST-ONLY: these policies expose the listed tables to the anon API role.
-- Use only with fictitious data and remove these grants/policies before production.

grant usage on schema public to anon;
grant select, insert on table public.usuarios to anon;
grant select, insert, update, delete on table public.lancamentos to anon;
grant select, insert, update, delete on table public.tags to anon;
grant select, insert, update, delete on table public.lancamento_tags to anon;

alter table public.usuarios enable row level security;
alter table public.lancamentos enable row level security;
alter table public.tags enable row level security;
alter table public.lancamento_tags enable row level security;

drop policy if exists "financapp_test_anon_users_read" on public.usuarios;
create policy "financapp_test_anon_users_read"
  on public.usuarios for select to anon
  using (true);

drop policy if exists "financapp_test_anon_users_insert" on public.usuarios;
create policy "financapp_test_anon_users_insert"
  on public.usuarios for insert to anon
  with check (true);

drop policy if exists "financapp_test_anon_transactions" on public.lancamentos;
create policy "financapp_test_anon_transactions"
  on public.lancamentos for all to anon
  using (true) with check (true);

drop policy if exists "financapp_test_anon_tags" on public.tags;
create policy "financapp_test_anon_tags"
  on public.tags for all to anon
  using (true) with check (true);

drop policy if exists "financapp_test_anon_transaction_tags" on public.lancamento_tags;
create policy "financapp_test_anon_transaction_tags"
  on public.lancamento_tags for all to anon
  using (true) with check (true);
