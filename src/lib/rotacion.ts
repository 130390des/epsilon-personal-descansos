import type { DiaSemana } from '../types/database';

export const DIAS_SEMANA: DiaSemana[] = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
  'Domingo',
];

export const DIA_LABEL: Record<DiaSemana, string> = {
  Lunes: 'Lunes',
  Martes: 'Martes',
  Miercoles: 'Miercoles',
  Jueves: 'Jueves',
  Viernes: 'Viernes',
  Sabado: 'Sabado',
  Domingo: 'Domingo',
};

export function formatearHorario(horaInicio?: string, horaFin?: string) {
  if (!horaInicio || !horaFin) return 'Sin turno';
  return `${horaInicio.slice(0, 5)}-${horaFin.slice(0, 5)}`;
}

export function rotarDia(dia: DiaSemana, desplazamiento: number): DiaSemana {
  const indice = DIAS_SEMANA.indexOf(dia);
  const total = DIAS_SEMANA.length;
  return DIAS_SEMANA[(indice + desplazamiento + total) % total];
}

export function sumarDias(fecha: Date, dias: number) {
  const resultado = new Date(fecha);
  resultado.setDate(fecha.getDate() + dias);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

export function fechaIsoLocal(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function obtenerLunesDeSemana(fecha: Date) {
  const diaSemana = (fecha.getDay() + 6) % 7;
  return sumarDias(fecha, -diaSemana);
}

export function formatearFechaCorta(fecha: Date) {
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function obtenerInicioPeriodoRotacion({
  fechaInicioCiclo,
  fechaObjetivo,
  semanasPorCiclo = 4,
}: {
  fechaInicioCiclo: string;
  fechaObjetivo: string;
  semanasPorCiclo?: number;
}) {
  const inicio = new Date(`${fechaInicioCiclo}T00:00:00`);
  const objetivo = new Date(`${fechaObjetivo}T00:00:00`);
  const diasPorPeriodo = semanasPorCiclo * 7;
  const diferenciaDias = Math.max(
    0,
    Math.floor((objetivo.getTime() - inicio.getTime()) / 86_400_000),
  );
  const periodosCompletos = Math.floor(diferenciaDias / diasPorPeriodo);
  return sumarDias(inicio, periodosCompletos * diasPorPeriodo);
}

export function calcularDescansosRotados({
  descansoBase1,
  descansoBase2,
  fechaInicioCiclo,
  fechaObjetivo,
  semanasPorCiclo = 4,
  diasARecorrer = 1,
  direccion = 'adelante',
}: {
  descansoBase1: DiaSemana;
  descansoBase2: DiaSemana;
  fechaInicioCiclo: string;
  fechaObjetivo: string;
  semanasPorCiclo?: number;
  diasARecorrer?: number;
  direccion?: 'adelante' | 'atras';
}) {
  const inicio = new Date(`${fechaInicioCiclo}T00:00:00`);
  const objetivo = new Date(`${fechaObjetivo}T00:00:00`);
  const diferenciaDias = Math.max(
    0,
    Math.floor((objetivo.getTime() - inicio.getTime()) / 86_400_000),
  );
  const ciclosCompletos = Math.floor(diferenciaDias / (semanasPorCiclo * 7));
  const sentido = direccion === 'adelante' ? 1 : -1;
  const desplazamiento = ciclosCompletos * diasARecorrer * sentido;

  return [
    rotarDia(descansoBase1, desplazamiento),
    rotarDia(descansoBase2, desplazamiento),
  ] as const;
}
