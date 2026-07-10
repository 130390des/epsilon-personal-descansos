import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock,
  Edit3,
  FileText,
  Home,
  Info,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  actualizarBloque,
  actualizarPersonal,
  confirmarRolMensual,
  confirmarRotacionMensual,
  crearPersonal,
  eliminarPersonal,
  existePersonalDuplicadoLocal,
  guardarAsignacionesBloquesMensual,
  guardarCoberturaMensual,
  guardarPropuestaRolMensual,
  obtenerAsignacionBloquesMensual,
  obtenerBloques,
  obtenerCoberturaMensual,
  obtenerConfiguracionRotacion,
  obtenerDiasEspeciales,
  obtenerPersonal,
  obtenerRolDiario,
  obtenerRolMensual,
  obtenerTurnos,
} from './services/epsilonService';
import { generarPropuestaRotacionMensual, generarRolMensual, ordenarBloques, personaDescansaEnFecha } from './lib/rolMensual';
import {
  DIA_LABEL,
  DIAS_SEMANA,
  fechaIsoLocal,
  formatearFechaCorta,
  formatearHorario,
  obtenerInicioPeriodoRotacion,
  obtenerLunesDeSemana,
  sumarDias,
} from './lib/rotacion';
import { supabaseConfigured } from './lib/supabase';
import type {
  AsignacionBloqueMensual,
  AsignacionBloqueMensualInput,
  Bloque,
  CoberturaMensual,
  ConfiguracionRotacion,
  DiaSemana,
  Personal,
  PersonalInput,
  Puesto,
  RolDiario,
  RolMensual,
  Turno,
  DiaEspecial,
} from './types/database';

const menuItems = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'operacion', label: 'Operacion', icon: CheckSquare },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'descansos', label: 'Descansos', icon: CalendarDays },
  { id: 'bloques', label: 'Bloques', icon: LayoutGrid },
  { id: 'coberturas', label: 'Coberturas', icon: ShieldCheck },
  { id: 'rotacion', label: 'Rotacion mensual', icon: RefreshCw },
  { id: 'rol', label: 'Rol mensual', icon: FileText },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'configuracion', label: 'Configuracion', icon: Settings },
] as const;

type MenuId = (typeof menuItems)[number]['id'];

const hoy = new Date();
const mesActual = hoy.getMonth() + 1;
const anioActual = hoy.getFullYear();
const fechaHoyIso = fechaIsoLocal(hoy);

const estadoInicial: PersonalInput = {
  nombre_completo: '',
  puesto: 'Supervisor',
  turno_id: null,
  activo: true,
  puede_cubrir_descansos: false,
  puede_ser_monitorista: true,
  descanso_base_1: 'Lunes',
  descanso_base_2: 'Martes',
  fecha_inicio_ciclo: '2026-06-22',
  regla_rotacion: '+1 dia cada 4 semanas',
  notas: null,
};

