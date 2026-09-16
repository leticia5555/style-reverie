-- Esquema de Style Reverie.
--
-- Nada derivado se guarda aquí: el score, el momentum y el ciclo de vida se
-- calculan en lib/ a partir de las señales, para que cambiar los pesos
-- recalcule el histórico completo sin migración.

create table if not exists trends (
  id              text primary key,
  name_es         text not null,
  name_en         text not null,
  category        text not null,
  season          text not null,
  summary_es      text not null,
  summary_en      text not null,
  -- Score compuesto de hace 365 días, para la variación anual.
  -- numeric y no real: float4 no representa 36.8 exactamente y el round-trip
  -- por la base movería los scores en el último decimal.
  score_year_ago  numeric(4, 1) not null,
  -- Términos con los que la prensa nombra la tendencia, ya normalizados.
  keywords        text[] not null default '{}',
  -- Hex del color; solo en las tendencias de categoría color.
  swatch          text,
  shopping        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- Una fila por tendencia, fuente y día. El origen viaja con el dato: la UI
-- nunca mezcla mock y real en una serie sin marcar dónde está el corte.
create table if not exists signals (
  trend_id   text not null references trends(id) on delete cascade,
  source     text not null,
  date       date not null,
  value      numeric(4, 1) not null check (value >= 0 and value <= 100),
  origin     text not null check (origin in ('mock', 'real')),
  created_at timestamptz not null default now(),
  primary key (trend_id, source, date)
);

create index if not exists signals_trend_date_idx on signals (trend_id, date);
create index if not exists signals_origin_idx on signals (origin);

-- Auditoría de cada corrida del cron. Sin esto no hay forma de saber por qué
-- falta un día en una serie.
create table if not exists signal_runs (
  id           bigserial primary key,
  source       text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('ok', 'error', 'skipped')),
  rows_written integer not null default 0,
  detail       text
);

create index if not exists signal_runs_started_idx on signal_runs (started_at desc);

-- Ediciones publicadas, congeladas. Una edición con fecha es un documento, no
-- una consulta: si se recalculara, en cuanto entren datos reales una edición
-- pasada mezclaría mock y real sin avisar.
create table if not exists ediciones (
  date         date primary key,
  published_at timestamptz not null default now(),
  payload      jsonb not null
);
