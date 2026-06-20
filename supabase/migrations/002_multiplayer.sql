-- =============================================================================
-- Super Gate — Migration 002: Multiplayer Shared Gambling Table
-- Chạy trong Supabase SQL Editor sau 001_initial.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GAME ROOMS
-- -----------------------------------------------------------------------------
create table if not exists public.game_rooms (
  id            uuid primary key default gen_random_uuid(),
  room_code     text unique not null,          -- 6 ký tự, user share nhau
  game_type     text not null,                 -- 'bau_cua' | 'do_den' | 'xi_jack'
  host_id       uuid not null references public.players(id) on delete cascade,
  status        text not null default 'waiting',
  -- 'waiting'  → chờ người vào
  -- 'betting'  → đang đặt cược
  -- 'rolling'  → đã có kết quả, đang show animation
  -- 'finished' → phòng đã đóng
  is_public     boolean not null default false,
  max_players   int not null default 6,
  min_bet       int not null default 10,
  max_bet       int not null default 500,
  round_number  int not null default 0,
  game_state    jsonb,
  -- bau_cua:  {"dice": [0,2,4]}          (index vào enum _Sym)
  -- do_den:   {"card": {"suit":"hearts","rank":"K","isRed":true}}
  -- xi_jack:  {"deck_seed": 12345}        (seed để deal bài deterministic)
  expires_at    timestamptz not null default (now() + interval '3 hours'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists game_rooms_status_idx on public.game_rooms(status);
create index if not exists game_rooms_game_type_idx on public.game_rooms(game_type);
create index if not exists game_rooms_is_public_idx on public.game_rooms(is_public);

-- Auto-cleanup phòng hết hạn (chạy qua pg_cron nếu bật, hoặc để manual)
-- delete from public.game_rooms where expires_at < now();

-- -----------------------------------------------------------------------------
-- ROOM PLAYERS
-- -----------------------------------------------------------------------------
create table if not exists public.room_players (
  room_id       uuid not null references public.game_rooms(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  display_name  text not null,
  bet_amount    int not null default 0,
  bet_choice    text,          -- bau_cua: '0'..'5' | do_den: 'red'/'black' | xi_jack: null
  result_delta  int not null default 0,   -- net xu round này (+/-)
  total_delta   int not null default 0,   -- cộng dồn toàn phòng
  xi_jack_result text,         -- 'win'|'lose'|'push'|'blackjack' cho xi_jack
  is_ready      boolean not null default false,
  joined_at     timestamptz not null default now(),
  primary key (room_id, player_id)
);

create index if not exists room_players_room_idx on public.room_players(room_id);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.game_rooms  enable row level security;
alter table public.room_players enable row level security;

-- game_rooms: đọc phòng public hoặc phòng mình đang ở
create policy "game_rooms: select"
  on public.game_rooms for select
  using (
    is_public = true
    or host_id = auth.uid()
    or exists (
      select 1 from public.room_players rp
      where rp.room_id = game_rooms.id
        and rp.player_id = auth.uid()
    )
  );

-- game_rooms: tạo phòng (phải là chủ phòng)
create policy "game_rooms: insert"
  on public.game_rooms for insert
  with check (auth.uid() = host_id);

-- game_rooms: chỉ host được cập nhật
create policy "game_rooms: update by host"
  on public.game_rooms for update
  using (auth.uid() = host_id);

-- game_rooms: host có thể xóa phòng
create policy "game_rooms: delete by host"
  on public.game_rooms for delete
  using (auth.uid() = host_id);

-- room_players: đọc tất cả players trong phòng mình đang ở
create policy "room_players: select"
  on public.room_players for select
  using (
    exists (
      select 1 from public.room_players rp2
      where rp2.room_id = room_players.room_id
        and rp2.player_id = auth.uid()
    )
  );

-- room_players: tự join phòng
create policy "room_players: insert own"
  on public.room_players for insert
  with check (auth.uid() = player_id);

-- room_players: tự update record của mình
create policy "room_players: update own"
  on public.room_players for update
  using (auth.uid() = player_id);

-- room_players: tự rời phòng
create policy "room_players: delete own"
  on public.room_players for delete
  using (auth.uid() = player_id);

-- -----------------------------------------------------------------------------
-- TRIGGER: updated_at cho game_rooms
-- -----------------------------------------------------------------------------
create trigger game_rooms_updated_at
  before update on public.game_rooms
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- HELPER FUNCTION: generate unique room code
-- -----------------------------------------------------------------------------
create or replace function public.generate_room_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- loại I,O,0,1 dễ nhầm
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    select exists(select 1 from public.game_rooms where room_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- Realtime: bật cho 2 bảng
-- Vào Supabase Dashboard → Realtime → Tables → bật game_rooms + room_players
