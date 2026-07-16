import {
  BarChart3,
  Bed,
  Bell,
  CalendarDays,
  Clock,
  Edit3,
  FileText,
  Home,
  Info,
  LayoutGrid,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Settings,
  Utensils,
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
import { generarPropuestaRotacionMensual, generarRolMensual, personaDescansaEnFecha } from './lib/rolMensual';
import {
  DIA_LABEL,
  DIAS_SEMANA,
  fechaIsoLocal,
  formatearFechaCorta,
  formatearHorario,
  obtenerLunesDeSemana,
  rotarDia,
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
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'sitios', label: 'Sitios', icon: MapPin },
  { id: 'descansos', label: 'Descansos', icon: CalendarDays },
  { id: 'rol', label: 'Rol operativo', icon: FileText },
  { id: 'configuracion', label: 'Configuracion', icon: Settings },
] as const;

type MenuId = (typeof menuItems)[number]['id'];
type SitioItem = { id: string; nombre: string; seleccionado: boolean };
type SemanaTrabajo = { numero: number; inicio: Date; fin: Date };

const hoy = new Date();
const mesActual = hoy.getMonth() + 1;
const anioActual = hoy.getFullYear();

const inicioCicloDescansos = new Date('2026-06-22T00:00:00');
const periodosDescansos = Array.from({ length: 7 }).map((_, index) => {
  const inicio = sumarDias(inicioCicloDescansos, index * 28);
  const fin = sumarDias(inicio, 27);
  return {
    numero: index + 1,
    inicio,
    fin,
    label: `${index + 1} periodo: ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`,
  };
});

const sitiosBase = [
  'Centro Alterno',
  'EC Los Ramones',
  'EC Medias Aguas',
  'EC Reynosa Km.19',
  'EM Ciudad Pemex',
  'TRED Anzaldúas',
  'TRED Cactus',
  'TRED La Joya',
  'TRED Y EC Donají',
  'VT Vitroflotado',
  'VS San José Bata',
  'EC Cempoala',
  'VS San José Salinas',
  'EC Emiliano Zapata',
  'EC Jáltipan',
  'EM #2 Reynosa',
  'EM Centro Sector',
  'ERM Argüelles',
  'ERM Catus al KM-100',
  'ERM Xicoténcatl',
  'Edificio Corporativo',
  'TRED Tepeapulco',
  'TRED Tierra Blanca',
  'VS Tezontepec',
  'EC Cárdenas',
  'ERM Ojo Caliente',
  'TRED Cima de Togo',
  'EC Chinameca',
  'EC Chávez',
  'EM Santa Rosa',
  'EM Terminal Avalos',
  'ERM Entronque Minera Autlán',
  'TED Santa Ana Viejo',
  'TRD Los Robles',
  'TRED Estero de Becerra',
  'VS Tierra Blanca (TRD)',
  'VT Herdez 1027+146',
  'VT Nemak',
  'EC Pátzcuaro',
  'VS Mezcalapa',
  'ERM Caseta General Pajaritos',
  'EC Santa Catarina',
  'EM Cactus',
  'EM Gimsa',
  'ERM Agua Dulce',
  'ERM Apodaca',
  'ERM Escobedo',
  'ERM Paso del Toro',
  'TRED Irolo',
  'TRED Medias Aguas',
  'VS Aeropuerto',
  'VS Huamantla',
  'TRED Tecamachalco',
  'EM Y TRED Castaños',
  'VS Muñoz',
];

const bloquesSitiosBase = [
  {
    numero: 1,
    nombre: 'Bloque 1',
    sitios: [
      'Centro Alterno',
      'EC Los Ramones',
      'EC Medias Aguas',
      'EC Reynosa Km.19',
      'EM Ciudad Pemex',
      'TRED Anzaldúas',
      'TRED Cactus',
      'TRED La Joya',
      'TRED Y EC Donají',
      'VT Vitroflotado',
      'VS San José Bata',
    ],
  },
  {
    numero: 2,
    nombre: 'Bloque 2',
    sitios: [
      'EC Emiliano Zapata',
      'EC Jáltipan',
      'EM #2 Reynosa',
      'EM Centro Sector',
      'ERM Argüelles',
      'ERM Catus al KM-100',
      'ERM Xicoténcatl',
      'Edificio Corporativo',
      'TRED Tepeapulco',
      'TRED Tierra Blanca',
      'VS Tezontepec',
    ],
  },
  {
    numero: 3,
    nombre: 'Bloque 3',
    sitios: [
      'EC Chinameca',
      'EC Chávez',
      'EM Santa Rosa',
      'EM Terminal Avalos',
      'ERM Entronque Minera Autlán',
      'TED Santa Ana Viejo',
      'TRD Los Robles',
      'TRED Estero de Becerra',
      'VS Tierra Blanca (TRD)',
      'VT Herdez 1027+146',
      'VT Nemak',
    ],
  },
  {
    numero: 4,
    nombre: 'Bloque 4',
    sitios: [
      'EC Santa Catarina',
      'EM Cactus',
      'EM Gimsa',
      'ERM Agua Dulce',
      'ERM Apodaca',
      'ERM Escobedo',
      'ERM Paso del Toro',
      'TRED Irolo',
      'TRED Medias Aguas',
      'VS Aeropuerto',
      'VS Huamantla',
    ],
  },
  {
    numero: 5,
    nombre: 'Bloque 5',
    sitios: [
      'EC Cempoala',
      'VS San José Salinas',
      'EC Cárdenas',
      'ERM Ojo Caliente',
      'TRED Cima de Togo',
      'EC Pátzcuaro',
      'VS Mezcalapa',
      'ERM Caseta General Pajaritos',
      'TRED Tecamachalco',
      'EM Y TRED Castaños',
      'VS Muñoz',
    ],
  },
];

const bloquesSitiosMiercolesJueves = [
  {
    numero: 1,
    nombre: 'Bloque 1',
    sitios: [
      ...bloquesSitiosBase[0].sitios,
      'EC Cempoala',
      'VS San José Salinas',
    ],
  },
  {
    numero: 2,
    nombre: 'Bloque 2',
    sitios: [
      ...bloquesSitiosBase[1].sitios,
      'EC Cárdenas',
      'ERM Ojo Caliente',
      'TRED Cima de Togo',
    ],
  },
  {
    numero: 3,
    nombre: 'Bloque 3',
    sitios: [
      ...bloquesSitiosBase[2].sitios,
      'EC Pátzcuaro',
      'VS Mezcalapa',
      'ERM Caseta General Pajaritos',
    ],
  },
  {
    numero: 4,
    nombre: 'Bloque 4',
    sitios: [
      ...bloquesSitiosBase[3].sitios,
      'TRED Tecamachalco',
      'EM Y TRED Castaños',
      'VS Muñoz',
    ],
  },
];

