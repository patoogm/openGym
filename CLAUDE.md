# CLAUDE.md — openGym

Contexto para Claude (Code / Design / Cowork) al trabajar en este repo.
**Foco actual: rediseñar/mejorar la UI existente con Claude Design**, sin romper la lógica ni el stack.

---

## 1. Qué es

openGym es un tracker de gimnasio y peso corporal, self-hosted y mobile-first (PWA instalable).
Fork de [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0), extendido
con **Coach mode** (coach ↔ alumnos, rutinas asignadas, invitaciones) y **Program / training blocks**.

- Idioma por defecto de la UI: **español** (`DEF.lang = 'es'`). 12 idiomas en total.
- Usuario típico: alguien en el gimnasio, con el teléfono en una mano, entre series. Pantalla chica,
  manos transpiradas, poca atención → targets grandes, lectura de un vistazo.
- Tres "sabores" del mismo frontend: self-hosted (con API + passkeys), demo en navegador (sin server),
  y app móvil Capacitor (`VITE_MOBILE=1`, sin backend, datos en el teléfono).

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8, React Router 7 (**HashRouter**), Zustand 5. JS/JSX (no TypeScript) |
| Estilos | **Un solo archivo CSS plano**: `frontend/src/index.css` (~940 líneas). Sin Tailwind, sin CSS-in-JS, sin librería de componentes |
| Iconos | Set propio dibujado a mano en SVG: `frontend/src/components/Icon.jsx` (nada de emoji ni librerías) |
| Gráficos | SVG a mano (`LineChart`, `Heatmap`, `BodyMap`). Sin librería de charts |
| Backend | `api/server.js` — Node sin framework, deps: `@simplewebauthn/server`, `web-push`. Datos en JSON bajo `./data` |
| Mobile | Capacitor 7 (`frontend/android`, `frontend/ios`) |
| Tests | Vitest (frontend, `src/lib/*.test.js`), `node --test` (api) |
| Deploy | Docker Compose (nginx `web` + `api` + media), Render (`render.yaml`) |

## 3. Comandos

```bash
npm run dev                      # (raíz) API :3000 + media :8888 + Vite :5173 → abrir :5173
cd frontend && npm run dev       # solo Vite (proxy /api, /img, /gif configurado en vite.config.js)
cd frontend && npm test          # Vitest — lógica de entrenamiento
cd frontend && npm run build     # build estático a dist/
cd frontend && node scripts/check-locales.mjs   # verifica que todos los locales tengan las mismas keys
cd api && npm test               # tests del backend
docker compose up -d --build     # stack completo en :8080 (necesario para probar passkeys)
```

## 4. Estructura

