import { ensureSupabase } from '../lib/supabase';
import { normalizarNombrePersonal } from '../lib/nombres';
import type {
  AsignacionBloqueMensual,
  AsignacionBloqueMensualInput,
  Bloque,
  BloqueInput,
  CoberturaMensual,
  CoberturaMensualInput,
  ConfiguracionRotacion,
  DiaEspecial,
  Personal,
  PersonalInput,
  RolDiario,
  RolDiarioInput,
  RolMensual,
  Turno,
  TurnoInput,
} from '../types/database';

function duplicadoError(error: { message: string }) {
  return error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique');
}

export async function obtenerTurnos(): Promise<Turno[]> {
  const { data, error } = await ensureSupabase()
    .from('turnos')
    .select('*')
    .order('nombre');

  if (error) throw new Error(`No se pudieron obtener los turnos: ${error.message}`);
  return data ?? [];
}

export async function crearTurno(turno: TurnoInput): Promise<Turno> {
  const { data, error } = await ensureSupabase().from('turnos').insert(turno).select('*').single();
  if (error) throw new Error(`No se pudo crear el turno: ${error.message}`);
  return data;
}

export async function actualizarTurno(id: string, turno: TurnoInput): Promise<Turno> {
  const { data, error } = await ensureSupabase()
    .from('turnos')
    .update({ ...turno, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`No se pudo actualizar el turno: ${error.message}`);
  return data;
}

export async function inactivarTurno(id: string) {
  const { error } = await ensureSupabase()
    .from('turnos')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`No se pudo inactivar el turno: ${error.message}`);
}

export async function obtenerPersonal(): Promise<Personal[]> {
  const { data, error } = await ensureSupabase()
    .from('personal')
    .select('*, turnos(*)')
    .eq('activo', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`No se pudo obtener el personal: ${error.message}`);
  return data ?? [];
}

export async function validarPersonalDuplicado(nombre: string, ignorarId?: string | null): Promise<Personal | null> {
  const nombreNormalizado = normalizarNombrePersonal(nombre);
  const { data, error } = await ensureSupabase()
    .from('personal')
    .select('*, turnos(*)')
    .eq('nombre_normalizado', nombreNormalizado)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo validar duplicados: ${error.message}`);
  if (data && data.id !== ignorarId) return data;
  return null;
}

export function existePersonalDuplicadoLocal(
  personal: Personal[],
  nombre: string,
  ignorarId?: string | null,
) {
  const nombreNormalizado = normalizarNombrePersonal(nombre);
  return personal.find(
    (persona) =>
      normalizarNombrePersonal(persona.nombre_completo) === nombreNormalizado &&
      persona.id !== ignorarId,
  ) ?? null;
}

export async function crearPersonal(personal: PersonalInput): Promise<Personal> {
  const duplicado = await validarPersonalDuplicado(personal.nombre_completo);
  if (duplicado) {
    throw new Error('Este personal ya esta registrado. Puedes editarlo desde la tabla.');
  }

  const payload = {
    ...personal,
    activo: true,
    nombre_completo: personal.nombre_completo.trim().replace(/\s+/g, ' '),
    nombre_normalizado: normalizarNombrePersonal(personal.nombre_completo),
  };
  const { data, error } = await ensureSupabase()
    .from('personal')
    .insert(payload)
    .select('*, turnos(*)')
    .single();

  if (error) {
    if (duplicadoError(error)) throw new Error('Este personal ya esta registrado. Puedes editarlo desde la tabla.');
    throw new Error(`No se pudo guardar el personal: ${error.message}`);
  }
  return data;
}

export async function actualizarPersonal(id: string, personal: PersonalInput): Promise<Personal> {
  const duplicado = await validarPersonalDuplicado(personal.nombre_completo, id);
  if (duplicado) {
    throw new Error('Este personal ya esta registrado. Puedes editarlo desde la tabla.');
  }

  const payload = {
    ...personal,
    activo: true,
    nombre_completo: personal.nombre_completo.trim().replace(/\s+/g, ' '),
    nombre_normalizado: normalizarNombrePersonal(personal.nombre_completo),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await ensureSupabase()
    .from('personal')
    .update(payload)
    .eq('id', id)
    .select('*, turnos(*)')
    .single();

  if (error) {
    if (duplicadoError(error)) throw new Error('Este personal ya esta registrado. Puedes editarlo desde la tabla.');
    throw new Error(`No se pudo actualizar el personal: ${error.message}`);
  }
  return data;
}

export async function cambiarEstadoPersonal(id: string, activo: boolean) {
  const { error } = await ensureSupabase()
    .from('personal')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
}

export const inactivarPersonal = (id: string) => cambiarEstadoPersonal(id, false);
export const normalizarNombre = normalizarNombrePersonal;

export async function eliminarPersonal(id: string) {
  const supabase = ensureSupabase();

  await supabase.from('cobertura_mensual').delete().eq('personal_id', id);
  await supabase.from('asignacion_bloques_mensual').delete().eq('personal_id', id);

  const columnasRol = [
    'supervisor_id',
    'bloque_1_personal_id',
    'bloque_2_personal_id',
    'bloque_3_personal_id',
    'bloque_4_personal_id',
    'bloque_5_personal_id',
    'cobertura_personal_id',
    'falta_personal_id',
  ];

  await Promise.all(
    columnasRol.map((columna) =>
      supabase
        .from('rol_diario')
        .update({ [columna]: null, updated_at: new Date().toISOString() })
        .eq(columna, id),
    ),
  );

  const { error } = await supabase
    .from('personal')
    .delete()
    .eq('id', id);

  if (!error) return;

  throw new Error(`No se pudo eliminar el personal: ${error.message}`);
}

export async function obtenerConfiguracionRotacion(): Promise<ConfiguracionRotacion | null> {
  const { data, error } = await ensureSupabase()
    .from('configuracion_rotacion')
    .select('*')
    .eq('activa', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo obtener la rotacion: ${error.message}`);
  return data;
}

