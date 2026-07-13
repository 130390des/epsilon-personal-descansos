# Epsilon.net tecnologia - Plataforma operativa

Aplicacion web funcional para administrar personal, turnos, descansos, bloques fijos, coberturas, rotacion mensual de bloques y rol mensual diario. La fuente real de datos es Supabase: los formularios guardan en base de datos y las tablas leen desde base de datos.

## Stack

- React + Vite
- TypeScript
- Tailwind CSS
- Supabase
- React Router
- Lucide React
- Preparado para GitHub y Vercel

## Modulos

- Inicio / Centro de Control Operativo
- Operacion
- Personal
- Descansos
- Bloques
- Coberturas
- Rotacion mensual
- Rol mensual
- Reportes
- Configuracion

Regla central: los bloques no son horarios. Los bloques son fijos por dia y la asignacion rota mensualmente por monitorista. El horario pertenece al turno del personal.

## Instalacion local

```bash
npm install
npm run dev
```

## Variables de entorno

Copia `.env.example` como `.env` y agrega las llaves de Supabase:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

No subas `.env` al repositorio. `.gitignore` ya lo excluye.

## Base de datos

1. Crea un proyecto en Supabase.
2. Abre el SQL Editor.
3. Ejecuta `supabase/schema.sql`.

El archivo crea:

- `turnos`
- `personal`
- `configuracion_rotacion`
- `bloques`
- `cobertura_mensual`
- `asignacion_bloques_mensual`
- `dias_especiales`
- `roles_mensuales`
- `rol_diario`

Tambien crea normalizacion de nombres, indice unico para evitar duplicados, politicas RLS para uso interno y datos semilla iniciales.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Deploy en Vercel

1. Sube esta carpeta a GitHub.
2. Importa el repositorio en Vercel.
3. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Usa `npm run build` como comando de build.
5. Usa `dist` como carpeta de salida.

## Estado funcional

La app permite guardar y editar personal, evitar duplicados por nombre normalizado, editar bloques fijos, configurar coberturas por mes, generar/guardar rotacion mensual de bloques y generar rol mensual diario en Supabase.
