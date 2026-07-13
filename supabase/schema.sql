create extension if not exists "pgcrypto";

create or replace function public.normalizar_nombre_personal(nombre text)
returns text
language sql
immutable
as $$
  select lower(
    btrim(
      regexp_replace(
        translate(
          coalesce(nombre, ''),
          'ÁÉÍÓÚÜÑáéíóúüñ',
          'AEIOUUNaeiouun'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.configuracion_rotacion (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  semanas_por_ciclo integer not null default 4,
  dias_a_recorrer integer not null default 1,
  direccion text not null default 'adelante' check (direccion in ('adelante', 'atras')),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  nombre_normalizado text unique,
  puesto text not null check (puesto in ('Supervisor', 'Monitorista')),
  turno_id uuid references public.turnos(id),
  activo boolean not null default true,
  puede_cubrir_descansos boolean not null default false,
  puede_ser_monitorista boolean not null default false,
  descanso_base_1 text check (descanso_base_1 in ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo')),
  descanso_base_2 text check (descanso_base_2 in ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo')),
  fecha_inicio_ciclo date,
  regla_rotacion text default '+1 dia cada 4 semanas',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.bloques (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  orden integer,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.cobertura_mensual (
  id uuid primary key default gen_random_uuid(),
  mes integer not null check (mes between 1 and 12),
  anio integer not null,
  personal_id uuid references public.personal(id),
  rol_cobertura text not null check (rol_cobertura in ('Cobertura principal', 'Cobertura secundaria')),
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (mes, anio, rol_cobertura)
);

create table if not exists public.asignacion_bloques_mensual (
  id uuid primary key default gen_random_uuid(),
  mes integer not null check (mes between 1 and 12),
  anio integer not null,
  personal_id uuid not null references public.personal(id),
  bloque_id uuid not null references public.bloques(id),
  bloque_mes_anterior_id uuid constraint asignacion_bloques_mensual_bloque_mes_anterior_id_fkey references public.bloques(id),
  bloque_siguiente_sugerido_id uuid constraint asignacion_bloques_mensual_bloque_siguiente_sugerido_id_fkey references public.bloques(id),
  tipo_asignacion text not null default 'Titular' check (tipo_asignacion in ('Titular', 'Cobertura', 'Supervisor como monitorista')),
  confirmado boolean not null default false,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (mes, anio, personal_id)
);

create table if not exists public.dias_especiales (
  id uuid primary key default gen_random_uuid(),
  dia_semana text check (dia_semana in ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo')),
  requiere_un_supervisor boolean not null default true,
  cantidad_supervisores integer not null default 1,
  cantidad_monitoristas integer not null default 4,
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists public.roles_mensuales (
  id uuid primary key default gen_random_uuid(),
  mes integer not null check (mes between 1 and 12),
  anio integer not null,
  turno_id uuid references public.turnos(id),
  estatus text not null default 'Borrador' check (estatus in ('Borrador', 'Propuesta', 'Confirmado', 'Cerrado')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.rol_diario (
  id uuid primary key default gen_random_uuid(),
  rol_mensual_id uuid references public.roles_mensuales(id) on delete cascade,
  fecha date not null,
  dia_semana text check (dia_semana in ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo')),
  mes integer not null check (mes between 1 and 12),
  anio integer not null,
  turno_id uuid references public.turnos(id),
  supervisor_id uuid references public.personal(id),
  bloque_1_personal_id uuid references public.personal(id),
  bloque_2_personal_id uuid references public.personal(id),
  bloque_3_personal_id uuid references public.personal(id),
  bloque_4_personal_id uuid references public.personal(id),
  bloque_5_personal_id uuid references public.personal(id),
  cobertura_personal_id uuid references public.personal(id),
  falta_personal_id uuid references public.personal(id),
  estatus_dia text,
  motivo text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.turnos add column if not exists updated_at timestamptz;

alter table public.personal add column if not exists nombre_normalizado text;
alter table public.personal add column if not exists puede_ser_monitorista boolean not null default false;
alter table public.personal add column if not exists updated_at timestamptz;

alter table public.bloques add column if not exists orden integer;
alter table public.bloques add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bloques' and column_name = 'numero'
  ) then
    update public.bloques set orden = numero where orden is null;
  end if;
end $$;

update public.bloques
set orden = orden_faltante.orden
from (
  select id, row_number() over (order by created_at, nombre)::integer as orden
  from public.bloques
  where orden is null
) as orden_faltante
where public.bloques.id = orden_faltante.id;

alter table public.cobertura_mensual add column if not exists rol_cobertura text;
alter table public.cobertura_mensual add column if not exists activo boolean not null default true;
alter table public.cobertura_mensual add column if not exists updated_at timestamptz;
update public.cobertura_mensual
set rol_cobertura = 'Cobertura principal'
where rol_cobertura is null;

alter table public.asignacion_bloques_mensual add column if not exists bloque_mes_anterior_id uuid references public.bloques(id);
alter table public.asignacion_bloques_mensual add column if not exists bloque_siguiente_sugerido_id uuid references public.bloques(id);
alter table public.asignacion_bloques_mensual add column if not exists tipo_asignacion text not null default 'Titular';
alter table public.asignacion_bloques_mensual add column if not exists confirmado boolean not null default false;
alter table public.asignacion_bloques_mensual add column if not exists observaciones text;
alter table public.asignacion_bloques_mensual add column if not exists updated_at timestamptz;

alter table public.roles_mensuales add column if not exists observaciones text;
alter table public.roles_mensuales add column if not exists updated_at timestamptz;

alter table public.rol_diario add column if not exists rol_mensual_id uuid references public.roles_mensuales(id) on delete cascade;
alter table public.rol_diario add column if not exists dia_semana text;
alter table public.rol_diario add column if not exists supervisor_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists bloque_1_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists bloque_2_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists bloque_3_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists bloque_4_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists bloque_5_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists cobertura_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists falta_personal_id uuid references public.personal(id);
alter table public.rol_diario add column if not exists estatus_dia text;
alter table public.rol_diario add column if not exists motivo text;

create or replace function public.set_nombre_normalizado()
returns trigger
language plpgsql
as $$
begin
  new.nombre_completo := btrim(regexp_replace(new.nombre_completo, '\s+', ' ', 'g'));
  new.nombre_normalizado := public.normalizar_nombre_personal(new.nombre_completo);
  return new;
end;
$$;

drop trigger if exists trg_personal_nombre_normalizado on public.personal;
create trigger trg_personal_nombre_normalizado
before insert or update of nombre_completo
on public.personal
for each row execute function public.set_nombre_normalizado();

create unique index if not exists bloques_orden_uidx on public.bloques (orden);
create index if not exists rol_diario_mes_anio_idx on public.rol_diario (mes, anio);
create index if not exists asignacion_bloques_mes_anio_idx on public.asignacion_bloques_mensual (mes, anio);

alter table public.turnos enable row level security;
alter table public.configuracion_rotacion enable row level security;
alter table public.personal enable row level security;
alter table public.bloques enable row level security;
alter table public.cobertura_mensual enable row level security;
alter table public.asignacion_bloques_mensual enable row level security;
alter table public.dias_especiales enable row level security;
alter table public.roles_mensuales enable row level security;
alter table public.rol_diario enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'turnos',
    'configuracion_rotacion',
    'personal',
    'bloques',
    'cobertura_mensual',
    'asignacion_bloques_mensual',
    'dias_especiales',
    'roles_mensuales',
    'rol_diario'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'anon select ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'anon insert ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'anon update ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'anon delete ' || table_name, table_name);
    execute format('create policy %I on public.%I for select using (true)', 'anon select ' || table_name, table_name);
    execute format('create policy %I on public.%I for insert with check (true)', 'anon insert ' || table_name, table_name);
    execute format('create policy %I on public.%I for update using (true) with check (true)', 'anon update ' || table_name, table_name);
    execute format('create policy %I on public.%I for delete using (true)', 'anon delete ' || table_name, table_name);
  end loop;
end $$;

insert into public.turnos (nombre, hora_inicio, hora_fin, activo)
select 'Matutino', '06:00', '15:00', true
where not exists (select 1 from public.turnos where nombre = 'Matutino');

insert into public.configuracion_rotacion (nombre, semanas_por_ciclo, dias_a_recorrer, direccion, activa)
select 'Rotacion base matutina', 4, 1, 'adelante', true
where not exists (select 1 from public.configuracion_rotacion where activa = true);

insert into public.bloques (orden, nombre, descripcion, activo)
select seed.orden, seed.nombre, seed.descripcion, true
from (
  values
    (1, 'Bloque 1', 'Bloque operativo fijo 1'),
    (2, 'Bloque 2', 'Bloque operativo fijo 2'),
    (3, 'Bloque 3', 'Bloque operativo fijo 3'),
    (4, 'Bloque 4', 'Bloque operativo fijo 4'),
    (5, 'Bloque 5', 'Bloque operativo fijo 5')
) as seed(orden, nombre, descripcion)
where not exists (select 1 from public.bloques where public.bloques.orden = seed.orden);

with turno_matutino as (
  select id from public.turnos where nombre = 'Matutino' order by created_at limit 1
)
insert into public.personal (
  nombre_completo,
  puesto,
  turno_id,
  activo,
  puede_cubrir_descansos,
  puede_ser_monitorista,
  descanso_base_1,
  descanso_base_2,
  fecha_inicio_ciclo,
  regla_rotacion
)
select
  seed.nombre_completo,
  seed.puesto,
  turno_matutino.id,
  true,
  seed.puede_cubrir_descansos,
  seed.puede_ser_monitorista,
  seed.descanso_base_1,
  seed.descanso_base_2,
  '2026-06-22'::date,
  '+1 dia cada 4 semanas'
from (
  values
    ('Jimi Yamil Sánchez Olvera', 'Supervisor', true, true, 'Lunes', 'Martes'),
    ('José Guadalupe Salgado', 'Supervisor', true, true, 'Miercoles', 'Jueves'),
    ('Blanca Elizabeth Sánchez', 'Monitorista', false, true, 'Viernes', 'Sabado'),
    ('Aldeni Abigail Sánchez Olvera', 'Monitorista', true, true, 'Lunes', 'Domingo'),
    ('Josué Ricardo García Santana', 'Monitorista', false, true, 'Martes', 'Miercoles'),
    ('Karina Serrano Martínez', 'Monitorista', false, true, 'Jueves', 'Viernes'),
    ('Irma Gómez García', 'Monitorista', true, true, 'Sabado', 'Domingo'),
    ('Elías Valencia Pastrana', 'Monitorista', false, true, 'Miercoles', 'Jueves')
) as seed(nombre_completo, puesto, puede_cubrir_descansos, puede_ser_monitorista, descanso_base_1, descanso_base_2)
cross join turno_matutino
where not exists (
  select 1 from public.personal
  where public.personal.nombre_normalizado = public.normalizar_nombre_personal(seed.nombre_completo)
);

insert into public.dias_especiales (dia_semana, cantidad_supervisores, cantidad_monitoristas, activo, observaciones)
select seed.dia_semana, 1, 4, true, 'Dia especial operativo'
from (values ('Sabado'), ('Domingo')) as seed(dia_semana)
where not exists (select 1 from public.dias_especiales where dia_semana = seed.dia_semana);
