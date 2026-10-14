-- ---------------------------------------------------------------------------
-- Telegram bot conversation memory (apply in Supabase SQL editor)
-- Idempotent: safe to run more than once. The bot still answers without it,
-- it just forgets earlier messages.
-- ---------------------------------------------------------------------------

-- One row per answered question. bot_message_ids holds every Telegram message
-- the answer was split into, so a reply to any part of it finds the exchange.
-- reply_to_bot_message_id links a follow-up to the bot message it replied to,
-- which is how reply threads are walked back.
create table if not exists telegram_exchanges (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  question_message_id bigint not null,
  reply_to_bot_message_id bigint,
  bot_message_ids bigint[] not null,
  asker_name text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_exchanges_chat_id_created_at_idx
  on telegram_exchanges (chat_id, created_at desc);

create index if not exists telegram_exchanges_bot_message_ids_idx
  on telegram_exchanges using gin (bot_message_ids);

alter table telegram_exchanges enable row level security;

drop policy if exists "bot can read telegram exchanges" on telegram_exchanges;
create policy "bot can read telegram exchanges"
  on telegram_exchanges for select
  to anon
  using (true);

drop policy if exists "bot can insert telegram exchanges" on telegram_exchanges;
create policy "bot can insert telegram exchanges"
  on telegram_exchanges for insert
  to anon
  with check (true);

-- /clear: forget one chat's conversation. The anon role still has no delete
-- policy; this function deletes only the given chat's rows and returns how many.
create or replace function clear_telegram_memory(p_chat_id bigint)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from telegram_exchanges where chat_id = p_chat_id returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function clear_telegram_memory(bigint) from public;
grant execute on function clear_telegram_memory(bigint) to anon;

-- Retention: a nightly job deletes exchanges older than 7 days. The bot only
-- needs recent context (30-minute chat window, reply threads), and the anon
-- role gets no delete policy, so cleanup runs inside the database.
create extension if not exists pg_cron;

-- cron.schedule with an existing job name replaces that job, so re-running is safe.
select cron.schedule(
  'telegram-exchanges-retention',
  '17 3 * * *',
  $$delete from telegram_exchanges where created_at < now() - interval '7 days'$$
);

notify pgrst, 'reload schema';

-- Check the job after applying:
--   select jobname, schedule, active from cron.job where jobname = 'telegram-exchanges-retention';
