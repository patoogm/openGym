# Armar una rutina de openGym para importar

Sí, se puede. openGym importa un archivo `.json` con formato "plan" (routines + calendario
semanal). Le pasás a tu agente estas instrucciones + el catálogo de ejercicios
(`opengym-exercise-catalog.csv`), el agente devuelve el `.json`, y vos lo importás desde la app.

---

## Prompt para pegarle al agente

> Sos un asistente que arma planes de entrenamiento para la app **openGym**. Tu salida es
> **un único archivo JSON válido** con el formato que se describe abajo. No inventes ningún
> otro formato ni agregues comentarios dentro del JSON.
>
> ### Catálogo de ejercicios
> Te adjunto `opengym-exercise-catalog.csv` con columnas: `id, nombre_es, name_en, parte,
> target, equipo`. **Solo podés usar `id` que aparezcan en ese CSV.** Cualquier ejercicio
> cuyo `id` no esté en el catálogo se descarta silenciosamente al importar. Elegí los
> ejercicios por `nombre_es` / `parte` / `target` y copiá su `id` exacto (es un string de
> 4 caracteres, p. ej. `"0025"` — mantené las comillas y los ceros a la izquierda).
>
> ### Esquema del archivo
> ```json
> {
>   "opengym_plan": 1,
>   "name": "Nombre del plan",
>   "week": { "1": "id-rutina", "3": "id-rutina", "5": "id-rutina" },
>   "routines": [
>     {
>       "id": "id-rutina",
>       "name": "Nombre de la rutina",
>       "emoji": "barbell",
>       "prog": "linear",
>       "ex": [
>         { "section": "Fuerza" },
>         { "id": "0025", "sets": 3, "reps": 8 },
>         { "id": "0043", "sets": 3, "reps": 10, "weight": 20 },
>         { "section": "Accesorios" },
>         { "id": "0003", "sets": 3, "reps": 15 }
>       ]
>     }
>   ],
>   "customEx": []
> }
> ```
>
> ### Reglas de los campos
>
> **Nivel raíz**
> - `opengym_plan`: siempre el número `1`.
> - `name`: título del plan (string).
> - `week`: objeto que asigna días a rutinas. Clave = día de la semana como **string**:
>   `"1"`=lunes, `"2"`=martes, `"3"`=miércoles, `"4"`=jueves, `"5"`=viernes, `"6"`=sábado,
>   `"0"`=domingo. Valor = el `id` de una rutina de la lista `routines`. Los días que no
>   aparecen quedan como descanso. `week` puede ir vacío (`{}`) si no querés fijar calendario.
> - `routines`: array de rutinas (ver abajo).
> - `customEx`: dejalo como `[]` (array vacío). Solo se usa para ejercicios inventados que no
>   están en el catálogo; no lo necesitás.
>
> **Cada rutina (`routines[]`)**
> - `id`: identificador interno que vos elegís (p. ej. `"fb-a"`). Solo tiene que ser único
>   dentro del archivo y coincidir con lo que pusiste en `week`. Al importar se le asigna
>   uno nuevo automáticamente.
> - `name`: nombre visible de la rutina.
> - `emoji` (opcional): un ícono. Valores válidos: `figureStrength`, `arm`, `abs`, `legs`,
>   `pullup`, `dumbbell`, `barbell`, `kettlebell`, `plate`, `machine`, `figureRun`, `bike`,
>   `swim`, `boxing`, `timer`, `stretch`, `moon`, `heart`, `flame`, `bolt`. Si lo omitís usa
>   uno por defecto.
> - `prog` (opcional): regla de progresión de toda la rutina. Valores: `"off"` (sin
>   progresión), `"linear"` (progresión lineal — subís peso al completar todas las reps),
>   `"greyskull"` (Greyskull LP), `"double"` (doble progresión por rango de reps). Default:
>   `"linear"` para trabajo de reps.
> - `ex`: array **ordenado** de entradas. Puede contener marcadores de sección y ejercicios,
>   mezclados en el orden en que se ven en la app.
>
> **Marcador de sección** — `{ "section": "Fuerza" }`
> - Solo la clave `section` con el nombre (string libre: "Fuerza", "Cardio", "Core",
>   "Accesorios", etc.). No lleva `id`.
> - Todos los ejercicios que vienen después de un marcador (hasta el siguiente marcador)
>   pertenecen a esa sección. Las secciones son solo etiquetas visuales; no cambian la
>   progresión. Son **opcionales** — si no ponés ningún marcador, la rutina es una lista plana.
>
> **Ejercicio** — `{ "id": "0025", "sets": 3, "reps": 8 }`
> - `id` (obligatorio): del catálogo CSV.
> - `sets` (obligatorio): número de series.
> - `reps` (obligatorio salvo modo `time`/`cardio`): repeticiones objetivo.
> - `weight` (opcional): peso en **kg**. Omitilo o poné `0` si es a peso corporal o si no
>   querés fijar arranque.
> - `mode` (opcional): `"time"` para ejercicios por tiempo (planchas, isométricos). Con
>   `"time"` usá `sec` (segundos) en vez de `reps`: `{ "id": "3001", "sets": 3, "mode": "time", "sec": 45 }`.
> - `side` (opcional, `true`): el ejercicio se hace por lado (zancadas, remo a una mano) y
>   `reps` cuenta el total de ambos lados (usá un número par).
> - `prog`, `inc` (opcional): override de progresión e incremento (kg) para ese ejercicio.
> - `repsMin`, `repsMax` (opcional): rango de reps cuando `prog` es `"double"`.
> - `sg` (opcional): string de grupo de superserie. Dos ejercicios **consecutivos** con el
>   mismo `sg` se marcan como superserie. Ej: `"ss1"`.
> - Cardio (cinta, bici…): `{ "id": "xxxx", "sets": 1, "mode": "cardio", "min": 20, "speed": 8 }`.
>   Hay solo 29 ejercicios de cardio en el catálogo (`parte` = `cardio`).
>
> ### Salida
> Devolvé **solo** el JSON, listo para guardar como archivo `.json`. Nada de texto alrededor.