export async function obtenerBloques(): Promise<Bloque[]> {
  const { data, error } = await ensureSupabase()
    .from('bloques')
    .select('*')
    .order('orden', { ascending: true });

  if (error) throw new Error(`No se pudieron obtener los bloques: ${error.message}`);
  return (data ?? []).map((bloque) => ({ ...bloque, numero: bloque.orden }));
}

export async function crearBloque(bloque: BloqueInput): Promise<Bloque> {
  const { data, error } = await ensureSupabase().from('bloques').insert(bloque).select('*').single();
  if (error) throw new Error(`No se pudo crear el bloque: ${error.message}`);
  return { ...data, numero: data.orden };
}

export async function actualizarBloque(id: string, bloque: BloqueInput): Promise<Bloque> {
  const { data, error } = await ensureSupabase()
    .from('bloques')
    .update({ ...bloque, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`No se pudo actualizar el bloque: ${error.message}`);
  return { ...data, numero: data.orden };
}

export async function inactivarBloque(id: string) {
  const { error } = await ensureSupabase()
    .from('bloques')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`No se pudo inactivar el bloque: ${error.message}`);
}

export async function obtenerCoberturaMensual(mes: number, anio: number): Promise<CoberturaMensual[]> {
  const { data, error } = await ensureSupabase()
    .from('cobertura_mensual')
    .select('*, personal(*)')
    .eq('mes', mes)
    .eq('anio', anio)
    .order('rol_cobertura');
  if (error) throw new Error(`No se pudo obtener la cobertura mensual: ${error.message}`);
  return data ?? [];
}

export async function crearCoberturaMensual(cobertura: CoberturaMensualInput): Promise<CoberturaMensual> {
  const { data, error } = await ensureSupabase()
    .from('cobertura_mensual')
    .insert(cobertura)
    .select('*, personal(*)')
    .single();
  if (error) throw new Error(`No se pudo crear la cobertura: ${error.message}`);
  return data;
}