```
frontend/src/
  main.jsx            entrada, registra el service worker (no en mobile)
  App.jsx             shell: rutas, aplica theme/accent en <html>, TabBar, RestTimer, Modals, Toast
  index.css           ★ TODO el sistema de diseño (tokens + componentes + layout desktop)
  sheets.jsx          ★ casi todos los bottom sheets/diálogos (≈65 KB, 129 inline styles)
  components/
    ui.jsx            ★ controles propios: NumberField, TextField, TextArea, SearchField, Switch,
                        Segmented, Stepper, Slider, Check, Section, Row, SelectRow, Button
    Icon.jsx          set de iconos SVG (ver lista abajo)
    TabBar.jsx        tab bar inferior con botón central "Start" (solo mobile; en ≥1000px devuelve null)
    Modals.jsx        render de sheets (bottom sheet con swipe-to-dismiss, o 'center')
    RestTimer.jsx     timer flotante en mobile, acoplado al sidebar en desktop (descanso / serie cronometrada)
    AssignSheet.jsx   sheet de dos pasos para asignar rutinas a alumnos
    WeekMini.jsx      mini-tira de 7 días para adherencia semanal
    AthleteSidebar.jsx sidebar fija del atleta (≥1000px, mismas clases `.cside*` que el coach); `useStartWorkout.js`: acción Start/Resume compartida con TabBar
    SessionRail.jsx   rail derecha del Workout en desktop (reloj, progreso, esquema con salto, timer inline, terminar/descartar); `Elapsed.jsx`: reloj de la sesión
    RoutineSummary.jsx detalle de rutina (solo lectura) en el Plan desktop; `RoutineMuscles.jsx`: card "qué trabaja esta sesión" (editor y resumen); `AdjustSheet.jsx`: "Request a change" de rutinas del coach
    CoachSidebar.jsx  sidebar fija del coach (≥1000px); StudentList / StudentDetail / AssignPanel / RoutinePanel: piezas del panel coach desktop
    LineChart, Heatmap, BodyMap, Media (gif/img de ejercicios), ProgressViews, InvitesCard, BlockPreview, Toast
  views/              una por ruta (ver §6)
  store/useStore.js   estado persistido del usuario (S), sync con API, localStorage
  store/useUI.js      estado efímero: sheets abiertos, toast, timers
  lib/
    lógica pura + tests (progression, onerm, history, effort, blocks, i18n, format…)
    settingsPanes.js  categorías de Ajustes en desktop: `settingsCats`, `resolveCat`, `settingsCatPath` (+ test)
    statsPanes.js     helpers puros de Stats/History desktop: `filterByQuery` (búsqueda sin acentos) y `pickWorkout` (+ test)
    athleteShell.js   items del sidebar del atleta, tab activa por ruta, cuándo se muestra el shell, rutas del Plan (`planRoutinePath`, `planRoutineEditPath`) y clave por sección del frame de contenido (`athleteSectionKey`) (+ test)
    sessionOutline.js esquema de la sesión activa para el rail del Workout: superset = una fila, secciones, estado por ejercicio (+ test)
    coachShell.js     lógica de tabs según rol, orden de lista, criterios de atención
  locales/*.js        traducciones UI (la key es el string en inglés)
  instr/*.js, names/  instrucciones y nombres de ejercicios por idioma (lazy-load, enormes: no abrir)
api/                  backend
docs/superpowers/     specs y planes de features (coach mode, blocks, routine sections)
website/              landing estática (HTML/CSS propios, separada de la app)
```

**No leer ni editar a mano** (son datos generados, 0.5–1.5 MB c/u): `lib/exercises-data.js`,
`lib/body-paths.js`, `instr/*.js`, `names/*.js`.

---

## 5. Sistema de diseño actual (fuente de verdad: `frontend/src/index.css`)

### 5.1 Principios (del header de `index.css` — respetarlos o reemplazarlos explícitamente)

1. **Una escala tipográfica, mayormente peso regular.** 600 para títulos, 400 para contenido; el tamaño hace la jerarquía.
2. **Rampa de superficies neutra.** Grises casi neutros separados por pocos puntos. El color se gasta solo en el acento y en estados.
3. **Hairlines, no bordes.** Separadores de 0.5px, insetados después del riel de iconos.
4. **Movimiento que confirma, no que decora.** Press = scale ~2%, transiciones 140–220ms ease-out. Nada rebota.

Estética de referencia: **iOS nativo (Human Interface Guidelines)** — inset grouped lists, large titles,
paleta de colores del sistema de Apple, SF Pro.

### 5.2 Tokens (`:root`)

**Superficies** (dark es default; light en `:root[data-theme="light"]`)

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--bg` | `#000000` | `#f2f2f7` | fondo de página |
| `--bg-el` | `#0e0e10` | `#f7f7fa` | sheets, barras |
| `--surface` | `#1c1c1e` | `#ffffff` | cards, listas agrupadas |
| `--surface-2` | `#2c2c2e` | `#ececef` | pressed, anidado, botón default |
| `--surface-3` | `#3a3a3c` | `#e3e3e8` | tracks de controles, switch off |

**Texto**: `--label` (100%), `--label-2` (60%), `--label-3` (~30%), `--label-4` (~17%).
**Líneas**: `--sep`, `--sep-op` (sobre blur), `--hair: .5px`.

**Paleta del sistema** (valores iOS dark / light): `--blue --green --red --orange --yellow --teal --indigo --pink --purple --mint --brown --grey`.
Semántica en uso: naranja = workout en curso / racha; amarillo = objetivo de peso; rojo = peligro; verde/acento = progreso.

**Acento** (por usuario, sincronizado; `<html data-accent="…">`):
`lime` (default → green), `sky`, `orange`, `violet`, `pink`, `red`, `teal`, `gold`.
Derivados: `--acc`, `--acc-2` (pressed), `--on-acc` (texto sobre acento, elegido por **contraste medido**, no por gusto), `--acc-soft` (16%), `--acc-line` (38%).
Los nombres de acento se validan contra `ACCENTS` en `lib/format.js`.

