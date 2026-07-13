import { calcularDescansosRotados, DIAS_SEMANA } from './rotacion';
import type {
  AsignacionBloqueMensual,
  AsignacionBloqueMensualInput,
  Bloque,
  CoberturaMensual,
  ConfiguracionRotacion,
  DiaEspecial,
  DiaSemana,
  Personal,
  RolDiarioInput,
  Turno,
} from '../types/database';

const dayIndexByJsDay = [6, 0, 1, 2, 3, 4, 5];

export function ordenarBloques(bloques: Bloque[]) {
  return [...bloques]
    .filter((bloque) => bloque.activo)
    .sort((a, b) => (a.orden ?? a.numero ?? 0) - (b.orden ?? b.numero ?? 0));
}

export function rotarBloqueMensual(
  bloqueAnterior: Bloque | null | undefined,
  bloques: Bloque[],
) {
  const ordenados = ordenarBloques(bloques);
  if (!bloqueAnterior || !ordenados.length) return ordenados[0] ?? null;
  const index = ordenados.findIndex((bloque) => bloque.id === bloqueAnterior.id);
  if (index < 0) return ordenados[0] ?? null;
  return ordenados[(index + 1) % ordenados.length];
}

export function obtenerDiaSemana(fecha: string): DiaSemana {
  const fechaDate = new Date(`${fecha}T00:00:00`);
  return DIAS_SEMANA[dayIndexByJsDay[fechaDate.getDay()]];
}

export function personaDescansaEnFecha({
  persona,
  fecha,
  rotacion,
}: {
  persona: Personal;
  fecha: string;
  rotacion: ConfiguracionRotacion | null;
}) {
  if (!persona.descanso_base_1 || !persona.descanso_base_2 || !persona.fecha_inicio_ciclo) return false;
  const descansos = calcularDescansosRotados({
    descansoBase1: persona.descanso_base_1,
    descansoBase2: persona.descanso_base_2,
    fechaInicioCiclo: persona.fecha_inicio_ciclo,
    fechaObjetivo: fecha,
    semanasPorCiclo: rotacion?.semanas_por_ciclo ?? 4,
    diasARecorrer: rotacion?.dias_a_recorrer ?? 1,
    direccion: rotacion?.direccion ?? 'adelante',
  });
  return descansos.includes(obtenerDiaSemana(fecha));
}

export function generarPropuestaRotacionMensual({
  mes,
  anio,
  personal,
  bloques,
  asignacionAnterior,
}: {
  mes: number;
  anio: number;
  personal: Personal[];
  bloques: Bloque[];
  asignacionAnterior: AsignacionBloqueMensual[];
}): AsignacionBloqueMensualInput[] {
  const bloquesOrdenados = ordenarBloques(bloques);
  const monitoristas = personal.filter(
    (persona) => persona.activo && persona.puede_ser_monitorista,
  );

  return monitoristas.map((persona, index) => {
    const anterior = asignacionAnterior.find((item) => item.personal_id === persona.id);
    const bloqueAnterior = anterior?.bloques ?? null;
    const bloqueActual = rotarBloqueMensual(bloqueAnterior, bloquesOrdenados) ?? bloquesOrdenados[index % bloquesOrdenados.length];
    const bloqueSiguiente = rotarBloqueMensual(bloqueActual, bloquesOrdenados);

    return {
      mes,
      anio,
      personal_id: persona.id,
      bloque_id: bloqueActual.id,
      bloque_mes_anterior_id: bloqueAnterior?.id ?? null,
      bloque_siguiente_sugerido_id: bloqueSiguiente?.id ?? null,
      tipo_asignacion: persona.puesto === 'Supervisor' ? 'Supervisor como monitorista' : 'Titular',
      confirmado: false,
      observaciones: null,
    };
  });
}