export async function actualizarCoberturaMensual(id: string, cobertura: CoberturaMensualInput): Promise<CoberturaMensual> {
  const { data, error } = await ensureSupabase()
    .from('cobertura_mensual')
    .update({ ...cobertura, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, personal(*)')
    .single();
  if (error) throw new Error(`No se pudo actualizar la cobertura: ${error.message}`);
  return data;
}

export async function guardarCoberturaMensual(cobertura: CoberturaMensualInput): Promise<CoberturaMensual> {
  const existente = await obtenerCoberturaMensual(cobertura.mes, cobertura.anio);
  const actual = existente.find((item) => item.rol_cobertura === cobertura.rol_cobertura);
  return actual ? actualizarCoberturaMensual(actual.id, cobertura) : crearCoberturaMensual(cobertura);
}

export async function obtenerAsignacionBloquesMensual(mes: number, anio: number): Promise<AsignacionBloqueMensual[]> {
  const { data, error } = await ensureSupabase()
    .from('asignacion_bloques_mensual')
    .select('*, personal(*), bloques:bloques!asignacion_bloques_mensual_bloque_id_fkey(*), bloque_mes_anterior:bloques!asignacion_bloques_mensual_bloque_mes_anterior_id_fkey(*), bloque_siguiente_sugerido:bloques!asignacion_bloques_mensual_bloque_siguiente_sugerido_id_fkey(*)')
    .eq('mes', mes)
    .eq('anio', anio);

  if (error) throw new Error(`No se pudo obtener la asignacion mensual: ${error.message}`);
  return data ?? [];
}

export const obtenerAsignacionMesAnterior = obtenerAsignacionBloquesMensual;

export async function guardarAsignacionesBloquesMensual(asignaciones: AsignacionBloqueMensualInput[]) {
  if (!asignaciones.length) return;
  const { mes, anio } = asignaciones[0];
  const supabase = ensureSupabase();
  const { error: deleteError } = await supabase.from('asignacion_bloques_mensual').delete().eq('mes', mes).eq('anio', anio);
  if (deleteError) throw new Error(`No se pudo reemplazar la rotacion mensual: ${deleteError.message}`);
  const { error } = await supabase.from('asignacion_bloques_mensual').insert(asignaciones);
  if (error) throw new Error(`No se pudo guardar la rotacion mensual: ${error.message}`);
}

export async function actualizarAsignacionBloqueMensual(id: string, bloqueId: string) {
  const { error } = await ensureSupabase()
    .from('asignacion_bloques_mensual')
    .update({ bloque_id: bloqueId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`No se pudo actualizar la asignacion: ${error.message}`);
}

export async function confirmarRotacionMensual(mes: number, anio: number) {
  const { error } = await ensureSupabase()
    .from('asignacion_bloques_mensual')
    .update({ confirmado: true, updated_at: new Date().toISOString() })
    .eq('mes', mes)
    .eq('anio', anio);
  if (error) throw new Error(`No se pudo confirmar la rotacion: ${error.message}`);
}

export async function obtenerDiasEspeciales(): Promise<DiaEspecial[]> {
  const { data, error } = await ensureSupabase().from('dias_especiales').select('*').order('created_at');
  if (error) throw new Error(`No se pudieron obtener los dias especiales: ${error.message}`);
  return data ?? [];
}

export async function crearRolMensual(mes: number, anio: number, turnoId: string | null): Promise<RolMensual> {
  const { data, error } = await ensureSupabase()
    .from('roles_mensuales')
    .insert({ mes, anio, turno_id: turnoId, estatus: 'Propuesta' })
    .select('*')
    .single();
  if (error) throw new Error(`No se pudo crear el rol mensual: ${error.message}`);
  return data;
}

export async function obtenerRolMensual(mes: number, anio: number, turnoId: string | null): Promise<RolMensual | null> {
  let query = ensureSupabase().from('roles_mensuales').select('*').eq('mes', mes).eq('anio', anio);
  query = turnoId ? query.eq('turno_id', turnoId) : query.is('turno_id', null);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`No se pudo obtener el rol mensual: ${error.message}`);
  return data;
}

export async function obtenerRolDiario(mes: number, anio: number): Promise<RolDiario[]> {
  const { data, error } = await ensureSupabase()
    .from('rol_diario')
    .select('*')
    .eq('mes', mes)
    .eq('anio', anio)
    .order('fecha');
  if (error) throw new Error(`No se pudo obtener el rol diario: ${error.message}`);
  return data ?? [];
}

export async function guardarPropuestaRolMensual({
  mes,
  anio,
  turnoId,
  rolDiario,
}: {
  mes: number;
  anio: number;
  turnoId: string | null;
  rolDiario: RolDiarioInput[];
}) {
  const supabase = ensureSupabase();
  const existente = await obtenerRolMensual(mes, anio, turnoId);
  let rolMensualId = existente?.id ?? null;

  if (!rolMensualId) {
    const nuevo = await crearRolMensual(mes, anio, turnoId);
    rolMensualId = nuevo.id;
  } else {
    await supabase
      .from('roles_mensuales')
      .update({ estatus: 'Propuesta', updated_at: new Date().toISOString() })
      .eq('id', rolMensualId);
  }

  const { error: deleteError } = await supabase.from('rol_diario').delete().eq('rol_mensual_id', rolMensualId);
  if (deleteError) throw new Error(`No se pudo limpiar el rol anterior: ${deleteError.message}`);

  const { error } = await supabase.from('rol_diario').insert(
    rolDiario.map((dia) => ({ ...dia, rol_mensual_id: rolMensualId })),
  );
  if (error) throw new Error(`No se pudo guardar el rol diario: ${error.message}`);
}

export async function actualizarRolDiario(id: string, cambios: Partial<RolDiarioInput>) {
  const { error } = await ensureSupabase()
    .from('rol_diario')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`No se pudo actualizar el dia: ${error.message}`);
}

export async function marcarFalta(id: string, personalId: string, motivo = 'Falta improvisada') {
  return actualizarRolDiario(id, { falta_personal_id: personalId, estatus_dia: 'Falta', motivo });
}

export async function asignarCobertura(id: string, personalId: string) {
  return actualizarRolDiario(id, { cobertura_personal_id: personalId, estatus_dia: 'Cobertura', motivo: 'Falta improvisada' });
}

export async function dividirBloqueEntreCuatro(id: string) {
  return actualizarRolDiario(id, { estatus_dia: 'Division entre 4', motivo: 'Sin cobertura disponible' });
}

export async function confirmarRolMensual(id: string) {
  const { error } = await ensureSupabase()
    .from('roles_mensuales')
    .update({ estatus: 'Confirmado', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`No se pudo confirmar el rol mensual: ${error.message}`);
}