**Geometría**: `--r-sm 8px`, `--r 12px`, `--r-card 14px`, `--r-lg 16px`, `--r-xl 22px`, `--pad 16px`, `--icon-stroke 1.7`.

**Spacing y anchos (desktop)**: `--sp-1…--sp-8` (4/8/12/16/20/24/32/40px) para márgenes y gaps nuevos; `--page-w` 720px (columna de lectura) y `--wide-w` 1200px (dashboards).
**Motion**: `--ease cubic-bezier(.32,.72,0,1)`, `--fast 140ms`, `--med 220ms`. `prefers-reduced-motion` apaga todo.
**Safe areas**: `--sat`, `--sab` (env insets).

### 5.3 Tipografía

Fuente del sistema: `-apple-system, 'SF Pro Text', 'Segoe UI', Roboto, system-ui`. Base 17px, `tabular-nums` global.

| Clase | Tamaño / peso |
|---|---|
| `.t-large` / `.hdr h1` | 34 / 700 |
| `.t-title` | 28 / 700 |
| `.t-title2` | 22 / 700 |
| `.t-head` | 17 / 600 |
| `.t-body` | 17 / 400 |
| `.t-callout` | 16 / 400 |
| `.t-sub` | 15 / 400 |
| `.t-foot`, `.small` | 13 / 400 |
| `.t-cap` | 12 / 400 |

Utilidades: `.muted` (label-2), `.dim` (label-3), `.accent`, `.cap1` (solo primera letra en mayúscula — los nombres de ejercicios llegan en minúscula), `.nocap`.

### 5.4 Componentes / clases

| Patrón | Clases / componente | Notas |
|---|---|---|
| Header de pantalla | `.hdr` > `h1` + `.sub`, `.iconbtn` a la derecha (variante `.iconbtn.sm`, 30px) | large title estilo iOS |
| Card | `.card`, `.card h2` (label de sección 13px), `.card .big` (número 30/600; variante `.big.sm`, 22px) | |
| Lista agrupada | `<Section>` + `<Row>` → `.sect`, `.sect-t`, `.sect-b`, `.sect-f`, `.lrow`, `.lrow-i` (ícono en cuadrado de color, `--tint`), `.lrow-t/-s/-v`, chevron/check | **primitivo estructural principal** (Settings, pickers) |
| Lista de items | `.list` > `.item` (+ `.thumb`, `.tt`, `.ss`, `.chev`) | ejercicios, rutinas |
| Botones | `<Button variant size icon>` → `.btn` + `primary` / `tinted` / `danger` / `ghost` / `plain`, tamaños `sm` / `xs` | `.btn` es full-width por defecto |
| Tags / chips | `.tag`, `.tag.acc`, `.chips` (scroll horizontal) > `.chip`, `.chip.on` | |
| Inputs | `.field`, `.searchf`, `<NumberField>` (acepta coma decimal), `<Stepper>` (`.stp`), `<Slider>` (`.sld`), `<Switch>` (`.sw`), `<Segmented>` (`.seg`, con indicador deslizante), `<Check>` (`.chk`) | **todo control nativo está reemplazado** a propósito |
| Tab bar | `#tabbar`: Home · Plan · **Start** (círculo acento, elevado) · Stats · Exercises | blur translúcido; en desktop flota como píldora de 520px |
| Sheets | `.sheet` (bottom, swipe-down), `.center` (diálogo), `.mback` backdrop | se abren con `useUI().openSheet(render, {kind})` |
| Timer | `#timer`, `#timer.rest` (2 filas), `#timer.working` (borde acento) | flota sobre el tab bar |
| Workout | `.setrow`, `.sethead`, `.stp.w/.r/.eff`, `.setgo`, `.progline`, `.exmedia`, `.wprog`; desktop: `.wdesk` > `.wmain` + `.wrail` (`.wout`, `.wout-i`), `.exblock`/`.exbody`, `.timer-inline`, `.wchoose` | la pantalla más crítica |
| Paneles lista + detalle (atleta) | `.pane` > `.pane-list` (+ `.item.sel`) + `.pane-detail`, `.rsum`, `.redit` > `.rmain` + `.raside`; Stats: `.xprog` > `.xprog-list` (+ `.xprog-opt.sel`) + `.xprog-main` | Plan y Program en desktop |
| Home | `.hdesk` > `.hmain` + `.haside` (dashboard desktop), `.today-row` con `.lrow-i.live/.plan/.rest` y `.tag.warn` | primera pantalla |
| Semana | `.week` > `.wday` (+ `.dot.plan/.ovr/.done`, `.today`), `.today-row` | Home |
| Datos | `.chart`, `.ctip`, `.hm-*` (heatmap), `.bodymap`/`.bm-*`, `.tiles`/`.tile`, `.mrow`, `.pr` | |
| Coach | `.wk-mini` (mini-tira 7 días), `.attn` (banner de atención), `.feed-day` (encabezado de día en actividad), `.item.off` (alumno ya tiene rutina, inert) | |
| Otros | `.empty`, `#toast`, `.swatches` (selector de acento), `.glyph-grid` (íconos de rutina), `.cal-*`, `.ss-*` (supersets), `.efftbl`, `.tag.warn` (tag naranja de aviso) | |

