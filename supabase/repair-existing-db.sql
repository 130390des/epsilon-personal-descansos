create extension if not exists "pgcrypto";

alter table public.turnos add column if not exists updated_at timestamptz;

alter table public.personal add column if not exists nombre_normalizado text;
alter table public.personal add column if not exists puede_ser_monitorista boolean not null default false;
alter table public.personal add column if not exists updated_at timestamptz;

update public.personal
set puede_ser_monitorista = true
where puesto in ('Monitorista', 'Supervisor')
  and puede_ser_monitorista = false;

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

update public.personal
set nombre_normalizado = public.normalizar_nombre_personal(nombre_completo)
where nombre_normalizado is null;

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

create temp table if not exists tmp_personal_duplicado_merge (
  duplicate_id uuid primary key,
  keep_id uuid not null
) on commit drop;

truncate table tmp_personal_duplicado_merge;

insert into tmp_personal_duplicado_merge (duplicate_id, keep_id)
select duplicate_id, keep_id
from (
  select
    id as duplicate_id,
    first_value(id) over (
      partition by nombre_normalizado
      order by activo desc, updated_at desc nulls last, created_at desc
    ) as keep_id,
    row_number() over (
      partition by nombre_normalizado
      order by activo desc, updated_at desc nulls last, created_at desc
    ) as fila
  from public.personal
  where nombre_normalizado is not null
) as candidatos
where fila > 1
  and duplicate_id <> keep_id;

update public.cobertura_mensual c
set personal_id = m.keep_id
from tmp_personal_duplicado_merge m
where c.personal_id = m.duplicate_id;

update public.asignacion_bloques_mensual a
set personal_id = m.keep_id
from tmp_personal_duplicado_merge m
where a.personal_id = m.duplicate_id
  and not exists (
    select 1
    from public.asignacion_bloques_mensual existente
    where existente.mes = a.mes
      and existente.anio = a.anio
      and existente.personal_id = m.keep_id
  );

delete from public.asignacion_bloques_mensual a
using tmp_personal_duplicado_merge m
where a.personal_id = m.duplicate_id;

update public.rol_diario r set supervisor_id = m.keep_id from tmp_personal_duplicado_merge m where r.supervisor_id = m.duplicate_id;
update public.rol_diario r set bloque_1_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.bloque_1_personal_id = m.duplicate_id;
update public.rol_diario r set bloque_2_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.bloque_2_personal_id = m.duplicate_id;
update public.rol_diario r set bloque_3_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.bloque_3_personal_id = m.duplicate_id;
update public.rol_diario r set bloque_4_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.bloque_4_personal_id = m.duplicate_id;
update public.rol_diario r set bloque_5_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.bloque_5_personal_id = m.duplicate_id;
update public.rol_diario r set cobertura_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.cobertura_personal_id = m.duplicate_id;
update public.rol_diario r set falta_personal_id = m.keep_id from tmp_personal_duplicado_merge m where r.falta_personal_id = m.duplicate_id;

do $$
begin
  if to_regclass('public.asignaciones_diarias') is not null then
    update public.asignaciones_diarias a
    set personal_id = m.keep_id
    from tmp_personal_duplicado_merge m
    where a.personal_id = m.duplicate_id;
  end if;
end $$;

delete from public.personal p
using tmp_personal_duplicado_merge m
where p.id = m.duplicate_id;

update public.personal
set activo = true,
    updated_at = now()
where activo = false;

create unique index if not exists personal_nombre_normalizado_activo_uidx
on public.personal (nombre_normalizado)
where activo = true;

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

create table if not exists public.dias_especiales (
  id uuid primary key default gen_random_uuid(),
  dia_semana text,
  requiere_un_supervisor boolean not null default true,
  cantidad_supervisores integer not null default 1,
  cantidad_monitoristas integer not null default 4,
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now()
);

alter table public.cobertura_mensual add column if not exists rol_cobertura text;
alter table public.cobertura_mensual add column if not exists activo boolean not null default true;
alter table public.cobertura_mensual add column if not exists updated_at timestamptz;

update public.cobertura_mensual
set rol_cobertura = 'Cobertura principal'
where rol_cobertura is null;

alter table public.asignacion_bloques_mensual add column if not exists bloque_mes_anterior_id uuid;
alter table public.asignacion_bloques_mensual add column if not exists bloque_siguiente_sugerido_id uuid;
alter table public.asignacion_bloques_mensual add column if not exists tipo_asignacion text not null default 'Titular';
alter table public.asignacion_bloques_mensual add column if not exists confirmado boolean not null default false;
alter table public.asignacion_bloques_mensual add column if not exists observaciones text;
alter table public.asignacion_bloques_mensual add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'asignacion_bloques_mensual_bloque_id_fkey') then
    alter table public.asignacion_bloques_mensual
      add constraint asignacion_bloques_mensual_bloque_id_fkey
      foreign key (bloque_id) references public.bloques(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'asignacion_bloques_mensual_bloque_mes_anterior_id_fkey') then
    alter table public.asignacion_bloques_mensual
      add constraint asignacion_bloques_mensual_bloque_mes_anterior_id_fkey
      foreign key (bloque_mes_anterior_id) references public.bloques(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'asignacion_bloques_mensual_bloque_siguiente_sugerido_id_fkey') then
    alter table public.asignacion_bloques_mensual
      add constraint asignacion_bloques_mensual_bloque_siguiente_sugerido_id_fkey
      foreign key (bloque_siguiente_sugerido_id) references public.bloques(id);
  end if;
end $$;

alter table public.roles_mensuales add column if not exists observaciones text;
alter table public.roles_mensuales add column if not exists updated_at timestamptz;

alter table public.rol_diario add column if not exists rol_mensual_id uuid;
alter table public.rol_diario add column if not exists dia_semana text;
alter table public.rol_diario add column if not exists supervisor_id uuid;
alter table public.rol_diario add column if not exists bloque_1_personal_id uuid;
alter table public.rol_diario add column if not exists bloque_2_personal_id uuid;
alter table public.rol_diario add column if not exists bloque_3_personal_id uuid;
alter table public.rol_diario add column if not exists bloque_4_personal_id uuid;
alter table public.rol_diario add column if not exists bloque_5_personal_id uuid;
alter table public.rol_diario add column if not exists cobertura_personal_id uuid;
alter table public.rol_diario add column if not exists falta_personal_id uuid;
alter table public.rol_diario add column if not exists estatus_dia text;
alter table public.rol_diario add column if not exists motivo text;
alter table public.rol_diario add column if not exists updated_at timestamptz;

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
    execute format('alter table public.%I enable row level security', table_name);
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

insert into public.dias_especiales (dia_semana, cantidad_supervisores, cantidad_monitoristas, activo, observaciones)
select seed.dia_semana, 1, 4, true, 'Dia especial operativo'
from (values ('Sabado'), ('Domingo')) as seed(dia_semana)
where not exists (select 1 from public.dias_especiales where dia_semana = seed.dia_semana);

notify pgrst, 'reload schema';
