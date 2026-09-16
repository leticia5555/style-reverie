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
  -- Se pone al promover una candidata desde /alerts. Null = venía del seed o
  -- se catalogó a mano. Marca las que todavía no tienen histórico propio.
  promoted_at     timestamptz,
  updated_at      timestamptz not null default now()
);

-- Para las bases anteriores a la promoción de candidatas.
alter table trends add column if not exists promoted_at timestamptz;

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

-- Candidatas a tendencia detectadas en prensa y todavía sin catalogar.
-- El conteo de menciones se acumula: una candidata que aparece tres semanas
-- seguidas pesa más que una que salió un día.
create table if not exists trend_candidates (
  slug          text primary key,
  name_es       text not null,
  category      text,
  mentions      integer not null default 0,
  first_seen    date not null,
  last_seen     date not null,
  -- Medios distintos que la han mencionado alguna vez.
  --
  -- Se guarda la lista, no el conteo, y aparte de evidence: los titulares se
  -- recortan a los 20 más recientes y el recorte se llevaría por delante al
  -- medio que solo apareció una vez hace meses. Son cuatro nombres, caben.
  outlets       text[] not null default '{}',
  -- Titulares que la respaldan, los más recientes primero.
  evidence      jsonb not null default '[]'::jsonb,
  -- Se marca al promover al catálogo.
  promoted_at   timestamptz,
  -- Se marca al descartarla a mano: no vuelve a aparecer en /alerts, pero la
  -- fila se queda para que el descubrimiento no la vuelva a proponer como
  -- novedad cada semana.
  discarded_at  timestamptz
);

alter table trend_candidates add column if not exists discarded_at timestamptz;

-- Para las bases que se crearon antes de que outlets existiera.
alter table trend_candidates
  add column if not exists outlets text[] not null default '{}';

-- Y las candidatas que ya estaban guardadas se rellenan desde su evidencia,
-- o aparecerían con cero medios hasta que la prensa volviera a nombrarlas.
-- Solo toca las que están vacías, así que repetir la migración no hace nada.
update trend_candidates
   set outlets = (
     select coalesce(array_agg(distinct item->>'source'), '{}')
       from jsonb_array_elements(evidence) as item
   )
 where cardinality(outlets) = 0
   and jsonb_array_length(evidence) > 0;

-- Primero por medios distintos: un listicle de una sola revista produce cinco
-- candidatas con una mención cada una, y ninguna vale lo que una tendencia que
-- citan cinco medios.
create index if not exists trend_candidates_rank_idx
  on trend_candidates (cardinality(outlets) desc, mentions desc, last_seen desc);

-- Fotos curadas a mano desde /admin/imagenes.
--
-- Viven aquí y no en content/ porque content/ se lee con fs durante el build y
-- en Vercel el disco es de solo lectura: una página web no puede escribir un
-- JSON del repo. content/trends/ sigue existiendo como fallback versionado.
--
-- El crédito y el enlace son NOT NULL a propósito: una foto prestada sin decir
-- de quién es no se enseña, y dejar que la columna admita null abriría ese
-- camino desde el primer insert descuidado.
create table if not exists trend_images (
  trend_id    text primary key references trends(id) on delete cascade,
  image_url   text not null,
  credit      text not null,
  credit_url  text not null,
  updated_at  timestamptz not null default now()
);

-- Hosts de imagen aprobados desde el panel, además de los de IMAGE_HOSTS.
--
-- Es lo que hace seguro al proxy de /api/image: sin esta lista sería un proxy
-- abierto y cualquiera podría usar el dominio para pedir lo que quisiera.
create table if not exists image_hosts (
  host        text primary key,
  added_at    timestamptz not null default now()
);