**Iconos disponibles** (`<Icon name="…" />`, 24×24, stroke, heredan color y tamaño vía `1em`):
house calendar chart magnifier gear dumbbell barbell figureRun figureStrength scale flame timer clock trophy medal target star starFill crown bolt shield heart rocket sparkles lightbulb arm abs legs pullup kettlebell plate machine bike swim boxing stretch plus minus check checkCircle xmark pencil trash link play pause reset bell bellSlash chevronRight/Left/Down/Up arrowUp/Down expand minimize person personCircle clipboard list folder globe moon sun key lock download upload wrench flag chartLine dot history signOut shuffle info.
Si un diseño necesita un ícono nuevo, se agrega como path SVG en `Icon.jsx` con el mismo estilo (stroke 1.7, round caps).

### 5.5 Layout

- Mobile: `#app` max-width 560px, padding 16px, padding-bottom grande para el tab bar (y más si hay timer: `body.resting`).
- Desktop ≥1000px: `#app` 1080px, `.cols` a 2 columnas, `.list` en grid, `.narrow` = 640px, sheet de 640px. La tab bar es solo mobile: en desktop la reemplaza el sidebar (atleta y coach) y el timer se acopla al pie del sidebar (ver shell del atleta abajo).
- Hit targets ≥44px aunque el control pintado sea más chico.
- Transición entre vistas: `.vfade` (fade + 4px).
- **Shell del atleta (≥1000px)**: `AthleteSidebar` (clases `.cside*` compartidas con el coach) + `.amain-in` (contenido centrado a `--wide-w`); la tab bar es solo mobile. El timer de descanso/serie se acopla al pie del sidebar. Lógica pura en `lib/athleteShell.js`. Spec: `docs/superpowers/specs/2026-10-09-athlete-desktop-design.md`.

---

## 6. Inventario de pantallas (rutas en HashRouter: `#/home`, etc.)