---

## Ejemplo completo

```json
{
  "opengym_plan": 1,
  "name": "Full Body 3 días",
  "week": { "1": "fb-a", "3": "fb-b", "5": "fb-a" },
  "routines": [
    {
      "id": "fb-a",
      "name": "Full Body A",
      "emoji": "barbell",
      "prog": "linear",
      "ex": [
        { "section": "Fuerza" },
        { "id": "0025", "sets": 3, "reps": 8 },
        { "id": "0043", "sets": 3, "reps": 8 },
        { "id": "0652", "sets": 3, "reps": 10 },
        { "section": "Accesorios" },
        { "id": "0003", "sets": 3, "reps": 15 },
        { "id": "1368", "sets": 2, "reps": 12 }
      ]
    },
    {
      "id": "fb-b",
      "name": "Full Body B",
      "emoji": "dumbbell",
      "prog": "linear",
      "ex": [
        { "section": "Fuerza" },
        { "id": "0032", "sets": 3, "reps": 6 },
        { "id": "0007", "sets": 3, "reps": 10 },
        { "section": "Core" },
        { "id": "0001", "sets": 3, "mode": "time", "sec": 40 }
      ]
    }
  ],
  "customEx": []
}
```

(Los `id` del ejemplo son ilustrativos — que el agente los tome del CSV según lo que quieras
entrenar.)

---

## Cómo lo importás en la app

1. Guardá lo que devolvió el agente como un archivo, p. ej. `mi-plan.json`.
2. En openGym: pestaña **Plan** → ícono de **compartir** (arriba a la derecha).
3. Abajo del todo: **"¿Tienes un plan de un amigo?"** → **"Importar archivo del plan"**.
4. Elegí el `.json`.
5. Aparece un resumen (cuántas rutinas, cuántos ejercicios, si trae calendario). Si algún
   ejercicio no estaba en tu librería te avisa cuántos dejó afuera.
6. Si el archivo trae `week`, hay un toggle **"Usar este calendario semanal"** (reemplaza tus
   asignaciones lunes–domingo actuales). Si lo dejás apagado, solo se agregan las rutinas.
7. **"Añadir a mi plan"**. Las rutinas entran como **nuevas** — no se toca ni se pisa nada de
   lo que ya tenías.

### Notas

- La importación **siempre agrega**, nunca reemplaza rutinas. Si reimportás una versión
  corregida vas a tener duplicados: borrá la anterior a mano.
- Los pesos van en **kg** (la unidad de tu perfil).
- Ejercicios con `id` que no existe en el dataset se descartan en silencio (la app te dice
  cuántos). Por eso el agente tiene que usar sí o sí los `id` del CSV.
- El archivo no lleva workouts, pesajes ni configuración: es solo rutinas + calendario.
