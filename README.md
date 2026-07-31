# Lvl UP

App de hábitos con mecánicas RPG. PWA (React + Vite) con backend en Supabase.
Este repositorio es un monorepo gestionado con **npm workspaces**.

## Estructura

- `app/` — PWA en React + Vite.
- `packages/rules-engine/` — lógica de reglas del RPG, TypeScript puro (sin React ni backend).
- `packages/api-client/` — cliente futuro de Supabase (placeholder).
- `backend/` — esquema y configuración de Supabase (pendiente).
- `assets/` — sprites e iconos (pendiente).

## Instalación

```bash
npm install
```

Instala las dependencias de todos los workspaces (`app`, `packages/rules-engine`, `packages/api-client`) desde la raíz.

## Arrancar la app en local

```bash
npm run dev:app
```

## Tests de rules-engine

```bash
npm run test:rules-engine
```

O directamente dentro del paquete:

```bash
cd packages/rules-engine
npm test
```