| Ruta | Archivo | Contenido | Prioridad de diseño |
|---|---|---|---|
| `/home` | `views/Home.jsx` | saludo + fecha, CTA de setup, tira semanal + "Hoy", card peso corporal (gráfico + objetivo), racha, etc. Desktop ≥1000px: dashboard 2:1 (semana + Hoy + peso a la izquierda; setup/bienvenida/racha a la derecha; sin engranaje, Ajustes está en el sidebar). | Alta |
| `/workout` | `views/Workout.jsx` | selector de rutina y **sesión en curso**: media del ejercicio, filas de series (peso × reps × esfuerzo), progresión, supersets, timers. Desktop ≥1000px: ejercicio actual (media al lado de las series si hay ancho) + rail de sesión; el selector de rutina va en dos zonas | **Máxima** |
| `/plan` | `views/Plan.jsx` | semana + lista de rutinas. Desktop ≥1000px: lista a la izquierda y resumen de la rutina seleccionada a la derecha (`/plan/r/:id`; sin id, la primera). | Alta |
| `/plan/r/:id` | `views/Plan.jsx` + `components/RoutineSummary.jsx` | resumen de rutina en desktop; en mobile redirige al editor | Media |
| `/plan/r/:id/editar` | `views/RoutineEdit.jsx` | editor de rutina, secciones, supersets, preview de músculos. Desktop: dos columnas (ejercicios \| progresión, cobertura, borrar). | Media |
| `/stats` | `views/Stats.jsx` | heatmap anual, body map, gráficos, PRs, 1RM, esfuerzo. Desktop ≥1000px: tiles → heatmap → Equilibrio muscular \| Esfuerzo → Peso \| Recientes → Progreso por ejercicio a ancho completo (lista buscable `.xprog` + gráfico). Mobile igual que antes (`SelectRow`) | Alta |
| `/history`, `/history/:id` | `views/History.jsx` + `components/WorkoutDetail.jsx` | lista de workouts. Desktop ≥1000px: lista + panel de detalle del workout seleccionado (por defecto el último); en mobile `/history/:id` redirige y la fila abre el sheet. `openWorkout(w)` (sheets.jsx) decide panel vs sheet | Baja |
| `/library`, `/library/:id` | `views/Library.jsx` + `ExerciseDetail` (exportado de `sheets.jsx`) | 1.324 ejercicios, búsqueda, filtros por equipamiento. Desktop ≥1000px: búsqueda + chips + lista a la izquierda y detalle del ejercicio a la derecha (`.exd` en dos columnas si el panel tiene ancho); en mobile `/library/:id` redirige y la fila abre el sheet. `openExercise(ex)` decide panel vs sheet; el botón Detalles del Workout sigue abriendo el sheet | Media |
| `/settings`, `/settings/:cat` | `views/Settings.jsx` | listas agrupadas: tema, acento, idioma, unidades, esfuerzo, import/export… Desktop ≥1000px: dos paneles — categorías (Cuenta, Entrenamiento, General, Notificaciones si hay usuario o app móvil, Datos) a la izquierda y sus secciones a la derecha (`.pane-cats`); en mobile una sola columna como antes y `/settings/:cat` redirige. Categorías en `lib/settingsPanes.js` | Media |
| `/profile` | `views/Profile.jsx` | perfil de entrenamiento (objetivo, nivel, equipo, limitaciones). Desktop: formulario centrado a `--page-w` (`.narrow.page`) | Baja |
| `/program` | `views/Program.jsx` | bloques de entrenamiento (draft / activo / terminado). Desktop: lista de bloques + preview del bloque seleccionado (por defecto el activo). | Media |
| `/coach` | `views/Coach.jsx` | home del coach: lista de alumnos con adherencia semanal + badge de atención (copy en español literal) | Media |
| `/coach/rutinas` | `views/CoachRoutines.jsx` | lista de rutinas plantilla del coach, asignar desde la fila | Media |
| `/coach/actividad` | `views/CoachActivity.jsx` | feed de actividad agrupado por día (workouts completados, cambios solicitados) | Media |
| `/coach/alumno/:id` | `views/Coach.jsx` + `components/StudentDetail.jsx` | detalle de alumno: rutinas asignadas, progreso (tiles + gráfico peso + historial) | Media |
| `/coach/rutinas/:id` | `views/CoachRoutines.jsx` + `components/RoutinePanel.jsx` | resumen de rutina + asignación inline (desktop); en mobile redirige al editor | Media |
| `/coach/rutinas/:id/editar` | `views/RoutineEdit.jsx` | editor de rutina dentro del shell coach | Media |
| `/admin` | `views/Admin.jsx` | dashboard operador (solo inglés, a propósito) | Baja |
| — | `views/Login.jsx` | passkey / crear perfil / invitado. Desktop: tarjeta centrada de 440px (`.login`) | Media |

> **Coach desktop (≥1000px):** `views/CoachShell.jsx` es la ruta layout de `/coach/*`: dueño único de `listStudents()` + polling 15 s (comparte `{students, reload}` por `useCoachData`) y, en desktop, renderiza `CoachSidebar` + master–detalle (`.cshell/.cside/.cgrid/.cmaster/.cdetail` en `index.css`). Mobile sin cambios. Spec: `docs/superpowers/specs/2026-10-07-coach-desktop-panel-design.md`.

Sheets principales (`sheets.jsx`): registrar peso, objetivo, detalle de ejercicio, picker de ejercicios,
config de ejercicio en rutina, reprogramar día, calendario, detalle de workout, workout completado (center), confirmaciones, import/export de plan.