export function generarRolMensual({
  mes,
  anio,
  turno,
  personal,
  bloques,
  rotacion,
  asignaciones,
  coberturas,
  diasEspeciales,
}: {
  mes: number;
  anio: number;
  turno: Turno | null;
  personal: Personal[];
  bloques: Bloque[];
  rotacion: ConfiguracionRotacion | null;
  asignaciones: AsignacionBloqueMensualInput[];
  coberturas: CoberturaMensual[];
  diasEspeciales: DiaEspecial[];
}): RolDiarioInput[] {
  const activos = personal.filter((persona) => persona.activo);
  const supervisores = activos.filter((persona) => persona.puesto === 'Supervisor');
  const bloquesOrdenados = ordenarBloques(bloques).slice(0, 5);
  const coberturaPrincipal = coberturas.find((item) => item.rol_cobertura === 'Cobertura principal' && item.activo);
  const coberturaSecundaria = coberturas.find((item) => item.rol_cobertura === 'Cobertura secundaria' && item.activo);
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const rolDiario: RolDiarioInput[] = [];

  for (let diaMes = 1; diaMes <= diasDelMes; diaMes += 1) {
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(diaMes).padStart(2, '0')}`;
    const diaSemana = obtenerDiaSemana(fecha);
    const disponibles = activos.filter((persona) => !personaDescansaEnFecha({ persona, fecha, rotacion }));
    const diaEspecial = diasEspeciales.find((item) => item.activo && item.dia_semana === diaSemana);
    const supervisor = supervisores.find((persona) => disponibles.some((item) => item.id === persona.id)) ?? supervisores[0] ?? null;
    const usados = new Set<string>();
    if (supervisor) usados.add(supervisor.id);

    const fila: RolDiarioInput = {
      rol_mensual_id: null,
      fecha,
      dia_semana: diaSemana,
      mes,
      anio,
      turno_id: turno?.id ?? null,
      supervisor_id: supervisor?.id ?? null,
      bloque_1_personal_id: null,
      bloque_2_personal_id: null,
      bloque_3_personal_id: null,
      bloque_4_personal_id: null,
      bloque_5_personal_id: null,
      cobertura_personal_id: null,
      falta_personal_id: null,
      estatus_dia: diaEspecial ? 'Dia especial' : 'Propuesta',
      motivo: diaEspecial ? 'Dia especial: 1 supervisor y 4 monitoristas requeridos.' : null,
      observaciones: 'La propuesta puede modificarse manualmente antes de confirmar.',
    };

    bloquesOrdenados.forEach((bloque, index) => {
      const asignacion = asignaciones.find((item) => item.bloque_id === bloque.id);
      const titular = activos.find((persona) => persona.id === asignacion?.personal_id) ?? null;
      let asignado = titular;
      let motivo: string | null = null;

      if (titular && personaDescansaEnFecha({ persona: titular, fecha, rotacion })) {
        const cobertura = [coberturaPrincipal, coberturaSecundaria]
          .map((item) => activos.find((persona) => persona.id === item?.personal_id))
          .find((persona) => persona && !usados.has(persona.id) && !personaDescansaEnFecha({ persona, fecha, rotacion }));

        if (cobertura) {
          asignado = cobertura;
          fila.cobertura_personal_id = cobertura.id;
          motivo = `Cobertura por descanso de ${titular.nombre_completo}.`;
        } else {
          asignado = null;
          motivo = `Sin cobertura para ${titular.nombre_completo}; division entre 4.`;
          fila.estatus_dia = 'Division entre 4';
        }
      }

      if (diaEspecial && index >= diaEspecial.cantidad_monitoristas) {
        asignado = null;
        motivo = 'Dia especial: este bloque queda sin titular por requerimiento reducido.';
      }

      if (asignado) usados.add(asignado.id);
      const key = `bloque_${index + 1}_personal_id` as
        | 'bloque_1_personal_id'
        | 'bloque_2_personal_id'
        | 'bloque_3_personal_id'
        | 'bloque_4_personal_id'
        | 'bloque_5_personal_id';
      fila[key] = asignado?.id ?? null;
      if (motivo) fila.motivo = fila.motivo ? `${fila.motivo} ${motivo}` : motivo;
    });

    rolDiario.push(fila);
  }

  return rolDiario;
}
