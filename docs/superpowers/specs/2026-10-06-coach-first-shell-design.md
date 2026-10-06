# Coach-first shell — diseño

Fecha: 2026-10-06 · Rama: `feat/coach-mode-mvp`

## 1. Problema y objetivo

Un profe casi no entrena con la app: necesita ver a sus alumnos, asignar rutinas y revisar progreso.
Hoy el panel de coach está en Ajustes → "Coach dashboard" (Home → Ajustes → Coach) y el tab bar
(Home / Plan / Start / Stats / Exercises) es de atleta.

**Objetivo:** para `user.coach`, la app abre en el panel de alumnos y lo frecuente (adherencia, asignar,
progreso por alumno) queda a 0–1 toques. El entrenamiento propio del coach sigue disponible (rol dual).

**Criterio de éxito:** abrir la app → ver alumnos y qué requiere atención sin navegar.

**Uso frecuente del coach (confirmado):** ver quién entrenó/faltó, armar y asignar rutinas, revisar progreso
de un alumno. Los pedidos de cambio son secundarios (badge, no pantalla).

**No cambia:** alumnos y usuarios sin coach ven la app exactamente igual. No se toca `lib/` ni `store/`
(`mergeAssigned`/`stripAssigned` intactos).

## 2. Navegación

Tab bar para `user.coach`:

```
Alumnos · Rutinas · [＋ Asignar] · Actividad · Yo
/coach   /coach/rutinas  (sheet)   /coach/actividad   /yo
```

- Ruta inicial de un coach: `#/coach` (en vez de `#/home`).
- **Alumnos**: `Coach.jsx` actual como raíz (sin flecha "atrás").
- **Rutinas**: reusa `Plan.jsx` / `RoutineEdit.jsx` (las plantillas viven en `S.routines`); solo cambia el punto de
  entrada y el título. Cada rutina gana "Asignar a…".
- **＋ Asignar**: botón central elevado (el lugar del "Start" actual), abre el sheet de asignación.
- **Actividad**: feed por día (§4).
- **Yo**: shell de atleta actual (Home, Workout, Stats, Ajustes). Dentro de `/yo/*` se muestra el tab bar de
  atleta con un primer tab "← Coach". Se elimina la fila "Coach dashboard" de Settings.
- Si el coach tiene `S.active`, el tab "Yo" muestra el punto naranja y el tab bar de coach un chip "Resume".
- Implementación: `TabBar.jsx` elige el arreglo de tabs según rol; `App.jsx` agrega rutas y redirige `/` según rol.
  No hacen falta íconos nuevos (`person`, `list`, `chart`, `plus` existen).

## 3. Pantalla Alumnos

1. Header "Alumnos" + botón de invitar (abre el sheet de códigos; `InvitesCard` deja de ir al final de la página).
2. Banda **Requiere atención** (solo si hay algo): pedidos de cambio pendientes, o sin entrenar hace ≥ N días con
   rutina asignada. N es una constante en la lib nueva (valor inicial: 5).
3. Lista, una fila por alumno: nombre (+ punto verde si `live`), **tira semanal de 7 días** (lleno = entrenó,
   aro = tocaba y faltó, vacío = descanso; reusa `.week/.wday/.dot`), subtítulo `3/4 esta semana · último: ayer`,
   badge naranja con pedidos pendientes.
4. Orden: atención primero, luego por última actividad. Con ≥ 8 alumnos aparece `.searchf`.

**Detalle de alumno:** pasa de bottom sheet a pantalla `/coach/alumno/:id` con *Rutinas asignadas* (Asignar / quitar),
*Progreso* (componentes de `ProgressViews`: PRs, cargas, peso corporal, esfuerzo) e *Historial*.

## 4. Actividad

Línea de tiempo por día: "Juan terminó *Pierna A* · hace 2 h", "Ana pidió un cambio en *Empuje*". Sin filtros en v1.
Se construye con datos que `studentRows`/`studentDetail` ya exponen más `weekDays` (§6); si falta el nombre del
workout en `studentRows`, se agrega `lastWorkoutName`.

## 5. Asignación (sheet de dos pasos, tres entradas)

1. Elegir rutina de tus plantillas. Sin plantillas → botón "Crear rutina" que lleva a Rutinas.
2. Elegir alumnos (multi-selección + "Todos"); los que ya la tienen se muestran marcados y deshabilitados.
3. Confirmar → toast "Asignada a N alumnos".

