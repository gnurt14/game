-- =============================================================================
-- Super Gate — Supabase Initial Migration
-- Chạy file này trong Supabase SQL Editor (project → SQL Editor → New query)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PLAYERS TABLE — 1 row per anonymous user
-- -----------------------------------------------------------------------------
create table if not exists public.players (
  id                      uuid primary key,   -- = auth.users.id
  display_name            text not null default 'Khách',
  coin_balance            integer not null default 500,
  is_new_player           boolean not null default true,
  free_lucky_boxes        integer not null default 3,

  -- Streak / daily
  streak_day              integer not null default 0,
  streak_last_claim_date  date,
  shield_count            integer not null default 0,
  booster_expiry_at       timestamptz,

  -- Daily game tracking (JSON array of game names)
  games_played_today      jsonb not null default '[]',
  games_played_date       date,

  -- Daily missions
  mission3_collected_date date,
  mission5_collected_date date,

  -- Stats
  total_games_played      integer not null default 0,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Row Level Security — mỗi user chỉ đọc/ghi record của chính mình
alter table public.players enable row level security;

create policy "players: own row read"
  on public.players for select
  using (auth.uid() = id);

create policy "players: own row write"
  on public.players for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- WEEKLY MISSIONS TABLE
-- -----------------------------------------------------------------------------
create table if not exists public.weekly_missions (
  player_id           uuid references public.players(id) on delete cascade,
  week_start_date     date not null,           -- Monday of current week
  categories_done     text[] not null default '{}',   -- ['lucky','action','puzzle','strategy']
  gambling_wins       integer not null default 0,
  is_category_rewarded boolean not null default false,
  is_gambling_rewarded boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (player_id, week_start_date)
);

alter table public.weekly_missions enable row level security;

create policy "weekly_missions: own row"
  on public.weekly_missions for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

-- -----------------------------------------------------------------------------
-- ACHIEVEMENTS TABLE
-- -----------------------------------------------------------------------------
create table if not exists public.player_achievements (
  player_id       uuid references public.players(id) on delete cascade,
  achievement_key text not null,
  earned_at       timestamptz not null default now(),
  primary key (player_id, achievement_key)
);

alter table public.player_achievements enable row level security;

create policy "achievements: own row"
  on public.player_achievements for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

-- -----------------------------------------------------------------------------
-- GAME SCORES TABLE (optional leaderboard foundation)
-- -----------------------------------------------------------------------------
create table if not exists public.game_scores (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references public.players(id) on delete cascade,
  game_name   text not null,
  score       integer not null,
  created_at  timestamptz not null default now()
);

alter table public.game_scores enable row level security;

create policy "game_scores: own insert"
  on public.game_scores for insert
  with check (auth.uid() = player_id);

create policy "game_scores: own select"
  on public.game_scores for select
  using (auth.uid() = player_id);

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create trigger weekly_missions_updated_at
  before update on public.weekly_missions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- FUNCTION: upsert_player_on_signup
-- Tự động tạo player record khi user anonymous đăng ký lần đầu
-- Gắn vào Authentication → Hooks → "After each sign in" trong Supabase dashboard
-- HOẶC gọi thủ công từ Flutter sau signInAnonymously()
-- -----------------------------------------------------------------------------
create or replace function public.create_player_if_not_exists(
  p_user_id uuid,
  p_display_name text default 'Khách'
)
returns void language plpgsql security definer as $$
begin
  insert into public.players (id, display_name)
  values (p_user_id, p_display_name)
  on conflict (id) do nothing;
end;
$$;