function App() {
  const [seccionActiva, setSeccionActiva] = useState<MenuId>('inicio');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [rotacion, setRotacion] = useState<ConfiguracionRotacion | null>(null);
  const [coberturas, setCoberturas] = useState<CoberturaMensual[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionBloqueMensual[]>([]);
  const [propuestaRotacion, setPropuestaRotacion] = useState<AsignacionBloqueMensualInput[]>([]);
  const [rolMensual, setRolMensual] = useState<RolMensual | null>(null);
  const [rolDiario, setRolDiario] = useState<RolDiario[]>([]);
  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [formulario, setFormulario] = useState<PersonalInput>(estadoInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mes, setMes] = useState(mesActual);
  const [anio, setAnio] = useState(anioActual);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function cargarDatos() {
    if (!supabaseConfigured) {
      setError('Conecta Supabase con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para leer y guardar datos.');
      return;
    }

    setCargando(true);
    setError('');
    try {
      const [turnosData, personalData, rotacionData, bloquesData, coberturasData, diasData, rolData, rolDiarioData] =
        await Promise.all([
          obtenerTurnos(),
          obtenerPersonal(),
          obtenerConfiguracionRotacion(),
          obtenerBloques(),
          obtenerCoberturaMensual(mes, anio),
          obtenerDiasEspeciales(),
          obtenerRolMensual(mes, anio, turnoSeleccionado),
          obtenerRolDiario(mes, anio),
        ]);

      setTurnos(turnosData);
      setPersonal(personalData);
      setRotacion(rotacionData);
      setBloques(bloquesData);
      setCoberturas(coberturasData);
      setDiasEspeciales(diasData);
      setRolMensual(rolData);
      setRolDiario(rolDiarioData);

      const turnoId = turnoSeleccionado ?? turnosData[0]?.id ?? null;
      if (!turnoSeleccionado && turnoId) setTurnoSeleccionado(turnoId);
      if (!formulario.turno_id && turnoId) setFormulario((actual) => ({ ...actual, turno_id: turnoId }));

      const mesAnterior = mes === 1 ? 12 : mes - 1;
      const anioAnterior = mes === 1 ? anio - 1 : anio;
      const [asignacionesData] = await Promise.all([obtenerAsignacionBloquesMensual(mes, anio)]);
      setAsignaciones(asignacionesData);
      const anterior = await obtenerAsignacionBloquesMensual(mesAnterior, anioAnterior);
      setPropuestaRotacion(generarPropuestaRotacionMensual({ mes, anio, personal: personalData, bloques: bloquesData, asignacionAnterior: anterior }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrio un error al cargar la informacion.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarDatos();
  }, [mes, anio, turnoSeleccionado]);

  const personalActivo = useMemo(() => personal.filter((persona) => persona.activo), [personal]);
  const supervisores = personalActivo.filter((persona) => persona.puesto === 'Supervisor');
  const monitoristas = personalActivo.filter((persona) => persona.puede_ser_monitorista);
  const turnoActivo = turnos.find((turno) => turno.id === turnoSeleccionado) ?? turnos[0] ?? null;
  const bloquesOrdenados = ordenarBloques(bloques);
  const horarioActivo = formatearHorario(turnoActivo?.hora_inicio, turnoActivo?.hora_fin);
  const modulo = {
    inicio: ['Centro de Control Operativo', 'Plataforma de personal, descansos, bloques y rol mensual.'],
    operacion: ['Operacion', 'Resumen operativo de cobertura, rotacion y rol.'],
    personal: ['Personal', 'Alta, edicion y estado del personal.'],
    descansos: ['Descansos', 'Configuracion base y vista previa semanal.'],
    bloques: ['Bloques', 'Configuracion de bloques fijos por dia.'],
    coberturas: ['Coberturas Mensuales', 'Cobertura principal y secundaria por mes.'],
    rotacion: ['Rotacion Mensual de Bloques', 'Rol de bloques mensual por monitorista.'],
    rol: ['Rol Mensual', 'Propuesta diaria editable con bloques fijos.'],
    reportes: ['Reportes', 'Preparado para exportacion futura a Excel o PDF.'],
    configuracion: ['Configuracion', 'Turnos, dias especiales y parametros operativos.'],
  }[seccionActiva];

  function actualizarCampo<K extends keyof PersonalInput>(campo: K, valor: PersonalInput[K]) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setFormulario({ ...estadoInicial, turno_id: turnoActivo?.id ?? null });
  }

  function editarPersona(persona: Personal) {
    setEditandoId(persona.id);
    setFormulario({
      nombre_completo: persona.nombre_completo,
      puesto: persona.puesto,
      turno_id: persona.turno_id,
      activo: persona.activo,
      puede_cubrir_descansos: persona.puede_cubrir_descansos,
      puede_ser_monitorista: persona.puede_ser_monitorista,
      descanso_base_1: persona.descanso_base_1,
      descanso_base_2: persona.descanso_base_2,
      fecha_inicio_ciclo: persona.fecha_inicio_ciclo,
      regla_rotacion: persona.regla_rotacion,
      notas: persona.notas,
    });
    setSeccionActiva('personal');
    setMensaje(`Editando a ${persona.nombre_completo}`);
  }

  async function guardarPersonal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');
    if (!formulario.nombre_completo.trim()) return setError('Captura el nombre completo.');
    if (!formulario.turno_id) return setError('Selecciona un turno.');

    const duplicado = existePersonalDuplicadoLocal(personal, formulario.nombre_completo, editandoId);
    if (duplicado) return setError('Este personal ya esta registrado. Puedes editarlo desde la tabla.');

    setGuardando(true);
    try {
      if (editandoId) {
        await actualizarPersonal(editandoId, formulario);
        setMensaje('Personal actualizado correctamente.');
      } else {
        await crearPersonal(formulario);
        setMensaje('Personal guardado correctamente.');
      }
      limpiarFormulario();
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el personal.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarBloque(bloque: Bloque) {
    setGuardando(true);
    try {
      await actualizarBloque(bloque.id, {
        nombre: bloque.nombre,
        descripcion: bloque.descripcion,
        orden: bloque.orden,
        activo: bloque.activo,
      });
      setMensaje('Bloque actualizado en Supabase.');
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el bloque.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCobertura(rol: 'Cobertura principal' | 'Cobertura secundaria', personalId: string | null) {
    setGuardando(true);
    try {
      await guardarCoberturaMensual({ mes, anio, personal_id: personalId, rol_cobertura: rol, activo: true, observaciones: null });
      setMensaje('Cobertura mensual guardada.');
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cobertura.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRotacion(confirmar = false) {
    setGuardando(true);
    try {
      await guardarAsignacionesBloquesMensual(propuestaRotacion);
      if (confirmar) await confirmarRotacionMensual(mes, anio);
      setMensaje(confirmar ? 'Rotacion mensual confirmada.' : 'Rotacion mensual guardada.');
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la rotacion.');
    } finally {
      setGuardando(false);
    }
  }

  async function generarPropuestaRol() {
    setGuardando(true);
    try {
      const baseAsignaciones = asignaciones.length
        ? asignaciones.map((item) => ({
            mes,
            anio,
            personal_id: item.personal_id,
            bloque_id: item.bloque_id,
            bloque_mes_anterior_id: item.bloque_mes_anterior_id,
            bloque_siguiente_sugerido_id: item.bloque_siguiente_sugerido_id,
            tipo_asignacion: item.tipo_asignacion,
            confirmado: item.confirmado,
            observaciones: item.observaciones,
          }))
        : propuestaRotacion;
      const propuesta = generarRolMensual({
        mes,
        anio,
        turno: turnoActivo,
        personal,
        bloques,
        rotacion,
        asignaciones: baseAsignaciones,
        coberturas,
        diasEspeciales,
      });
      await guardarPropuestaRolMensual({ mes, anio, turnoId: turnoActivo?.id ?? null, rolDiario: propuesta });
      setMensaje('Propuesta de rol mensual guardada en Supabase.');
      setSeccionActiva('rol');
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el rol mensual.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarRol() {
    if (!rolMensual) return setError('Primero genera una propuesta de rol mensual.');
    setGuardando(true);
    try {
      await confirmarRolMensual(rolMensual.id);
      setMensaje('Rol mensual confirmado.');
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el rol.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] text-epsilon-ink">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand"><img src="/epsilon-logo.png" alt="Epsilon.net tecnologia" /></div>
          <nav className="nav-list">
            {menuItems.map((item) => <NavButton key={item.id} item={item} active={seccionActiva === item.id} onClick={() => setSeccionActiva(item.id)} />)}
          </nav>
          <div className="admin-card"><span className="admin-avatar"><User size={26} /></span><div><strong>Administrador</strong><p>Operaciones</p></div></div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div><h1>{modulo[0]}</h1><p>{modulo[1]}</p></div>
            <div className="top-actions">
              <button className="icon-alert" aria-label="Notificaciones"><Bell size={22} /><span>{cargando ? '...' : '3'}</span></button>
              <label className="turno-select"><small>Turno activo</small><select value={turnoSeleccionado ?? ''} onChange={(event) => setTurnoSeleccionado(event.target.value || null)}>{turnos.map((turno) => <option key={turno.id} value={turno.id}>{turno.nombre} {formatearHorario(turno.hora_inicio, turno.hora_fin)}</option>)}</select></label>
            </div>
          </header>

          {error && <div className="notice error">{error}</div>}
          {mensaje && <div className="notice success">{mensaje}</div>}

          <MonthBar mes={mes} anio={anio} setMes={setMes} setAnio={setAnio} />

          {seccionActiva === 'inicio' && <Inicio supervisores={supervisores.length} monitoristas={monitoristas.length} bloques={bloquesOrdenados.length} horario={horarioActivo} rotacion={rotacion} cobertura={coberturas} onNavigate={setSeccionActiva} />}
          {seccionActiva === 'operacion' && <Operacion bloques={bloquesOrdenados} asignaciones={asignaciones} rolDiario={rolDiario} onGenerarRol={generarPropuestaRol} guardando={guardando} />}
          {seccionActiva === 'personal' && <PersonalPanel formulario={formulario} turnos={turnos} personal={personal} editandoId={editandoId} guardando={guardando} actualizarCampo={actualizarCampo} guardarPersonal={guardarPersonal} limpiarFormulario={limpiarFormulario} editarPersona={editarPersona} eliminarPersona={async (persona) => { await eliminarPersonal(persona.id); if (editandoId === persona.id) limpiarFormulario(); await cargarDatos(); }} />}
          {seccionActiva === 'descansos' && <DescansosPanel personal={personalActivo} turno={turnoActivo} rotacion={rotacion} />}
          {seccionActiva === 'bloques' && <BloquesPanel bloques={bloquesOrdenados} setBloques={setBloques} guardarBloque={guardarBloque} guardando={guardando} />}
          {seccionActiva === 'coberturas' && <CoberturasPanel mes={mes} anio={anio} personal={personalActivo} coberturas={coberturas} guardarCobertura={guardarCobertura} />}
          {seccionActiva === 'rotacion' && <RotacionPanel mes={mes} anio={anio} bloques={bloquesOrdenados} personal={personalActivo} propuesta={propuestaRotacion} setPropuesta={setPropuestaRotacion} guardarRotacion={guardarRotacion} guardando={guardando} />}
          {seccionActiva === 'rol' && <RolPanel rolMensual={rolMensual} rolDiario={rolDiario} personal={personal} turno={turnoActivo} bloques={bloquesOrdenados} generarPropuestaRol={generarPropuestaRol} confirmarRol={confirmarRol} guardando={guardando} />}
          {seccionActiva === 'reportes' && <SimplePanel title="Reportes" text="La estructura de Supabase ya separa rol mensual y rol diario para exportar a Excel o PDF en una siguiente fase." />}
          {seccionActiva === 'configuracion' && <ConfiguracionPanel turnos={turnos} diasEspeciales={diasEspeciales} />}
          <footer>2026 Epsilon.net tecnologia <span>v1.1.0</span></footer>
        </main>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { id: MenuId; label: string; icon: LucideIcon }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} type="button"><Icon size={21} /><span>{item.label}</span></button>;
}

function MonthBar({ mes, anio, setMes, setAnio }: { mes: number; anio: number; setMes: (mes: number) => void; setAnio: (anio: number) => void }) {
  return <section className="month-bar"><Field label="Mes"><input type="number" min={1} max={12} value={mes} onChange={(event) => setMes(Number(event.target.value))} /></Field><Field label="Anio"><input type="number" value={anio} onChange={(event) => setAnio(Number(event.target.value))} /></Field></section>;
}

function Inicio({ supervisores, monitoristas, bloques, horario, rotacion, cobertura, onNavigate }: { supervisores: number; monitoristas: number; bloques: number; horario: string; rotacion: ConfiguracionRotacion | null; cobertura: CoberturaMensual[]; onNavigate: (id: MenuId) => void }) {
  return <><section className="stats-grid"><StatCard icon={Users} label="Supervisores activos" value={String(supervisores)} active /><StatCard icon={Users} label="Monitoristas activos" value={String(monitoristas)} /><StatCard icon={LayoutGrid} label="Bloques fijos" value={String(bloques)} detail="Sin horarios" /><StatCard icon={ShieldCheck} label="Cobertura mensual" value={String(cobertura.filter((item) => item.activo).length)} /><StatCard icon={Clock} label="Turno activo" value="Matutino" detail={horario} /><StatCard icon={RefreshCw} label="Ciclo de rotacion" value={`Cada ${rotacion?.semanas_por_ciclo ?? 4} semanas`} detail="Se recorren descansos 1 dia" /></section><section className="quick-grid">{menuItems.filter((item) => item.id !== 'inicio').slice(1, 8).map((item) => <button key={item.id} className="quick-card" onClick={() => onNavigate(item.id)} type="button"><item.icon size={24} /><strong>{item.label}</strong><span>Ir al modulo</span></button>)}</section><InfoBox text="Los bloques son fijos por dia; lo que rota es el personal asignado mensualmente." /></>;
}

function Operacion({ bloques, asignaciones, rolDiario, onGenerarRol, guardando }: { bloques: Bloque[]; asignaciones: AsignacionBloqueMensual[]; rolDiario: RolDiario[]; onGenerarRol: () => void; guardando: boolean }) {
  return <section className="panel padded"><PanelTitle>Resumen operativo</PanelTitle><div className="summary-grid"><InfoMetric label="Bloques configurados" value={bloques.length} /><InfoMetric label="Rotaciones guardadas" value={asignaciones.length} /><InfoMetric label="Dias del rol" value={rolDiario.length} /></div><InfoBox text="El rol diario se genera desde la rotacion mensual de bloques por monitorista, no desde rangos de hora." /><button className="primary-button wide" type="button" onClick={onGenerarRol} disabled={guardando}>{guardando ? <Loader2 className="spin" size={18} /> : <FileText size={18} />}Generar propuesta de rol</button></section>;
}

function PersonalPanel({
  formulario,
  turnos,
  personal,
  editandoId,
  guardando,
  actualizarCampo,
  guardarPersonal,
  limpiarFormulario,
  editarPersona,
  eliminarPersona,
}: {
  formulario: PersonalInput;
  turnos: Turno[];
  personal: Personal[];
  editandoId: string | null;
  guardando: boolean;
  actualizarCampo: <K extends keyof PersonalInput>(campo: K, valor: PersonalInput[K]) => void;
  guardarPersonal: (event: FormEvent<HTMLFormElement>) => void;
  limpiarFormulario: () => void;
  editarPersona: (persona: Personal) => void;
  eliminarPersona: (persona: Personal) => void;
}) {
  function confirmarEliminacion(persona: Personal) {
    const confirmado = window.confirm(`Eliminar a ${persona.nombre_completo}?`);
    if (confirmado) eliminarPersona(persona);
  }

  return (
    <section className="work-grid">
      <form className="panel form-panel" onSubmit={guardarPersonal}>
        <PanelTitle>Alta / Edicion de Personal</PanelTitle>
        <Field label="Nombre completo">
          <input value={formulario.nombre_completo} onChange={(event) => actualizarCampo('nombre_completo', event.target.value)} />
        </Field>
        <Field label="Puesto">
          <select value={formulario.puesto} onChange={(event) => actualizarCampo('puesto', event.target.value as Puesto)}>
            <option>Supervisor</option>
            <option>Monitorista</option>
          </select>
        </Field>
        <Field label="Horario / Turno">
          <select value={formulario.turno_id ?? ''} onChange={(event) => actualizarCampo('turno_id', event.target.value)}>
            <option value="">Selecciona turno</option>
            {turnos.map((turno) => (
              <option key={turno.id} value={turno.id}>{turno.nombre} ({formatearHorario(turno.hora_inicio, turno.hora_fin)})</option>
            ))}
          </select>
        </Field>
        <Field label="Puede cubrir descansos"><Toggle checked={formulario.puede_cubrir_descansos} onChange={(value) => actualizarCampo('puede_cubrir_descansos', value)} /></Field>
        <Field label="Puede ser monitorista"><Toggle checked={formulario.puede_ser_monitorista} onChange={(value) => actualizarCampo('puede_ser_monitorista', value)} /></Field>
        <Field label="Descanso base 1"><DaySelect value={formulario.descanso_base_1} onChange={(value) => actualizarCampo('descanso_base_1', value)} /></Field>
        <Field label="Descanso base 2"><DaySelect value={formulario.descanso_base_2} onChange={(value) => actualizarCampo('descanso_base_2', value)} /></Field>
        <Field label="Notas"><input value={formulario.notas ?? ''} onChange={(event) => actualizarCampo('notas', event.target.value)} /></Field>
        <div className="button-row">
          <button className="primary-button" type="submit" disabled={guardando}>
            {guardando ? <Loader2 className="spin" size={18} /> : <Save size={18} />}Guardar
          </button>
          <button className="secondary-button" type="button" onClick={limpiarFormulario}>{editandoId ? 'Cancelar edicion' : 'Limpiar'}</button>
        </div>
      </form>

      <section className="panel table-panel">
        <PanelHeader title="Personal configurado" />
        <Table headers={['Nombre completo', 'Puesto', 'Horario', 'Puede cubrir', 'Puede ser monitorista', 'Acciones']}>
          {personal.map((persona) => (
            <tr key={persona.id}>
              <td>{persona.nombre_completo}</td>
              <td>{persona.puesto}</td>
              <td>{persona.turnos?.nombre ?? 'Sin turno'}</td>
              <td>{persona.puede_cubrir_descansos ? 'Si' : 'No'}</td>
              <td>{persona.puede_ser_monitorista ? 'Si' : 'No'}</td>
              <td>
                <div className="action-row">
                  <button className="edit-button" type="button" onClick={() => editarPersona(persona)} title="Editar"><Edit3 size={16} /></button>
                  <button className="danger-button compact" type="button" onClick={() => confirmarEliminacion(persona)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </section>
  );
}

function DescansosPanel({ personal, turno, rotacion }: { personal: Personal[]; turno: Turno | null; rotacion: ConfiguracionRotacion | null }) {
  const [periodos, setPeriodos] = useState(1);
  const semanasPorCiclo = rotacion?.semanas_por_ciclo ?? 4;
  const fechaInicioCiclo = personal.find((persona) => persona.fecha_inicio_ciclo)?.fecha_inicio_ciclo ?? estadoInicial.fecha_inicio_ciclo ?? fechaHoyIso;
  const inicioPeriodoActual = obtenerInicioPeriodoRotacion({
    fechaInicioCiclo,
    fechaObjetivo: fechaHoyIso,
    semanasPorCiclo,
  });
  const periodosVisibles = Array.from({ length: periodos }).map((_, periodo) => {
    const inicio = sumarDias(inicioPeriodoActual, periodo * semanasPorCiclo * 7);
    const fin = sumarDias(inicio, semanasPorCiclo * 7 - 1);
    return { periodo, inicio, fin };
  });

  return (
    <section className="panel table-panel">
      <PanelHeader title="Descansos por periodo de rotacion">
        <select value={periodos} onChange={(event) => setPeriodos(Number(event.target.value))}>
          <option value={1}>Periodo actual</option>
          <option value={2}>Periodo actual y siguiente</option>
          <option value={3}>Proximos 3 periodos</option>
        </select>
      </PanelHeader>
      <InfoBox text={`Cada ${semanasPorCiclo} semanas se recorre 1 dia a todo el personal. El descanso base se toma de Personal.`} />
      {periodosVisibles.map(({ periodo, inicio, fin }) => (
        <div key={periodo} className="week-block">
          <h3>Periodo {periodo + 1}: {formatearFechaCorta(inicio)} al {formatearFechaCorta(fin)}</h3>
          {Array.from({ length: semanasPorCiclo }).map((_, semana) => {
            const inicioSemana = sumarDias(inicio, semana * 7);
            const finSemana = sumarDias(inicioSemana, 6);
            return (
              <div key={`${periodo}-${semana}`} className="week-block nested-week">
                <h4>{formatearFechaCorta(inicioSemana)} al {formatearFechaCorta(finSemana)}</h4>
                <Table headers={['Personal', ...DIAS_SEMANA.map((dia) => DIA_LABEL[dia])]}>
                  {personal.map((persona) => (
                    <tr key={`${persona.id}-${periodo}-${semana}`}>
                      <td>{persona.nombre_completo}</td>
                      {DIAS_SEMANA.map((dia, index) => {
                        const fecha = sumarDias(inicioSemana, index);
                        const iso = fechaIsoLocal(fecha);
                        const descansa = personaDescansaEnFecha({ persona, fecha: iso, rotacion });
                        return (
                          <td key={dia}>
                            <span className={`schedule-chip ${descansa ? 'rest' : 'work'}`}>
                              {descansa ? 'Descanso' : formatearHorario(persona.turnos?.hora_inicio ?? turno?.hora_inicio, persona.turnos?.hora_fin ?? turno?.hora_fin)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Table>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function BloquesPanel({ bloques, setBloques, guardarBloque, guardando }: { bloques: Bloque[]; setBloques: (bloques: Bloque[]) => void; guardarBloque: (bloque: Bloque) => void; guardando: boolean }) {
  function update(id: string, cambios: Partial<Bloque>) { setBloques(bloques.map((bloque) => bloque.id === id ? { ...bloque, ...cambios } : bloque)); }
  return <section className="panel table-panel"><PanelHeader title="Configuracion de Bloques" /><InfoBox text="Los bloques son fijos por dia; la asignacion rota mensualmente por monitorista. Los bloques no llevan horario." /><Table headers={['Nombre del bloque', 'Descripcion', 'Orden', 'Activo', 'Acciones']}>{bloques.map((bloque) => <tr key={bloque.id}><td><input value={bloque.nombre} onChange={(event) => update(bloque.id, { nombre: event.target.value })} /></td><td><input value={bloque.descripcion ?? ''} onChange={(event) => update(bloque.id, { descripcion: event.target.value })} /></td><td><input type="number" value={bloque.orden} onChange={(event) => update(bloque.id, { orden: Number(event.target.value) })} /></td><td><Toggle checked={bloque.activo} onChange={(value) => update(bloque.id, { activo: value })} /></td><td><button className="primary-button compact" type="button" onClick={() => guardarBloque(bloque)} disabled={guardando}>Guardar</button></td></tr>)}</Table></section>;
}

function CoberturasPanel({ mes, anio, personal, coberturas, guardarCobertura }: { mes: number; anio: number; personal: Personal[]; coberturas: CoberturaMensual[]; guardarCobertura: (rol: 'Cobertura principal' | 'Cobertura secundaria', personalId: string | null) => void }) {
  const disponibles = personal.filter((persona) => persona.puede_cubrir_descansos);
  return <section className="panel padded"><PanelTitle>Coberturas Mensuales</PanelTitle><p className="muted-text">Mes {mes} / {anio}</p>{(['Cobertura principal', 'Cobertura secundaria'] as const).map((rol) => <Field key={rol} label={rol}><select value={coberturas.find((item) => item.rol_cobertura === rol)?.personal_id ?? ''} onChange={(event) => guardarCobertura(rol, event.target.value || null)}><option value="">Sin asignar</option>{disponibles.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>)}</select></Field>)}<InfoBox text="La cobertura puede rotarse y editarse manualmente cada mes." /></section>;
}

function obtenerSemanasDelMes(mes: number, anio: number) {
  const primeroMes = new Date(anio, mes - 1, 1);
  const ultimoMes = new Date(anio, mes, 0);
  const semanas: { inicio: Date; fin: Date }[] = [];
  let inicio = obtenerLunesDeSemana(primeroMes);

  while (inicio <= ultimoMes) {
    const fin = sumarDias(inicio, 6);
    semanas.push({ inicio, fin });
    inicio = sumarDias(inicio, 7);
  }

  return semanas;
}

function rotarBloquePorSemana(bloqueId: string, bloques: Bloque[], semana: number) {
  const index = bloques.findIndex((bloque) => bloque.id === bloqueId);
  if (index < 0 || !bloques.length) return bloqueId;
  return bloques[(index + semana) % bloques.length].id;
}

function RotacionPanel({ mes, anio, bloques, personal, propuesta, setPropuesta, guardarRotacion, guardando }: { mes: number; anio: number; bloques: Bloque[]; personal: Personal[]; propuesta: AsignacionBloqueMensualInput[]; setPropuesta: (p: AsignacionBloqueMensualInput[]) => void; guardarRotacion: (confirmar?: boolean) => void; guardando: boolean }) {
  const mapaPersonal = new Map(personal.map((persona) => [persona.id, persona]));
  const mapaBloques = new Map(bloques.map((bloque) => [bloque.id, bloque]));
  const semanasMes = useMemo(() => obtenerSemanasDelMes(mes, anio), [mes, anio]);
  const [ajustesSemanales, setAjustesSemanales] = useState<Record<string, string>>({});
  function update(personalId: string, bloqueId: string) { setPropuesta(propuesta.map((item) => item.personal_id === personalId ? { ...item, bloque_id: bloqueId, observaciones: item.bloque_mes_anterior_id === bloqueId ? 'Repite bloque anterior por ajuste manual.' : item.observaciones } : item)); }
  function updateSemana(personalId: string, semana: number, bloqueId: string) {
    setAjustesSemanales((actual) => ({ ...actual, [`${personalId}-${semana}`]: bloqueId }));
  }

  return (
    <section className="panel table-panel">
      <PanelHeader title="Rotacion Mensual de Bloques">
        <div className="button-row inline">
          <button className="secondary-button" type="button" onClick={() => guardarRotacion(false)} disabled={guardando}>Guardar cambios</button>
          <button className="primary-button" type="button" onClick={() => guardarRotacion(true)} disabled={guardando}>Confirmar rotacion mensual</button>
        </div>
      </PanelHeader>
      <InfoBox text="El rol de bloques es mensual por monitorista. Abajo se arma automaticamente por semana y se puede ajustar antes de confirmar." />
      <Table headers={['Monitorista', 'Bloque del mes anterior', 'Bloque base del mes', 'Mes siguiente sugerido', 'Estado']}>
        {propuesta.map((item) => (
          <tr key={item.personal_id}>
            <td>{mapaPersonal.get(item.personal_id)?.nombre_completo}</td>
            <td>{mapaBloques.get(item.bloque_mes_anterior_id ?? '')?.nombre ?? 'Sin anterior'}</td>
            <td><select value={item.bloque_id} onChange={(event) => update(item.personal_id, event.target.value)}>{bloques.map((bloque) => <option key={bloque.id} value={bloque.id}>{bloque.nombre}</option>)}</select></td>
            <td>{mapaBloques.get(item.bloque_siguiente_sugerido_id ?? '')?.nombre ?? '-'}</td>
            <td>{item.bloque_mes_anterior_id === item.bloque_id ? 'Repite: requiere confirmacion manual' : 'Sugerido'}</td>
          </tr>
        ))}
      </Table>
      <div className="week-block">
        <h3>Bloques automaticos por semana</h3>
        <Table headers={['Monitorista', ...semanasMes.map((semana) => `${formatearFechaCorta(semana.inicio)} - ${formatearFechaCorta(semana.fin)}`)]}>
          {propuesta.map((item) => (
            <tr key={`semanas-${item.personal_id}`}>
              <td>{mapaPersonal.get(item.personal_id)?.nombre_completo}</td>
              {semanasMes.map((semana, index) => {
                const key = `${item.personal_id}-${index}`;
                const bloqueId = ajustesSemanales[key] ?? rotarBloquePorSemana(item.bloque_id, bloques, index);
                return (
                  <td key={key}>
                    <select value={bloqueId} onChange={(event) => updateSemana(item.personal_id, index, event.target.value)}>
                      {bloques.map((bloque) => <option key={bloque.id} value={bloque.id}>{bloque.nombre}</option>)}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </Table>
      </div>
    </section>
  );
}

function RolPanel({ rolMensual, rolDiario, personal, turno, bloques, generarPropuestaRol, confirmarRol, guardando }: { rolMensual: RolMensual | null; rolDiario: RolDiario[]; personal: Personal[]; turno: Turno | null; bloques: Bloque[]; generarPropuestaRol: () => void; confirmarRol: () => void; guardando: boolean }) {
  const mapa = new Map(personal.map((persona) => [persona.id, persona.nombre_completo]));
  return <section className="panel table-panel"><PanelHeader title="Rol Mensual"><div className="button-row inline"><button className="primary-button" type="button" onClick={generarPropuestaRol} disabled={guardando}>Generar propuesta de rol</button><button className="secondary-button" type="button" onClick={confirmarRol} disabled={guardando || !rolMensual}>Confirmar rol final</button></div></PanelHeader><InfoBox text={`Turno ${turno?.nombre ?? 'sin turno'} ${formatearHorario(turno?.hora_inicio, turno?.hora_fin)}. La propuesta puede modificarse manualmente antes de confirmar.`} /><Table headers={['Fecha', 'Dia', 'Supervisor', ...bloques.slice(0, 5).map((bloque) => bloque.nombre), 'Cobertura', 'Falta', 'Nota', 'Acciones']}>{rolDiario.map((dia) => <tr key={dia.id}><td>{dia.fecha}</td><td>{dia.dia_semana}</td><td>{mapa.get(dia.supervisor_id ?? '') ?? '-'}</td><td>{mapa.get(dia.bloque_1_personal_id ?? '') ?? '-'}</td><td>{mapa.get(dia.bloque_2_personal_id ?? '') ?? '-'}</td><td>{mapa.get(dia.bloque_3_personal_id ?? '') ?? '-'}</td><td>{mapa.get(dia.bloque_4_personal_id ?? '') ?? '-'}</td><td>{mapa.get(dia.bloque_5_personal_id ?? '') ?? '-'}</td><td>{mapa.get(dia.cobertura_personal_id ?? '') ?? '-'}</td><td>{mapa.get(dia.falta_personal_id ?? '') ?? '-'}</td><td>{dia.motivo ?? dia.observaciones ?? '-'}</td><td><button className="secondary-button compact" type="button">Editar</button></td></tr>)}</Table>{!rolDiario.length && <p className="empty-state">Aun no hay propuesta guardada para este mes.</p>}</section>;
}

function ConfiguracionPanel({ turnos, diasEspeciales }: { turnos: Turno[]; diasEspeciales: { id: string; dia_semana: DiaSemana; cantidad_supervisores: number; cantidad_monitoristas: number; activo: boolean }[] }) {
  return <section className="work-grid"><section className="panel table-panel"><PanelHeader title="Horarios / Turnos" /><Table headers={['Nombre', 'Inicio', 'Fin', 'Estado']}>{turnos.map((turno) => <tr key={turno.id}><td>{turno.nombre}</td><td>{turno.hora_inicio}</td><td>{turno.hora_fin}</td><td>{turno.activo ? 'Activo' : 'Inactivo'}</td></tr>)}</Table></section><section className="panel table-panel"><PanelHeader title="Dias especiales" /><Table headers={['Dia', 'Supervisores', 'Monitoristas', 'Estado']}>{diasEspeciales.map((dia) => <tr key={dia.id}><td>{dia.dia_semana}</td><td>{dia.cantidad_supervisores}</td><td>{dia.cantidad_monitoristas}</td><td>{dia.activo ? 'Activo' : 'Inactivo'}</td></tr>)}</Table></section></section>;
}

function SimplePanel({ title, text }: { title: string; text: string }) { return <section className="panel padded"><PanelTitle>{title}</PanelTitle><p>{text}</p></section>; }
function StatCard({ icon: Icon, label, value, detail, active = false }: { icon: LucideIcon; label: string; value: string; detail?: string; active?: boolean }) { return <article className={`stat-card ${active ? 'active' : ''}`}><span className="stat-icon"><Icon size={30} /></span><div><p>{label}</p><strong>{value}</strong>{detail && <span>{detail}</span>}</div></article>; }
function InfoMetric({ label, value }: { label: string; value: number }) { return <div className="info-metric"><strong>{value}</strong><span>{label}</span></div>; }
function PanelTitle({ children }: { children: string }) { return <h2 className="panel-title">{children}</h2>; }
function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) { return <div className="panel-heading"><PanelTitle>{title}</PanelTitle>{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field-row"><span>{label}</span>{children}</label>; }
function InfoBox({ text }: { text: string }) { return <div className="info-note"><Info size={18} /><span>{text}</span></div>; }
function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <button className={`toggle ${checked ? 'on' : ''}`} type="button" onClick={() => onChange(!checked)} aria-pressed={checked}><span /></button>; }
function DaySelect({ value, onChange }: { value: DiaSemana | null; onChange: (value: DiaSemana) => void }) { return <select value={value ?? ''} onChange={(event) => onChange(event.target.value as DiaSemana)}>{DIAS_SEMANA.map((dia) => <option key={dia} value={dia}>{DIA_LABEL[dia]}</option>)}</select>; }
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }

export default App;