function diasCuatroBloquesPorPeriodo(periodo: number): DiaSemana[] {
  const desplazamiento = periodo - 1;
  return [rotarDia('Miercoles', desplazamiento), rotarDia('Jueves', desplazamiento)];
}

function esDiaCuatroBloques(periodo: number, dia: DiaSemana) {
  return diasCuatroBloquesPorPeriodo(periodo).includes(dia);
}

function obtenerBloquesPorPeriodoYDia(periodo: number, dia: DiaSemana) {
  return esDiaCuatroBloques(periodo, dia) ? bloquesSitiosMiercolesJueves : bloquesSitiosBase;
}

const semanasTrabajo: SemanaTrabajo[] = Array.from({ length: 24 }).map((_, index) => {
  const inicio = sumarDias(new Date('2026-07-20T00:00:00'), index * 7);
  return { numero: index + 1, inicio, fin: sumarDias(inicio, 6) };
});

function crearSitiosIniciales(): SitioItem[] {
  return sitiosBase.map((nombre, index) => ({
    id: `sitio-${index + 1}`,
    nombre,
    seleccionado: true,
  }));
}

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
  const parametrosUrl = new URLSearchParams(window.location.search);
  const vistaPublicaSemanal = parametrosUrl.get('vista') === 'semana';
  const periodoUrl = Number(parametrosUrl.get('periodo') ?? '1');
  const semanaUrl = Number(parametrosUrl.get('semana') ?? '1');
  const [seccionActiva, setSeccionActiva] = useState<MenuId>(vistaPublicaSemanal ? 'rol' : 'inicio');
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
  const [sitios, setSitios] = useState<SitioItem[]>(() => {
    const guardados = window.localStorage.getItem('epsilon-sitios');
    if (!guardados) return crearSitiosIniciales();
    try {
      return JSON.parse(guardados) as SitioItem[];
    } catch {
      return crearSitiosIniciales();
    }
  });
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

  useEffect(() => {
    window.localStorage.setItem('epsilon-sitios', JSON.stringify(sitios));
  }, [sitios]);

  const personalActivo = useMemo(() => personal.filter((persona) => persona.activo), [personal]);
  const supervisores = personalActivo.filter((persona) => persona.puesto === 'Supervisor');
  const monitoristas = personalActivo.filter((persona) => persona.puesto === 'Monitorista');
  const turnoActivo = turnos.find((turno) => turno.id === turnoSeleccionado) ?? turnos[0] ?? null;
  const horarioActivo = formatearHorario(turnoActivo?.hora_inicio, turnoActivo?.hora_fin);
  const modulo = {
    inicio: ['Centro de Control Operativo', 'Plataforma de personal, descansos, bloques y rol mensual.'],
    personal: ['Personal', 'Alta, edicion y estado del personal.'],
    sitios: ['Sitios', 'Catalogo operativo y bloques de sitios.'],
    descansos: ['Descansos', 'Configuracion base y vista previa semanal.'],
    rol: ['Rol Operativo', 'Asignacion diaria por periodo, disponibilidad y bloques.'],
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

  if (vistaPublicaSemanal) {
    return (
      <div className="public-week-page">
        {error && <div className="notice error">{error}</div>}
        <RolOperativoPanel
          personal={personalActivo}
          rotacion={rotacion}
          vistaPublica
          periodoInicial={periodoUrl}
          semanaInicial={semanaUrl}
        />
      </div>
    );
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

          {seccionActiva === 'inicio' && <Inicio supervisores={supervisores.length} monitoristas={monitoristas.length} bloques={bloquesSitiosBase.length} sitios={sitios.filter((sitio) => sitio.seleccionado).length} horario={horarioActivo} rotacion={rotacion} onNavigate={setSeccionActiva} />}
          {seccionActiva === 'personal' && <PersonalPanel formulario={formulario} turnos={turnos} personal={personal} editandoId={editandoId} guardando={guardando} actualizarCampo={actualizarCampo} guardarPersonal={guardarPersonal} limpiarFormulario={limpiarFormulario} editarPersona={editarPersona} eliminarPersona={async (persona) => { await eliminarPersonal(persona.id); if (editandoId === persona.id) limpiarFormulario(); await cargarDatos(); }} />}
          {seccionActiva === 'sitios' && <SitiosPanel sitios={sitios} setSitios={setSitios} />}
          {seccionActiva === 'descansos' && <DescansosPanel personal={personalActivo} turno={turnoActivo} rotacion={rotacion} />}
          {seccionActiva === 'rol' && <RolOperativoPanel personal={personalActivo} rotacion={rotacion} />}
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

function Inicio({ supervisores, monitoristas, bloques, sitios, horario, rotacion, onNavigate }: { supervisores: number; monitoristas: number; bloques: number; sitios: number; horario: string; rotacion: ConfiguracionRotacion | null; onNavigate: (id: MenuId) => void }) {
  return <><section className="stats-grid"><StatCard icon={Users} label="Supervisores activos" value={String(supervisores)} active /><StatCard icon={Users} label="Monitoristas activos" value={String(monitoristas)} /><StatCard icon={MapPin} label="Sitios activos" value={String(sitios)} /><StatCard icon={LayoutGrid} label="Bloques operativos" value={String(bloques)} detail="Sitios agrupados" /><StatCard icon={Clock} label="Turno activo" value="Matutino" detail={horario} /><StatCard icon={RefreshCw} label="Ciclo de descansos" value={`Cada ${rotacion?.semanas_por_ciclo ?? 4} semanas`} detail="Se recorren descansos 1 dia" /></section><section className="quick-grid">{menuItems.filter((item) => item.id !== 'inicio').map((item) => <button key={item.id} className="quick-card" onClick={() => onNavigate(item.id)} type="button"><item.icon size={24} /><strong>{item.label}</strong><span>Ir al modulo</span></button>)}</section><InfoBox text="Los sitios se agrupan en bloques; la rotacion semanal asigna monitoristas a cada bloque." /></>;
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
        <Table headers={['Nombre completo', 'Puesto', 'Horario', 'Puede ser monitorista', 'Acciones']}>
          {personal.map((persona) => (
            <tr key={persona.id}>
              <td>{persona.nombre_completo}</td>
              <td>{persona.puesto}</td>
              <td>{persona.turnos?.nombre ?? 'Sin turno'}</td>
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

function SitiosPanel({ sitios, setSitios }: { sitios: SitioItem[]; setSitios: (sitios: SitioItem[]) => void }) {
  const [nuevoSitio, setNuevoSitio] = useState('');
  const [periodoBloques, setPeriodoBloques] = useState(1);
  const [diaBloques, setDiaBloques] = useState<DiaSemana>('Lunes');
  const seleccionados = sitios.filter((sitio) => sitio.seleccionado).length;
  const bloquesDelDia = obtenerBloquesPorPeriodoYDia(periodoBloques, diaBloques);
  const diasReducidos = diasCuatroBloquesPorPeriodo(periodoBloques);

  function actualizarSitio(id: string, cambios: Partial<SitioItem>) {
    setSitios(sitios.map((sitio) => sitio.id === id ? { ...sitio, ...cambios } : sitio));
  }

  function agregarSitio() {
    const nombre = nuevoSitio.trim().replace(/\s+/g, ' ');
    if (!nombre) return;
    setSitios([
      ...sitios,
      {
        id: `sitio-${Date.now()}`,
        nombre,
        seleccionado: true,
      },
    ]);
    setNuevoSitio('');
  }

  return (
    <section className="sites-layout">
      <section className="panel table-panel">
        <PanelHeader title={`Sitios operativos (${seleccionados} seleccionados de ${sitios.length})`}>
          <div className="button-row inline">
            <button className="secondary-button compact" type="button" onClick={() => setSitios(sitios.map((sitio) => ({ ...sitio, seleccionado: true })))}>Seleccionar todos</button>
            <button className="secondary-button compact" type="button" onClick={() => setSitios(sitios.map((sitio) => ({ ...sitio, seleccionado: false })))}>Quitar seleccion</button>
          </div>
        </PanelHeader>
        <InfoBox text="Puedes activar o desactivar sitios en conjunto, editar nombres y agregar sitios nuevos si cambia la operacion." />
        <div className="site-add-row">
          <input value={nuevoSitio} onChange={(event) => setNuevoSitio(event.target.value)} placeholder="Agregar nuevo sitio" />
          <button className="primary-button compact" type="button" onClick={agregarSitio}>Agregar</button>
        </div>
        <div className="sites-grid">
          {sitios.map((sitio) => (
            <label key={sitio.id} className="site-item">
              <input type="checkbox" checked={sitio.seleccionado} onChange={(event) => actualizarSitio(sitio.id, { seleccionado: event.target.checked })} />
              <input value={sitio.nombre} onChange={(event) => actualizarSitio(sitio.id, { nombre: event.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <PanelHeader title={`Vista de bloques por sitios - ${DIA_LABEL[diaBloques]}`}>
          <div className="period-controls">
            <select value={periodoBloques} onChange={(event) => setPeriodoBloques(Number(event.target.value))}>
              {periodosDescansos.map((periodo) => (
                <option key={periodo.numero} value={periodo.numero}>{periodo.label}</option>
              ))}
            </select>
            <select value={diaBloques} onChange={(event) => setDiaBloques(event.target.value as DiaSemana)}>
              {DIAS_SEMANA.map((dia) => <option key={dia} value={dia}>{DIA_LABEL[dia]}</option>)}
            </select>
          </div>
        </PanelHeader>
        <InfoBox text={`En este periodo los dias de 4 bloques son ${diasReducidos.map((dia) => DIA_LABEL[dia]).join(' y ')}. Esos dias cubren los 55 sitios en 4 bloques.`} />
        <div className="block-site-grid">
          {bloquesDelDia.map((bloque) => (
            <article key={bloque.numero} className="block-site-card">
              <h3>{bloque.nombre}</h3>
              <ul>
                {bloque.sitios.map((sitio) => <li key={sitio}>{sitio}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function DescansosPanel({ personal, turno, rotacion }: { personal: Personal[]; turno: Turno | null; rotacion: ConfiguracionRotacion | null }) {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(1);
  const semanasPorCiclo = rotacion?.semanas_por_ciclo ?? 4;
  const periodoActivo = periodosDescansos.find((periodo) => periodo.numero === periodoSeleccionado) ?? periodosDescansos[0];
  const fechaInicioCiclo = fechaIsoLocal(inicioCicloDescansos);

  return (
    <section className="panel table-panel">
      <PanelHeader title="Descansos por periodo de rotacion">
        <div className="period-controls">
          <select value={periodoSeleccionado} onChange={(event) => setPeriodoSeleccionado(Number(event.target.value))}>
            {periodosDescansos.map((periodo) => (
              <option key={periodo.numero} value={periodo.numero}>{periodo.label}</option>
            ))}
          </select>
        </div>
      </PanelHeader>
      <InfoBox text={`Cada ${semanasPorCiclo} semanas se recorre 1 dia a todo el personal. El descanso base se toma de Personal.`} />
      <div className="week-block">
        <h3>Periodo {periodoActivo.numero}: {formatearFechaCorta(periodoActivo.inicio)} al {formatearFechaCorta(periodoActivo.fin)}</h3>
        <Table headers={['Personal', ...DIAS_SEMANA.map((dia) => DIA_LABEL[dia])]}>
          {personal.map((persona) => (
            <tr key={`${persona.id}-${periodoActivo.numero}`}>
              <td>{persona.nombre_completo}</td>
              {DIAS_SEMANA.map((dia, index) => {
                const fecha = sumarDias(periodoActivo.inicio, index);
                const iso = fechaIsoLocal(fecha);
                const descansa = personaDescansaEnFecha({ persona: { ...persona, fecha_inicio_ciclo: fechaInicioCiclo }, fecha: iso, rotacion });
                return (
                  <td key={dia}>
                    <span className={`schedule-chip ${descansa ? 'rest' : 'work'}`}>
                      {descansa ? 'Descanso' : 'Activo'}
                    </span>
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

function BloquesPanel({ bloques, setBloques, guardarBloque, guardando }: { bloques: Bloque[]; setBloques: (bloques: Bloque[]) => void; guardarBloque: (bloque: Bloque) => void; guardando: boolean }) {
  function update(id: string, cambios: Partial<Bloque>) { setBloques(bloques.map((bloque) => bloque.id === id ? { ...bloque, ...cambios } : bloque)); }
  return <section className="panel table-panel"><PanelHeader title="Configuracion de Bloques" /><InfoBox text="Los bloques son fijos por dia; la asignacion rota mensualmente por monitorista. Los bloques no llevan horario." /><Table headers={['Nombre del bloque', 'Descripcion', 'Orden', 'Activo', 'Acciones']}>{bloques.map((bloque) => <tr key={bloque.id}><td><input value={bloque.nombre} onChange={(event) => update(bloque.id, { nombre: event.target.value })} /></td><td><input value={bloque.descripcion ?? ''} onChange={(event) => update(bloque.id, { descripcion: event.target.value })} /></td><td><input type="number" value={bloque.orden} onChange={(event) => update(bloque.id, { orden: Number(event.target.value) })} /></td><td><Toggle checked={bloque.activo} onChange={(value) => update(bloque.id, { activo: value })} /></td><td><button className="primary-button compact" type="button" onClick={() => guardarBloque(bloque)} disabled={guardando}>Guardar</button></td></tr>)}</Table></section>;
}

function personaDescansaEnSemana(persona: Personal, semana: SemanaTrabajo, rotacion: ConfiguracionRotacion | null) {
  const fechaInicioCiclo = fechaIsoLocal(inicioCicloDescansos);
  return DIAS_SEMANA.some((_, index) => {
    const fecha = fechaIsoLocal(sumarDias(semana.inicio, index));
    return personaDescansaEnFecha({ persona: { ...persona, fecha_inicio_ciclo: fechaInicioCiclo }, fecha, rotacion });
  });
}

function elegirSupervisorSemana(supervisores: Personal[], semana: SemanaTrabajo, rotacion: ConfiguracionRotacion | null) {
  return supervisores.find((persona) => !personaDescansaEnSemana(persona, semana, rotacion)) ?? supervisores[0] ?? null;
}

function elegirMonitoristaSemana(monitoristas: Personal[], semanaIndex: number, bloqueIndex: number) {
  if (!monitoristas.length) return '';
  return monitoristas[(semanaIndex + bloqueIndex) % monitoristas.length].id;
}

function RotacionPanel({ personal, rotacion }: { personal: Personal[]; rotacion: ConfiguracionRotacion | null }) {
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(1);
  const [asignacionesSemana, setAsignacionesSemana] = useState<Record<string, string>>({});
  const semana = semanasTrabajo.find((item) => item.numero === semanaSeleccionada) ?? semanasTrabajo[0];
  const semanaIndex = semana.numero - 1;
  const supervisores = personal.filter((persona) => persona.puesto === 'Supervisor');
  const monitoristas = personal.filter((persona) => persona.puesto === 'Monitorista');
  const supervisorSugerido = elegirSupervisorSemana(supervisores, semana, rotacion);
  const supervisorKey = `${semana.numero}-supervisor`;
  const supervisorSeleccionado = asignacionesSemana[supervisorKey] ?? supervisorSugerido?.id ?? '';

  function actualizarAsignacion(clave: string, personalId: string) {
    setAsignacionesSemana((actual) => ({ ...actual, [clave]: personalId }));
  }

  return (
    <section className="panel table-panel">
      <PanelHeader title="Rotacion mensual por semanas de trabajo">
        <select value={semanaSeleccionada} onChange={(event) => setSemanaSeleccionada(Number(event.target.value))}>
          {semanasTrabajo.map((item) => (
            <option key={item.numero} value={item.numero}>
              Semana {item.numero}: {formatearFechaCorta(item.inicio)} al {formatearFechaCorta(item.fin)}
            </option>
          ))}
        </select>
      </PanelHeader>
      <InfoBox text="Selecciona una semana de trabajo. Los bloques se cargan desde Sitios y solo se asignan monitoristas; el supervisor se sugiere segun descansos." />
      <section className="rotation-controls">
        <Field label="Supervisor sugerido">
          <select value={supervisorSeleccionado} onChange={(event) => actualizarAsignacion(supervisorKey, event.target.value)}>
            <option value="">Sin supervisor</option>
            {supervisores.map((persona) => (
              <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>
            ))}
          </select>
        </Field>
        <p className="muted-text">Semana {semana.numero}: {formatearFechaCorta(semana.inicio)} al {formatearFechaCorta(semana.fin)}</p>
      </section>
      <Table headers={['Bloque', 'Sitios incluidos', 'Monitorista asignado']}>
        {bloquesSitiosBase.map((bloque, index) => {
          const clave = `${semana.numero}-bloque-${bloque.numero}`;
          const monitoristaId = asignacionesSemana[clave] ?? elegirMonitoristaSemana(monitoristas, semanaIndex, index);
          return (
            <tr key={bloque.numero}>
              <td><strong>{bloque.nombre}</strong></td>
              <td>
                <div className="site-list-inline">
                  {bloque.sitios.map((sitio) => <span key={sitio}>{sitio}</span>)}
                </div>
              </td>
              <td>
                <select value={monitoristaId} onChange={(event) => actualizarAsignacion(clave, event.target.value)}>
                  <option value="">Sin asignar</option>
                  {monitoristas.map((persona) => (
                    <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>
                  ))}
                </select>
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}

function distribuirSitiosEnBloques(cantidadBloques: number) {
  const sitios = bloquesSitiosBase.flatMap((bloque) => bloque.sitios);
  return Array.from({ length: cantidadBloques }).map((_, index) => {
    const inicio = Math.floor((sitios.length / cantidadBloques) * index);
    const fin = Math.floor((sitios.length / cantidadBloques) * (index + 1));
    return {
      numero: index + 1,
      nombre: `Bloque ${index + 1}`,
      sitios: sitios.slice(inicio, fin),
    };
  });
}

function obtenerBloquesOperativos(periodo: number, dia: DiaSemana, personalParaBloques: number) {
  const bloquesDelPeriodo = obtenerBloquesPorPeriodoYDia(periodo, dia);
  if (bloquesDelPeriodo.length === 4 || personalParaBloques < 5) {
    return bloquesDelPeriodo.length === 4 ? bloquesDelPeriodo : distribuirSitiosEnBloques(4);
  }
  return bloquesDelPeriodo;
}

function fechaDelDiaEnPeriodo(periodo: { inicio: Date }, dia: DiaSemana) {
  const index = DIAS_SEMANA.indexOf(dia);
  return sumarDias(periodo.inicio, index);
}

function fechaDelDiaEnSemana(inicioSemana: Date, dia: DiaSemana) {
  const index = DIAS_SEMANA.indexOf(dia);
  return sumarDias(inicioSemana, index);
}

function personaTrabajaEnFecha(persona: Personal, fecha: string, rotacion: ConfiguracionRotacion | null) {
  const fechaInicioCiclo = fechaIsoLocal(inicioCicloDescansos);
  return !personaDescansaEnFecha({ persona: { ...persona, fecha_inicio_ciclo: fechaInicioCiclo }, fecha, rotacion });
}

function horaComida(index: number) {
  const totalMinutos = 9 * 60 + index * 30;
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  const periodo = horas >= 12 ? 'pm' : 'am';
  const hora12 = horas > 12 ? horas - 12 : horas;
  return `${hora12}:${String(minutos).padStart(2, '0')} ${periodo}`;
}

function RolOperativoPanel({
  personal,
  rotacion,
  vistaPublica = false,
  periodoInicial = 1,
  semanaInicial = 1,
}: {
  personal: Personal[];
  rotacion: ConfiguracionRotacion | null;
  vistaPublica?: boolean;
  periodoInicial?: number;
  semanaInicial?: number;
}) {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(Math.min(Math.max(periodoInicial, 1), periodosDescansos.length));
  const [semanaPeriodo, setSemanaPeriodo] = useState(Math.min(Math.max(semanaInicial, 1), 4) - 1);
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaSemana>('Lunes');
  const [ajustes, setAjustes] = useState<Record<string, string>>({});
  const [ajustesComida, setAjustesComida] = useState<Record<string, { hora?: string; relevoId?: string }>>({});
  const [rolGenerado, setRolGenerado] = useState(vistaPublica);
  const [mensajeRol, setMensajeRol] = useState('');
  const periodo = periodosDescansos.find((item) => item.numero === periodoSeleccionado) ?? periodosDescansos[0];
  const inicioSemanaSeleccionada = sumarDias(periodo.inicio, semanaPeriodo * 7);
  const finSemanaSeleccionada = sumarDias(inicioSemanaSeleccionada, 6);
  const nombreSemana = `Rol semanal ${formatearFechaCorta(inicioSemanaSeleccionada)} al ${formatearFechaCorta(finSemanaSeleccionada)} de ${finSemanaSeleccionada.getFullYear()}`;
  const slugSemana = nombreSemana
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const fecha = fechaIsoLocal(fechaDelDiaEnSemana(inicioSemanaSeleccionada, diaSeleccionado));
  const disponibles = personal.filter((persona) => personaTrabajaEnFecha(persona, fecha, rotacion));
  const supervisoresDisponibles = disponibles.filter((persona) => persona.puesto === 'Supervisor');
  const monitoristasDisponibles = disponibles.filter((persona) => persona.puesto === 'Monitorista');
  const rolKeyPrefix = `${periodoSeleccionado}-${semanaPeriodo + 1}-${diaSeleccionado}`;
  const supervisorKey = `${rolKeyPrefix}-supervisor`;
  const supervisorPrincipalId = ajustes[supervisorKey] ?? supervisoresDisponibles[0]?.id ?? '';
  const supervisorPrincipal = supervisoresDisponibles.find((persona) => persona.id === supervisorPrincipalId) ?? null;
  const supervisoresApoyo = supervisoresDisponibles.filter((persona) => persona.id !== supervisorPrincipalId);
  const diasReducidos = diasCuatroBloquesPorPeriodo(periodoSeleccionado);
  const personasParaBloque = [...monitoristasDisponibles, ...supervisoresApoyo];
  const bloquesOperativos = obtenerBloquesOperativos(periodoSeleccionado, diaSeleccionado, personasParaBloque.length);
  const faltantes = Math.max(0, bloquesOperativos.length - personasParaBloque.length);
  const descansan = personal.filter((persona) => !personaTrabajaEnFecha(persona, fecha, rotacion));

  function asignadoPorDefecto(index: number) {
    return personasParaBloque[index]?.id ?? '';
  }

  function actualizar(clave: string, valor: string) {
    setAjustes((actual) => ({ ...actual, [clave]: valor }));
    setRolGenerado(false);
    setMensajeRol('');
  }

  function actualizarComida(claveComida: string, campo: 'hora' | 'relevoId', valor: string) {
    setAjustesComida((actual) => ({
      ...actual,
      [claveComida]: {
        ...actual[claveComida],
        [campo]: valor,
      },
    }));
    setRolGenerado(false);
    setMensajeRol('');
  }

  const asignacionesBloques = bloquesOperativos.map((bloque, index) => {
    const clave = `${rolKeyPrefix}-bloque-${bloque.numero}`;
    const asignadoId = ajustes[clave] ?? asignadoPorDefecto(index);
    const asignado = personal.find((persona) => persona.id === asignadoId) ?? null;
    return { bloque, asignado };
  });
  const asignadosEnBloques = asignacionesBloques
    .map((asignacion) => asignacion.asignado)
    .filter((persona): persona is Personal => Boolean(persona));
  const asignadosUnicos = asignadosEnBloques.filter((persona, index, lista) => (
    lista.findIndex((item) => item.id === persona.id) === index
  ));
  const supervisorEstaEnBloque = Boolean(supervisorPrincipal && asignadosUnicos.some((persona) => persona.id === supervisorPrincipal.id));
  const personalOrdenadoParaComida = [
    ...asignadosUnicos,
    ...disponibles.filter((persona) => (
      !asignadosUnicos.some((asignado) => asignado.id === persona.id)
      && persona.id !== supervisorPrincipalId
    )),
    ...(supervisorPrincipal && !supervisorEstaEnBloque ? [supervisorPrincipal] : []),
  ];

  const personalConComida = personalOrdenadoParaComida.map((persona, index) => {
    const bloqueAsignado = asignacionesBloques.find((asignacion) => asignacion.asignado?.id === persona.id)?.bloque ?? null;
    const posiblesRelevos = personasParaBloque.filter((candidato) => candidato.id !== persona.id);
    const relevo = posiblesRelevos[index % Math.max(posiblesRelevos.length, 1)] ?? supervisorPrincipal ?? null;
    const claveComida = `${rolKeyPrefix}-comida-${persona.id}`;
    const ajusteComida = ajustesComida[claveComida] ?? {};
    const relevoEditado = personasParaBloque.find((candidato) => candidato.id === ajusteComida.relevoId) ?? null;
    return {
      persona,
      claveComida,
      bloqueAsignado,
      hora: ajusteComida.hora || horaComida(index),
      relevo: relevoEditado ?? relevo,
    };
  });
  const comidasPorPersona = new Map(personalConComida.map((item) => [item.persona.id, item]));
  const comidaSupervisorPrincipal = supervisorPrincipal ? comidasPorPersona.get(supervisorPrincipal.id) : null;

  function leerAjustesSemanaAnterior() {
    if (semanaPeriodo <= 0) return {};
    const clave = `epsilon-rol-semana-${periodoSeleccionado}-${semanaPeriodo}`;
    try {
      const guardado = localStorage.getItem(clave);
      if (!guardado) return {};
      return (JSON.parse(guardado).ajustes ?? {}) as Record<string, string>;
    } catch {
      return {};
    }
  }

  function sugerirDia(dia: DiaSemana, semanaIndex = semanaPeriodo) {
    const inicioSemana = sumarDias(periodo.inicio, semanaIndex * 7);
    const fechaDia = fechaIsoLocal(fechaDelDiaEnSemana(inicioSemana, dia));
    const disponiblesDia = personal.filter((persona) => personaTrabajaEnFecha(persona, fechaDia, rotacion));
    const supervisoresDia = disponiblesDia.filter((persona) => persona.puesto === 'Supervisor');
    const monitoristasDia = disponiblesDia.filter((persona) => persona.puesto === 'Monitorista');
    const supervisorDia = supervisoresDia[0] ?? null;
    const supervisoresApoyoDia = supervisoresDia.filter((persona) => persona.id !== supervisorDia?.id);
    const personasDia = [...monitoristasDia, ...supervisoresApoyoDia];
    const bloquesDia = obtenerBloquesOperativos(periodoSeleccionado, dia, personasDia.length);
    const ajustesSemanaAnterior = leerAjustesSemanaAnterior();
    const offset = (periodoSeleccionado - 1) + semanaIndex + DIAS_SEMANA.indexOf(dia);
    const personasRotadas = personasDia.length
      ? personasDia.map((_, index) => personasDia[(index + offset) % personasDia.length])
      : [];
    const usadas = new Set<string>();
    const prefix = `${periodoSeleccionado}-${semanaIndex + 1}-${dia}`;
    const prefixAnterior = `${periodoSeleccionado}-${semanaIndex}-${dia}`;
    const nuevosAjustes: Record<string, string> = {
      [`${prefix}-supervisor`]: supervisorDia?.id ?? '',
    };
    bloquesDia.forEach((bloque, index) => {
      const anteriorEnBloque = ajustesSemanaAnterior[`${prefixAnterior}-bloque-${bloque.numero}`];
      const sugerido = personasRotadas[index];
      const alternativa = personasRotadas.find((persona) => persona.id !== anteriorEnBloque && !usadas.has(persona.id));
      const elegido = sugerido && sugerido.id !== anteriorEnBloque && !usadas.has(sugerido.id)
        ? sugerido
        : alternativa ?? sugerido;
      if (elegido) usadas.add(elegido.id);
      nuevosAjustes[`${prefix}-bloque-${bloque.numero}`] = elegido?.id ?? '';
    });
    return nuevosAjustes;
  }

  function generarDia() {
    setAjustes((actual) => ({ ...actual, ...sugerirDia(diaSeleccionado) }));
    setRolGenerado(false);
    setMensajeRol(`Sugerencia generada para ${DIA_LABEL[diaSeleccionado]}.`);
  }

  function generarSemana() {
    const sugerencias = DIAS_SEMANA.reduce<Record<string, string>>((acumulado, dia) => ({
      ...acumulado,
      ...sugerirDia(dia, semanaPeriodo),
    }), {});
    setAjustes((actual) => ({ ...actual, ...sugerencias }));
    setRolGenerado(false);
    setMensajeRol(`Semana ${semanaPeriodo + 1} generada de lunes a domingo.`);
  }

  function generarRolSemanal() {
    const sugerencias = DIAS_SEMANA.reduce<Record<string, string>>((acumulado, dia) => ({
      ...acumulado,
      ...sugerirDia(dia, semanaPeriodo),
    }), {});
    setAjustes((actual) => ({ ...actual, ...sugerencias }));
    setRolGenerado(true);
    setMensajeRol(`Rol operativo semanal generado. Usa el selector de dia para revisar lunes a domingo.`);
  }

  function guardarDia() {
    const clave = `epsilon-rol-dia-${rolKeyPrefix}`;
    localStorage.setItem(clave, JSON.stringify({ ajustes, ajustesComida, fecha }));
    setMensajeRol(`Dia guardado: ${DIA_LABEL[diaSeleccionado]} ${fecha}.`);
  }

  function guardarSemana() {
    const clave = `epsilon-rol-semana-${periodoSeleccionado}-${semanaPeriodo + 1}`;
    localStorage.setItem(clave, JSON.stringify({ ajustes, ajustesComida, inicio: fechaIsoLocal(inicioSemanaSeleccionada), fin: fechaIsoLocal(finSemanaSeleccionada) }));
    setMensajeRol(`Semana ${semanaPeriodo + 1} guardada localmente.`);
  }

  async function copiarLinkSemanal() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('vista', 'semana');
    url.searchParams.set('periodo', String(periodoSeleccionado));
    url.searchParams.set('semana', String(semanaPeriodo + 1));
    url.hash = slugSemana;
    await navigator.clipboard.writeText(`${nombreSemana}\n${url.toString()}`);
    setMensajeRol(`${nombreSemana} copiado con link interactivo.`);
  }

  useEffect(() => {
    if (vistaPublica) document.title = nombreSemana;
  }, [nombreSemana, vistaPublica]);

  function resumenDiaSemana(dia: DiaSemana) {
    const fechaDiaDate = fechaDelDiaEnSemana(inicioSemanaSeleccionada, dia);
    const fechaDia = fechaIsoLocal(fechaDiaDate);
    const disponiblesDia = personal.filter((persona) => personaTrabajaEnFecha(persona, fechaDia, rotacion));
    const supervisoresDia = disponiblesDia.filter((persona) => persona.puesto === 'Supervisor');
    const monitoristasDia = disponiblesDia.filter((persona) => persona.puesto === 'Monitorista');
    const supervisorDiaId = ajustes[`${periodoSeleccionado}-${semanaPeriodo + 1}-${dia}-supervisor`] ?? supervisoresDia[0]?.id ?? '';
    const supervisoresApoyoDia = supervisoresDia.filter((persona) => persona.id !== supervisorDiaId);
    const personasBloqueDia = [...monitoristasDia, ...supervisoresApoyoDia];
    const bloquesDia = obtenerBloquesOperativos(periodoSeleccionado, dia, personasBloqueDia.length);
    const asignacionesDia = bloquesDia.map((bloque, index) => {
      const clave = `${periodoSeleccionado}-${semanaPeriodo + 1}-${dia}-bloque-${bloque.numero}`;
      const personaId = ajustes[clave] ?? personasBloqueDia[index]?.id ?? '';
      const persona = personal.find((item) => item.id === personaId) ?? null;
      return { bloque, persona };
    });
    const descansanDia = personal.filter((persona) => !personaTrabajaEnFecha(persona, fechaDia, rotacion));
    return {
      dia,
      fechaDiaDate,
      fechaDia,
      disponiblesDia,
      bloquesDia,
      asignacionesDia,
      descansanDia,
      faltantesDia: Math.max(0, bloquesDia.length - asignacionesDia.filter((item) => item.persona).length),
    };
  }

  const resumenSemanal = DIAS_SEMANA.map((dia) => resumenDiaSemana(dia));

  return (
    <section className="panel table-panel">
      {!vistaPublica && <PanelHeader title="Rol operativo por periodo y dia">
        <div className="period-controls">
          <select value={periodoSeleccionado} onChange={(event) => { setPeriodoSeleccionado(Number(event.target.value)); setSemanaPeriodo(0); setRolGenerado(false); }}>
            {periodosDescansos.map((item) => <option key={item.numero} value={item.numero}>{item.label}</option>)}
          </select>
          <select value={semanaPeriodo} onChange={(event) => { setSemanaPeriodo(Number(event.target.value)); setRolGenerado(false); }}>
            {[0, 1, 2, 3].map((index) => {
              const inicio = sumarDias(periodo.inicio, index * 7);
              const fin = sumarDias(inicio, 6);
              return <option key={index} value={index}>Semana {index + 1}: {formatearFechaCorta(inicio)} al {formatearFechaCorta(fin)}</option>;
            })}
          </select>
          <select value={diaSeleccionado} onChange={(event) => setDiaSeleccionado(event.target.value as DiaSemana)}>
            {DIAS_SEMANA.map((dia) => <option key={dia} value={dia}>{DIA_LABEL[dia]}</option>)}
          </select>
        </div>
      </PanelHeader>}
      {!vistaPublica && <section className="role-actions top">
        <button className="primary-button compact" type="button" onClick={generarRolSemanal}>
          <FileText size={18} />
          Generar Rol Operativo Semanal
        </button>
        <button className="secondary-button compact" type="button" onClick={guardarDia}>Guardar dia</button>
        <button className="secondary-button compact" type="button" onClick={guardarSemana}>Guardar semana</button>
        <button className="secondary-button compact" type="button" onClick={copiarLinkSemanal}>Copiar link semanal</button>
        {mensajeRol && <small>{mensajeRol}</small>}
      </section>}
      <div className="weekly-report-export">
      <section className="weekly-role-view">
        <div className="weekly-report-hero">
          <div className="weekly-report-title">
            <span className="weekly-report-icon"><CalendarDays size={30} /></span>
            <div>
              <h2>ROL OPERATIVO SEMANAL</h2>
              <p>Semana {semanaPeriodo + 1} - {formatearFechaCorta(inicioSemanaSeleccionada)} al {formatearFechaCorta(finSemanaSeleccionada)} de {finSemanaSeleccionada.getFullYear()}</p>
            </div>
          </div>
          <div className="weekly-report-kpis">
            <div className="kpi-green"><Users size={25} /><strong>{Math.round(resumenSemanal.reduce((total, dia) => total + dia.disponiblesDia.length, 0) / 7)}</strong><span>Disponibles promedio</span></div>
            <div className="kpi-blue"><LayoutGrid size={25} /><strong>{(resumenSemanal.reduce((total, dia) => total + dia.bloquesDia.length, 0) / 7).toFixed(1)}</strong><span>Bloques promedio</span></div>
            <div className="kpi-green"><MapPin size={25} /><strong>55</strong><span>Sitios</span></div>
            <div className="kpi-orange"><User size={25} /><strong>{resumenSemanal.reduce((total, dia) => total + dia.faltantesDia, 0)}</strong><span>Faltantes semana</span></div>
          </div>
        </div>
        <div className="weekly-report-strip">Resumen semanal - Semana {semanaPeriodo + 1}</div>
        <div className="weekly-role-grid">
          {resumenSemanal.map((resumen) => (
            <button
              key={resumen.dia}
              className={`weekly-role-card ${diaSeleccionado === resumen.dia ? 'active' : ''}`}
              type="button"
              onClick={() => setDiaSeleccionado(resumen.dia)}
            >
              <div className="weekly-role-head">
                <strong>{DIA_LABEL[resumen.dia]}</strong>
                <span>{formatearFechaCorta(resumen.fechaDiaDate)}</span>
              </div>
              <div className="weekly-role-metrics">
                <span className="metric-green"><b>{resumen.disponiblesDia.length}</b> disponibles</span>
                <span className="metric-yellow"><b>{resumen.bloquesDia.length}</b> bloques</span>
                <span className="metric-red"><b>{resumen.faltantesDia}</b> faltantes</span>
              </div>
              <div className="weekly-role-assignments">
                {resumen.asignacionesDia.map((asignacion) => (
                  <span key={asignacion.bloque.numero}>
                    {asignacion.bloque.nombre}: {asignacion.persona?.nombre_completo ?? 'Sin asignar'}
                  </span>
                ))}
              </div>
              <small>Descansan: {resumen.descansanDia.length ? resumen.descansanDia.map((persona) => persona.nombre_completo).join(', ') : 'Nadie'}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="generated-role">
          <div className="generated-role-header">
            <div>
              <h3><CalendarDays size={23} /> DETALLE OPERATIVO</h3>
              <p>{DIA_LABEL[diaSeleccionado]} {fecha} - Periodo {periodoSeleccionado}</p>
            </div>
          </div>

          <div className="generated-mini-summary">
            <span><LayoutGrid size={17} /> {bloquesOperativos.length} <small>bloques</small></span>
            <span><MapPin size={17} /> {bloquesOperativos.reduce((total, bloque) => total + bloque.sitios.length, 0)} <small>sitios</small></span>
            <span><Users size={17} /> {disponibles.length} <small>disponibles</small></span>
            <span className="danger"><User size={17} /> {faltantes} <small>faltantes</small></span>
          </div>

          <div className="generated-sections">
            <div className="generated-column">
              <h4>Comidas y relevos</h4>
              {personalConComida.map((item, index) => (
                <article key={item.persona.id} className="meal-card">
                  <strong>
                    <span>Comida</span>
                    {item.hora}
                    <Utensils size={18} />
                  </strong>
                  <i>{index + 1}</i>
                  <div>
                    <span>{item.persona.nombre_completo}</span>
                    <small>{item.persona.puesto}{item.bloqueAsignado ? ` - ${item.bloqueAsignado.sitios.length} sitios` : ''}</small>
                    {item.bloqueAsignado && (
                      <div className="meal-sites">
                        {item.bloqueAsignado.sitios.map((sitio) => <b key={sitio}>{sitio}</b>)}
                      </div>
                    )}
                  </div>
                  <em>Releva:<b>{item.relevo?.nombre_completo ?? 'Sin relevo'}</b><RefreshCw size={17} /></em>
                </article>
              ))}
            </div>
          </div>
          <div className="generated-rest-strip">
            <span><Bed size={24} /></span>
            <strong>DESCANSAN</strong>
            <div>
              {descansan.length ? descansan.map((persona) => <b key={persona.id}><User size={15} />{persona.nombre_completo}</b>) : <b>Nadie</b>}
            </div>
          </div>
      </section>
      </div>
      {!vistaPublica && <InfoBox text={`En este periodo los dias de 4 bloques son ${diasReducidos.map((dia) => DIA_LABEL[dia]).join(' y ')}. Si faltan monitoristas en otro dia, tambien se reduce a 4 bloques y se cubren los 55 sitios.`} />}

      {!vistaPublica && <section className="role-summary-grid">
        <InfoMetric label="Personal disponible" value={disponibles.length} />
        <InfoMetric label="Monitoristas disponibles" value={monitoristasDisponibles.length} />
        <InfoMetric label="Supervisores disponibles" value={supervisoresDisponibles.length} />
        <InfoMetric label="Bloques del dia" value={bloquesOperativos.length} />
        <InfoMetric label="Sitios cubiertos" value={bloquesOperativos.reduce((total, bloque) => total + bloque.sitios.length, 0)} />
        <InfoMetric label="Faltantes" value={faltantes} />
      </section>}

      {!vistaPublica && <section className="rotation-controls">
        <Field label="Supervisor del turno">
          <select value={supervisorPrincipalId} onChange={(event) => actualizar(supervisorKey, event.target.value)}>
            <option value="">Sin supervisor</option>
            {supervisoresDisponibles.map((persona) => (
              <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>
            ))}
          </select>
        </Field>
        {supervisorPrincipal && comidaSupervisorPrincipal && !supervisorEstaEnBloque && (
          <div className="supervisor-meal-edit">
            <strong>Comida del supervisor en turno</strong>
            <label>
              Comida
              <input value={comidaSupervisorPrincipal.hora} onChange={(event) => actualizarComida(comidaSupervisorPrincipal.claveComida, 'hora', event.target.value)} />
            </label>
            <label>
              Releva
              <select value={comidaSupervisorPrincipal.relevo?.id ?? ''} onChange={(event) => actualizarComida(comidaSupervisorPrincipal.claveComida, 'relevoId', event.target.value)}>
                <option value="">Sin relevo</option>
                {personasParaBloque.filter((persona) => persona.id !== supervisorPrincipal.id).map((persona) => (
                  <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <p className="muted-text">Fecha base del calculo: {fecha}. Supervisor principal: {supervisorPrincipal?.nombre_completo ?? 'sin asignar'}.</p>
      </section>}

      {!vistaPublica && <section className="role-block-grid">
        {asignacionesBloques.map(({ bloque, asignado }) => {
          const clave = `${rolKeyPrefix}-bloque-${bloque.numero}`;
          const asignadoId = asignado?.id ?? '';
          const comidaAsignado = asignado ? comidasPorPersona.get(asignado.id) : null;
          return (
            <article key={bloque.numero} className="role-block-card">
              <h3>{bloque.nombre}</h3>
              <ul>
                {bloque.sitios.map((sitio) => <li key={sitio}>{sitio}</li>)}
              </ul>
              <div className="role-assignment">
                <label>Asignado</label>
                <select value={asignadoId} onChange={(event) => actualizar(clave, event.target.value)}>
                  <option value="">Sin asignar</option>
                  {personasParaBloque.map((persona) => (
                    <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>
                  ))}
                </select>
                <span className={`role-type ${asignado?.puesto === 'Supervisor' ? 'support' : asignado ? 'monitor' : 'missing'}`}>
                  {asignado?.puesto === 'Supervisor' ? 'Supervisor como apoyo' : asignado ? 'Monitorista' : 'Falta cubrir'}
                </span>
                {asignado && comidaAsignado && (
                  <div className="inline-meal-edit">
                    <label>
                      Comida
                      <input value={comidaAsignado.hora} onChange={(event) => actualizarComida(comidaAsignado.claveComida, 'hora', event.target.value)} />
                    </label>
                    <label>
                      Releva
                      <select value={comidaAsignado.relevo?.id ?? ''} onChange={(event) => actualizarComida(comidaAsignado.claveComida, 'relevoId', event.target.value)}>
                        <option value="">Sin relevo</option>
                        {personasParaBloque.filter((persona) => persona.id !== asignado.id).map((persona) => (
                          <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>
                        ))}
                        {supervisorPrincipal && supervisorPrincipal.id !== asignado.id && (
                          <option value={supervisorPrincipal.id}>{supervisorPrincipal.nombre_completo}</option>
                        )}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>}

      {!vistaPublica && <section className="role-people-strip">
        <strong>Descansan:</strong>
        {descansan.length ? descansan.map((persona) => <span key={persona.id}>{persona.nombre_completo}</span>) : <span>Nadie</span>}
      </section>}
    </section>
  );
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