---

## 7. Reglas para trabajar el rediseño

### Hacer
- **Todo cambio visual pasa por tokens y clases de `index.css`.** Si un diseño introduce un color, radio, sombra o tamaño nuevo, primero se agrega como token y después se usa.
- Mantener **dark y light** para cada cambio, y verificar los **8 acentos** (el contraste de `--on-acc` ya está calculado: no romperlo).
- Mobile first (375–430px), después chequear desktop ≥1000px.
- Diseñar pensando en textos largos: la UI está en 12 idiomas (ruso, hindi y alemán son ~30% más largos que inglés). Nada de anchos fijos para labels.
- Reutilizar los controles de `components/ui.jsx`. Si hace falta uno nuevo, va ahí, controlado por `(value, onChange)`.
- Todo string visible pasa por `t('English source string')`. Si agregás keys nuevas, agregalas a **todos** los `locales/*.js` y corré `check-locales.mjs`. (Excepciones: Admin en inglés, Coach en español literal.)
- Respetar `prefers-reduced-motion`, `:focus-visible`, `aria-label` en botones de solo ícono.
- Después de tocar pantallas: probar el flujo completo de workout en el navegador (iniciar → loguear series → timer → terminar).

### No hacer
- **No agregar dependencias** (ni Tailwind, ni shadcn, ni librerías de iconos/charts/animación). Es un principio del proyecto.
- No volver a controles nativos (`<select>`, checkbox, range) — se reemplazaron a propósito.
- No usar emoji como íconos.
- No tocar la lógica de `lib/` ni `store/` para cambios puramente visuales. Si un rediseño requiere datos nuevos, separarlo en otro cambio con test.
- No abrir los archivos de datos gigantes (`exercises-data.js`, `body-paths.js`, `instr/`, `names/`).

### Deuda de diseño conocida (buenos puntos de partida)
- **~340 `style={{…}}` inline** que saltean el sistema: `sheets.jsx` (129), `Home.jsx` (31), `Stats.jsx` (30), `RoutineEdit.jsx` (22), `Workout.jsx` (21), `Settings.jsx` (16), `Login.jsx` (15). Muchos son márgenes/gaps ad-hoc y overrides de tamaño (p. ej. `.iconbtn` a 30px, `.big` a 22px) → candidatos a clases/utilidades o variantes.
- Colores de estado armados inline → existe `.tag.warn` (Home ya lo usa para "Resume"); revisar el resto de pantallas. Ya existen también `.iconbtn.sm` y `.big.sm` (Home migrado).
- Márgenes 4/6/8/10/12/14/16/18/22 sueltos (ya existe la escala `--sp-*`; falta migrar los inline existentes pantalla por pantalla).
- `h2` de card se sobreescribe inline seguido (`margin:0`, `marginTop:0`).
- `index.html` tiene `theme-color #0c0e12` y el manifest también, pero el `--bg` dark es `#000` (App.jsx lo corrige en runtime).
- Sin fuente propia: depende de SF Pro/Segoe/Roboto según plataforma → la app se ve distinta en Android/Windows.

---

## 8. Flujo con Claude Design

1. **Contexto para Claude Design**: pasarle este archivo (§5 y §6 sobre todo) + `frontend/src/index.css` + capturas de `assets/screenshots/` (home, workout, stats) o capturas nuevas de la app corriendo en `:5173`.
2. **Definir el design system primero** (tokens: color, tipografía, spacing, radios, sombras, motion) antes de rediseñar pantallas. Si cambia algo del §5.1, documentarlo acá.
3. **Rediseñar por prioridad**: Workout → Home → Stats → Plan → resto. Cada pantalla en mobile dark, mobile light y desktop.
4. **Handoff a código**: traducir el diseño a
   - tokens nuevos/modificados en `:root` y `:root[data-theme="light"]`,
   - clases en `index.css` (una sección comentada por componente, como está hoy),
   - cambios de markup en `views/` / `components/` usando esas clases (no inline styles).
5. **Verificar**: `npm test`, `check-locales.mjs`, y recorrido visual de las pantallas tocadas en ambos temas y un par de acentos.

Cuando se decida algo de diseño (nueva paleta, nueva fuente, nuevo componente), actualizar este archivo en §5 para que siga siendo la fuente de verdad.