Entradas: botón ＋; menú de cada rutina en Rutinas (salta al paso 2); botón "Asignar" en el detalle del alumno
(salta al paso 1, alumno preseleccionado). Es un único componente.

**Sin cambios de API:** `POST /api/coaching/assign` sigue recibiendo un `studentId`. El cliente lanza una llamada
por alumno con `Promise.allSettled` y reporta fallos parciales ("2 de 3; falló Ana: …"). Un endpoint batch queda
fuera de alcance hasta que haga falta.

## 6. Cambio de backend

`studentRows` (`api/coaching.js`) suma, por alumno:
- `weekDays`: fechas con workout en los últimos 7 días.
- `plannedDays`: días planificados en el `S.week` del alumno.

Sin plan semanal → `plannedDays` vacío y la UI muestra solo días entrenados (sin aros de "faltó").
Lógica pura con tests en `api/coaching.test.js`.

## 7. Código y tests

- Lógica pura nueva en `frontend/src/lib/` (p. ej. `coachShell.js`): tabs según rol, estado de cada día de la
  tira semanal, criterio de "requiere atención", orden de la lista. Tests Vitest.
- Estilos solo vía tokens y clases de `index.css` (sin inline styles nuevos), dark + light, 8 acentos,
  mobile-first y luego desktop ≥1000px. Targets ≥ 44px.
- Copy de Coach en español literal (excepción documentada en CLAUDE.md): no se tocan los 12 locales.
- Verificación: `cd frontend && npm test`, `cd api && npm test`, `node scripts/check-locales.mjs`, y recorrido manual
  en el navegador: login coach → Alumnos → asignar a varios → abrir alumno → "Yo" → iniciar y terminar workout
  → volver a Coach, en dark/light y 375px/desktop.

## 8. Fuera de alcance

Chat/mensajes, notificaciones nuevas, asignar bloques completos (`S.program`; se resuelve al acoplar con lo
existente), métricas agregadas de todos los alumnos, endpoint batch de asignación, filtros en Actividad.

## 9. Supuestos a confirmar al implementar

- Una rutina asignada se refiere a la rutina del coach por id (el detalle lee `coachRoutines`), por lo que editar la
  plantilla podría reflejarse en los alumnos. Verificar el comportamiento real antes de mostrar copy sobre esto.

## 10. Ajustes al implementar

### Cambios de backend respecto al diseño original

- El API devuelve `workoutDates`, `plannedWeekdays`, `recent`, `assignedRoutineIds` (no `weekDays`/`plannedDays`);
  la semana se calcula en el cliente con la fecha local del coach.
- Rutinas es una vista nueva y delgada (`CoachRoutines`), no una reutilización de `Plan.jsx`; "Yo" es `/home`
  (no `/yo`).
- Actividad se agrupa por día: los workouts no tienen hora.
- Detalle de alumno: tiles + gráfico de peso + historial (sin PRs/1RM; requeriría datos nuevos).
- El indicador de workout en curso es un punto en el tab "Yo" (sin chip "Resume").
- `dayPlan` (overrides por fecha) del alumno se ignora en la tira; solo cuenta `S.week`.

### Cambios de componentes respecto al diseño original

- El sheet de asignación (paso 2, filas de alumnos): los estudiantes que ya tienen la rutina asignada usan
  la clase `.item.off` e inert. Las filas "Todos"/estudiantes sin asignar son div + onClick; las rutinas del paso 1
  son botones reales.
- Componentes compartidos orientados a coach (`ProgressViews`, `InvitesCard`) aceptan un prop opcional `t` cuyo
  fallback en inglés interpola placeholders `{n}` (exportados como `id` desde `ProgressViews.jsx`).
- El script `check-locales.mjs` ya fallaba antes de este trabajo (34 keys faltantes en 11 locales no-español),
  remanente de shares-components WIP; una sincronización de locales es un follow-up pendiente.
- El recorrido manual en navegador (§7) es un paso humano pendiente: requiere login de coach con passkey.
- Nuevos componentes: `AssignSheet.jsx` (sheet de dos pasos), `WeekMini.jsx` (mini-tira de 7 días).
- Nueva librería: `lib/coachShell.js` (lógica de orden de lista, criterios de atención, tabs según rol).
