export type Puesto = 'Supervisor' | 'Monitorista';
export type DiaSemana =
  | 'Lunes'
  | 'Martes'
  | 'Miercoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sabado'
  | 'Domingo';

export type EstadoMensual = 'Borrador' | 'Propuesta' | 'Confirmado' | 'Cerrado';
export type RolCobertura = 'Cobertura principal' | 'Cobertura secundaria';
export type TipoAsignacionBloque = 'Titular' | 'Cobertura' | 'Supervisor como monitorista';

export type Turno = {
  id: string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
};

export type TurnoInput = {
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
};

export type Personal = {
  id: string;
  nombre_completo: string;
  nombre_normalizado?: string | null;
  puesto: Puesto;
  turno_id: string | null;
  activo: boolean;
  puede_cubrir_descansos: boolean;
  puede_ser_monitorista: boolean;
  descanso_base_1: DiaSemana | null;
  descanso_base_2: DiaSemana | null;
  fecha_inicio_ciclo: string | null;
  regla_rotacion: string;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
  turnos?: Turno | null;
};

export type PersonalInput = {
  nombre_completo: string;
  puesto: Puesto;
  turno_id: string | null;
  activo: boolean;
  puede_cubrir_descansos: boolean;
  puede_ser_monitorista: boolean;
  descanso_base_1: DiaSemana | null;
  descanso_base_2: DiaSemana | null;
  fecha_inicio_ciclo: string | null;
  regla_rotacion: string;
  notas: string | null;
};

export type ConfiguracionRotacion = {
  id: string;
  nombre: string;
  semanas_por_ciclo: number;
  dias_a_recorrer: number;
  direccion: 'adelante' | 'atras';
  activa: boolean;
  created_at: string;
};

export type Bloque = {
  id: string;
  orden: number;
  numero?: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
};

export type BloqueInput = {
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
};

export type CoberturaMensual = {
  id: string;
  mes: number;
  anio: number;
  personal_id: string | null;
  rol_cobertura: RolCobertura;
  activo: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string | null;
  personal?: Personal | null;
};

export type CoberturaMensualInput = {
  mes: number;
  anio: number;
  personal_id: string | null;
  rol_cobertura: RolCobertura;
  activo: boolean;
  observaciones: string | null;
};

export type AsignacionBloqueMensual = {
  id: string;
  mes: number;
  anio: number;
  personal_id: string;
  bloque_id: string;
  bloque_mes_anterior_id: string | null;
  bloque_siguiente_sugerido_id: string | null;
  tipo_asignacion: TipoAsignacionBloque;
  confirmado: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string | null;
  personal?: Personal | null;
  bloques?: Bloque | null;
  bloque_mes_anterior?: Bloque | null;
  bloque_siguiente_sugerido?: Bloque | null;
};

export type AsignacionBloqueMensualInput = {
  mes: number;
  anio: number;
  personal_id: string;
  bloque_id: string;
  bloque_mes_anterior_id: string | null;
  bloque_siguiente_sugerido_id: string | null;
  tipo_asignacion: TipoAsignacionBloque;
  confirmado: boolean;
  observaciones: string | null;
};

export type DiaEspecial = {
  id: string;
  dia_semana: DiaSemana;
  requiere_un_supervisor: boolean;
  cantidad_supervisores: number;
  cantidad_monitoristas: number;
  activo: boolean;
  observaciones: string | null;
  created_at: string;
};

export type RolMensual = {
  id: string;
  mes: number;
  anio: number;
  turno_id: string | null;
  estatus: EstadoMensual;
  observaciones: string | null;
  created_at: string;
  updated_at: string | null;
};

export type RolDiario = {
  id: string;
  rol_mensual_id: string | null;
  fecha: string;
  dia_semana: DiaSemana;
  mes: number;
  anio: number;
  turno_id: string | null;
  supervisor_id: string | null;
  bloque_1_personal_id: string | null;
  bloque_2_personal_id: string | null;
  bloque_3_personal_id: string | null;
  bloque_4_personal_id: string | null;
  bloque_5_personal_id: string | null;
  cobertura_personal_id: string | null;
  falta_personal_id: string | null;
  estatus_dia: string | null;
  motivo: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string | null;
};

export type RolDiarioInput = Omit<RolDiario, 'id' | 'created_at' | 'updated_at'>;
