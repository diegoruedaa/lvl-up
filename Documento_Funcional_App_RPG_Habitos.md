# Documento funcional de la aplicación RPG de hábitos

## 0. Concepto general

La aplicación transforma los hábitos, las tareas y los objetivos de la vida real en una aventura RPG con estética pixel art.

El usuario controla un personaje que progresa al completar misiones reales. Las misiones conceden experiencia al nivel general y a diferentes atributos personales. Cuando una misión obligatoria no se cumple, el personaje pierde vida.

La vida no se recupera automáticamente. Para recuperarla o protegerse, el usuario tendrá que utilizar objetos obtenidos mediante el progreso o comprados en el mercado.

Cuando la vida llega a 0, la aventura termina y todo el progreso se reinicia.

La filosofía principal de la aplicación es:

- Las misiones creadas representan compromisos reales.
- Completar misiones permite progresar.
- Fallar misiones tiene consecuencias.
- La vida y los objetos deben administrarse con cuidado.
- Las monedas y los objetos deben ser recursos escasos.
- Comprar o utilizar un objeto debe ser una decisión importante.
- La partida ideal puede continuar indefinidamente.
- Llegar al nivel 100 representa completar el progreso general, pero no finaliza la aventura.
- La muerte representa un reinicio total por no haber mantenido la constancia.
- Ningún logro debe quedar bloqueado permanentemente por haber cometido un error anteriormente.
- Los sistemas deben ser fáciles de entender, aunque permitan estrategias diferentes.

---

# 1. Personaje

## 1.1. Diseño

El jugador estará representado por un personaje genérico con estética pixel art.

En la primera versión:

- No habrá personalización compleja.
- No se podrá modificar la cara, el pelo o el cuerpo.
- No habrá armas visibles.
- No habrá armaduras visibles.
- No habrá equipamiento visual.
- No habrá animaciones complejas.
- El personaje servirá principalmente como representación del progreso del usuario.

La prioridad inicial serán las mecánicas del juego y no la personalización estética.

## 1.2. Información asociada al personaje

En la zona principal del personaje se podrá mostrar:

- Nivel general.
- Barra de experiencia.
- Vida actual.
- Rango actual.
- Monedas disponibles.
- Acceso a los atributos.
- Acceso a la mochila.
- Acceso al mercado.
- Acceso a los logros.
- Acceso secundario al historial y las estadísticas.

---

# 2. Nivel general y experiencia

## 2.1. Nivel general

- La aventura comienza en el nivel 1.
- El nivel general máximo será 100.
- El nivel general representa el progreso completo del personaje.
- Llegar al nivel 100 concede el rango Inmortal.
- Alcanzar el nivel 100 no termina la aventura.
- Después de alcanzar el nivel 100, el usuario puede continuar completando misiones, atributos y logros.

## 2.2. Funcionamiento después del nivel 100

Al alcanzar el nivel 100:

- El nivel permanece en 100.
- La barra de experiencia general aparece completa.
- El personaje deja de acumular XP general.
- La XP general adicional se pierde.
- Los atributos que no hayan llegado al máximo pueden seguir obteniendo XP.
- Las misiones siguen funcionando con normalidad.
- El usuario puede seguir obteniendo monedas mediante Bosses.
- Los logros pendientes continúan disponibles.
- La vida y la muerte siguen funcionando de la misma manera.
- Morir después de llegar al nivel 100 también reinicia todo.

No habrá niveles superiores a 100 ni sistema de prestigio en la primera versión.

---

## 2.3. Experiencia fija según dificultad

Cada dificultad concederá una cantidad fija de XP.

| Dificultad | Experiencia |
|---|---:|
| Trivial | 5 XP |
| Fácil | 15 XP |
| Media | 30 XP |
| Difícil | 60 XP |
| Épica | 125 XP |
| Boss menor | 200 XP |
| Boss importante | 350 XP |
| Boss legendario | 500 XP |

Todos los valores terminan en 0 o 5 para que el sistema resulte visualmente más limpio y fácil de entender.

## 2.4. Uso de las dificultades

### Trivial

Para acciones rápidas, sencillas o cotidianas.

Ejemplos:

- Hacer la cama.
- Tomar una vitamina.
- Preparar la mochila.
- Beber agua.
- Ordenar algo pequeño.

### Fácil

Para acciones que requieren cierto esfuerzo, pero son sencillas de completar.

Ejemplos:

- Leer durante un periodo corto.
- Responder correos pendientes.
- Realizar una gestión sencilla.
- Preparar la ropa del día siguiente.

### Media

Para tareas que requieren concentración, esfuerzo o una cantidad moderada de tiempo.

Ejemplos:

- Entrenar.
- Estudiar una hora.
- Realizar una sesión completa de trabajo.
- Limpiar una habitación.
- Terminar una parte de un proyecto.

### Difícil

Para tareas exigentes que requieren bastante tiempo, esfuerzo o disciplina.

Ejemplos:

- Completar un entrenamiento especialmente duro.
- Estudiar varias horas.
- Terminar una entrega importante.
- Realizar una tarea que se lleva posponiendo mucho tiempo.

### Épica

Para objetivos muy exigentes, pero cuyo cumplimiento depende directamente del usuario.

Ejemplos:

- Terminar un proyecto grande.
- Completar una semana especialmente exigente.
- Realizar una actividad personal muy difícil.
- Finalizar un trabajo importante antes de su fecha límite.

### Boss

Para resultados importantes que no dependen completamente de completar una acción directa.

Ejemplos:

- Aprobar un examen.
- Superar una entrevista.
- Conseguir una plaza.
- Ganar una competición.
- Obtener una admisión.
- Alcanzar un objetivo decisivo.

---

## 2.5. Reglas de experiencia

- La experiencia general no se pierde durante una aventura activa.
- La experiencia solo se pierde al morir.
- Las misiones triviales siempre conceden XP.
- Es posible llegar al nivel 100 completando únicamente misiones triviales, pero sería extremadamente lento.
- No será obligatorio realizar misiones difíciles para progresar.
- Las misiones difíciles simplemente aceleran la progresión.
- Una rutina concede XP una sola vez por cada ocurrencia programada.
- Una misión no puede completarse varias veces dentro de la misma ocurrencia.
- No se podrán crear duplicados equivalentes para obtener XP artificialmente.
- Completar una misión concede XP general y XP de atributos.
- Fallar una misión no resta XP acumulada.
- Utilizar una Cuerda Huida no concede XP.
- Perder un Boss no concede XP.
- La XP sobrante al alcanzar un nivel máximo se pierde.

---

## 2.6. Curva definitiva del nivel general

La XP necesaria para pasar del nivel actual al siguiente se calcula así:

> **XP necesaria = 50 + 10 × nivel actual**

Ejemplos:

| Subida | XP necesaria |
|---|---:|
| Nivel 1 → 2 | 60 XP |
| Nivel 2 → 3 | 70 XP |
| Nivel 5 → 6 | 100 XP |
| Nivel 10 → 11 | 150 XP |
| Nivel 20 → 21 | 250 XP |
| Nivel 50 → 51 | 550 XP |
| Nivel 75 → 76 | 800 XP |
| Nivel 99 → 100 | 1.040 XP |

## 2.7. XP total acumulada

| Nivel alcanzado | XP acumulada aproximada |
|---:|---:|
| 5 | 300 XP |
| 10 | 900 XP |
| 20 | 2.850 XP |
| 35 | 7.650 XP |
| 50 | 14.700 XP |
| 70 | 27.600 XP |
| 90 | 44.500 XP |
| 100 | 54.450 XP |

## 2.8. Duración estimada de la progresión

Una jornada normal podría producir aproximadamente entre 100 y 150 XP.

Ejemplo:

- 3 misiones triviales: 15 XP.
- 3 misiones fáciles: 45 XP.
- 2 misiones medias: 60 XP.

Total:

> 120 XP diarios.

Estimación según actividad:

| Actividad | XP diaria aproximada |
|---|---:|
| Ligera | 60–80 XP |
| Normal | 100–150 XP |
| Intensa | 180–250 XP |

Con una media de 125–150 XP diarios, alcanzar el nivel 100 podría llevar aproximadamente entre 12 y 15 meses.

Los Bosses acelerarían ligeramente este progreso, pero no deberían reducirlo de forma exagerada.

---

## 2.9. Rutinas y protección frente a abusos

El usuario podrá crear bastantes rutinas. Esto no debe impedirse, porque registrar muchas acciones puede ser útil.

El problema aparecería si numerosas acciones muy pequeñas concedieran demasiada XP.

Ejemplo:

- Hacer la cama.
- Beber agua.
- Lavarse los dientes.
- Preparar la mochila.
- Tomar vitaminas.
- Ordenar el escritorio.

Estas acciones pueden existir, pero deberían clasificarse como triviales y conceder 5 XP cada una.

Diez rutinas triviales darían:

> 10 × 5 XP = 50 XP diarios.

Esto permite progresar, pero lentamente.

Las protecciones frente a abusos serán:

- Las tareas pequeñas dan poca XP.
- Cada ocurrencia recompensa una sola vez.
- Se bloquean duplicados equivalentes.
- La XP necesaria aumenta con el nivel.
- No se permite pulsar repetidamente una misma rutina.
- No existe un límite diario de XP.
- No se reduce la recompensa por haber completado muchas misiones.

No habrá un límite diario porque penalizaría los días realmente productivos.

---

# 3. Atributos

## 3.1. Atributos definidos

El personaje tendrá seis atributos:

1. Vitalidad.
2. Intelecto.
3. Disciplina.
4. Relaciones.
5. Aventura.
6. Fortuna.

---

## 3.2. Vitalidad

Representa:

- Salud.
- Deporte.
- Entrenamiento.
- Actividad física.
- Descanso.
- Alimentación.
- Cuidado corporal.
- Recuperación.

Ejemplos de misiones:

- Entrenar en el gimnasio.
- Realizar movilidad.
- Dormir las horas previstas.
- Preparar una comida saludable.
- Acudir a una revisión médica.

---

## 3.3. Intelecto

Representa:

- Estudio.
- Lectura.
- Aprendizaje.
- Trabajo intelectual.
- Investigación.
- Desarrollo de habilidades.
- Formación.

Ejemplos:

- Estudiar una asignatura.
- Leer un libro.
- Realizar un curso.
- Programar.
- Investigar un tema.
- Preparar una presentación.

---

## 3.4. Disciplina

Representa:

- Organización.
- Responsabilidad.
- Constancia.
- Cumplimiento de compromisos.
- Control de hábitos.
- Gestión del tiempo.
- Realización de tareas necesarias.

Ejemplos:

- Organizar la semana.
- Limpiar la habitación.
- Completar una gestión administrativa.
- Seguir una rutina establecida.
- Terminar una tarea pendiente.

Disciplina no se asignará automáticamente como atributo secundario de todas las misiones.

---

## 3.5. Relaciones

Representa:

- Familia.
- Amigos.
- Pareja.
- Vida social.
- Comunicación.
- Ayuda a otras personas.
- Participación en grupos.

Ejemplos:

- Llamar a un familiar.
- Quedar con un amigo.
- Ayudar a otra persona.
- Participar en una actividad grupal.
- Mantener una conversación importante.

---

## 3.6. Aventura

Representa:

- Probar cosas nuevas.
- Viajar.
- Explorar.
- Salir de la zona de confort.
- Vivir nuevas experiencias.
- Descubrir lugares.
- Afrontar retos novedosos.

Ejemplos:

- Visitar un lugar nuevo.
- Probar una actividad diferente.
- Hacer un viaje.
- Participar en un evento.
- Enfrentarse a una experiencia desconocida.

---

## 3.7. Fortuna

Representa:

- Finanzas.
- Ahorro.
- Gestión del dinero.
- Oportunidades.
- Planificación económica.
- Recursos personales.
- Decisiones financieras.

Ejemplos:

- Revisar los gastos.
- Ahorrar una cantidad.
- Preparar un presupuesto.
- Cancelar una suscripción innecesaria.
- Realizar una gestión bancaria.

---

## 3.8. Atributos de una misión

Cada misión tendrá:

- Un atributo principal obligatorio.
- Un atributo secundario opcional.

El atributo principal representa la categoría principal de la misión.

El secundario permite reflejar que una misma actividad puede contribuir a otra área.

Ejemplo:

> Entrenamiento de baloncesto  
> Principal: Vitalidad  
> Secundario: Disciplina

---

## 3.9. Reparto de experiencia

Cuando se completa una misión:

- El nivel general recibe el 100 % de la XP.
- El atributo principal recibe el 100 % de la XP.
- El atributo secundario recibe el 25 % de la XP.

La experiencia no se divide. Se registra en paralelo.

Ejemplo:

Una misión media de 30 XP con Vitalidad como atributo principal y Disciplina como atributo secundario concede:

- 30 XP general.
- 30 XP de Vitalidad.
- 7,5 XP de Disciplina.

La aplicación puede guardar decimales internamente, aunque visualmente podrá redondear el progreso.

---

## 3.10. Nivel máximo de los atributos

- Cada atributo comienza en nivel 1.
- El nivel máximo de cada atributo será 50.
- Cada atributo tendrá su propia barra de experiencia.
- Todos los atributos utilizarán la misma curva.
- Maximizar un atributo será difícil, pero posible antes o alrededor del nivel general 100.
- Maximizar los seis atributos será uno de los objetivos más exigentes de la aplicación.

---

## 3.11. Curva definitiva de atributos

La XP necesaria para subir un atributo se calcula así:

> **XP necesaria = 30 + 8 × nivel actual del atributo**

Ejemplos:

| Subida | XP necesaria |
|---|---:|
| Nivel 1 → 2 | 38 XP |
| Nivel 10 → 11 | 110 XP |
| Nivel 20 → 21 | 190 XP |
| Nivel 30 → 31 | 270 XP |
| Nivel 40 → 41 | 350 XP |
| Nivel 49 → 50 | 422 XP |

La XP total necesaria para llevar un atributo desde nivel 1 hasta nivel 50 será:

> **11.270 XP**

Para llevar los seis atributos al máximo serían necesarios 67.620 XP repartidos entre ellos.

La suma puede superar la XP general necesaria para alcanzar nivel 100 porque una misión puede conceder XP a dos atributos simultáneamente.

---

## 3.12. Atributos al máximo

Cuando un atributo llega a nivel 50:

- Deja de acumular XP.
- La XP sobrante se pierde.
- La XP no se transfiere a otro atributo.
- Puede seguir seleccionándose como atributo principal.
- Puede seguir seleccionándose como atributo secundario.
- La XP general de la misión se concede normalmente.
- El otro atributo asociado puede seguir recibiendo XP si no está al máximo.

---

## 3.13. Función de los atributos

En la primera versión, los atributos:

- No aumentan la XP.
- No reducen el daño.
- No mejoran pociones.
- No mejoran escudos.
- No conceden ventajas permanentes.
- Representan visualmente el crecimiento del usuario.
- Desbloquean logros.

En el futuro podrían servir para desbloquear habilidades, contenido o privilegios.

---

# 4. Vida, daño y muerte

## 4.1. Vida

- El personaje tendrá un máximo de 100 HP.
- La vida se mantiene entre días.
- No se recupera automáticamente.
- No existe regeneración diaria.
- No existe restauración semanal.
- No existen reinicios gratuitos.
- La vida solo puede recuperarse mediante objetos.

---

## 4.2. Daño según dificultad

| Dificultad | Daño al fallar |
|---|---:|
| Trivial | −1 HP |
| Fácil | −3 HP |
| Media | −5 HP |
| Difícil | −10 HP |
| Épica | −15 HP |
| Boss | −20 HP |

Los tres tipos de Boss causan el mismo daño al perderse.

---

## 4.3. Misiones obligatorias

Toda misión creada se considera obligatoria.

Cuando una misión vence:

- Si está completada, concede sus recompensas.
- Si no está completada, causa daño.
- Desaparece de la lista activa.
- Pasa al historial.

No existirán:

- Días de descanso automáticos.
- Omisiones gratuitas.
- Pausas.
- Saltos sin consecuencias.
- Reprogramaciones automáticas.

---

## 4.4. Eliminación de misiones

El usuario podrá eliminar una misión antes de que venza sin recibir daño.

Esto existe para situaciones como:

- Haber creado la misión por error.
- Haber escrito mal la fecha.
- Que las circunstancias hayan cambiado.
- Que la misión haya dejado de tener sentido.
- Que haya sucedido algo inesperado.

Al eliminar una misión:

- No se concede XP.
- No se considera completada.
- No causa daño.
- Se registra la eliminación en el historial.
- No mejora las estadísticas de éxito.
- No revierte daño recibido anteriormente.

La eliminación requerirá confirmación para evitar errores.

---

## 4.5. Daño bloqueado

Cuando un escudo reduce el daño a 0:

- La misión continúa considerándose fallada.
- No concede XP.
- No reduce HP.
- Se registra como fallo protegido.
- Rompe los contadores de misiones consecutivas sin fallar.
- Puede desbloquear el logro Defensa perfecta.

---

## 4.6. Muerte

Cuando el personaje llega a 0 HP:

- La aventura termina.
- El nivel general vuelve a 1.
- La experiencia general vuelve a 0.
- Todos los atributos vuelven a nivel 1.
- La XP de atributos vuelve a 0.
- Las monedas vuelven a 0.
- Se pierden todos los objetos.
- Se pierde el rango.
- Se eliminan todos los logros.
- Se elimina todo el progreso de logros.
- Se elimina el historial.
- Se reinician todas las estadísticas.
- Se eliminan las recompensas pendientes.
- Se pierde cualquier progreso de la aventura.

La nueva aventura comienza con:

- Nivel 1.
- 0 XP.
- 100 HP.
- 0 monedas.
- Mochila vacía.
- Atributos en nivel 1.
- Ningún logro desbloqueado.

---

## 4.7. Plantillas de misiones después de morir

Las misiones configuradas pueden conservarse como plantillas.

Esto permitirá:

- Revisar las antiguas rutinas.
- Volver a activar las que sigan siendo útiles.
- Evitar escribirlas otra vez.

Las plantillas no conservarán:

- XP.
- Progreso.
- Historial.
- Veces completadas.
- Estadísticas.
- Recompensas.
- Estado de la aventura anterior.

---

## 4.8. Tótem y muerte

El Tótem de la Inmortalidad evita una muerte si ya está en la mochila.

Cuando un daño fuera a dejar al personaje con 0 HP o menos:

- El Tótem se activa automáticamente.
- El daño se aplica.
- El personaje queda en 1 HP.
- El Tótem se consume.
- La aventura continúa.

Si el personaje no tiene un Tótem:

- La muerte se aplica inmediatamente.
- No se pueden utilizar pociones después.
- No se puede comprar un Tótem después del daño.
- No existe resurrección.

---

# 5. Monedas y economía

## 5.1. Moneda

- Solo existirá un tipo de moneda.
- No caducará.
- Se mantiene durante la aventura.
- Se pierde completamente al morir.
- No se puede comprar con dinero real en la primera versión.

---

## 5.2. Obtención de monedas

Las monedas se obtienen mediante:

- Subidas de nivel.
- Victoria contra Bosses.
- Tutorial inicial.

Las misiones normales no conceden monedas.

Los rangos conceden objetos, pero no monedas.

---

## 5.3. Monedas por nivel

La recompensa de monedas se calcula de la siguiente manera:

- Cada subida de nivel concede 2 monedas.
- Se añade 1 moneda por cada 10 niveles completos.
- Cada múltiplo de 10 concede una bonificación adicional de 10 monedas.

Estimación acumulada:

| Nivel alcanzado | Monedas acumuladas |
|---:|---:|
| 10 | 29 |
| 20 | 70 |
| 30 | 121 |
| 40 | 182 |
| 50 | 253 |
| 60 | 334 |
| 70 | 425 |
| 80 | 526 |
| 90 | 637 |
| 100 | 758 |

Estas cantidades no incluyen:

- Las monedas del tutorial.
- Las monedas obtenidas mediante Bosses.

---

## 5.4. Monedas de Bosses

| Tipo de Boss | Recompensa |
|---|---:|
| Boss menor | 10 monedas |
| Boss importante | 20 monedas |
| Boss legendario | 30 monedas |

Las monedas solo se obtienen al ganar.

Al perder:

- No se conceden monedas.
- No se concede XP.
- Se pierden 20 HP.

---

## 5.5. Filosofía de la economía

La economía debe ser escasa.

Objetivos:

- Comprar un objeto debe ser una decisión importante.
- Los objetos no deben poder utilizarse todos los días.
- El usuario debe decidir si curarse, protegerse o ahorrar.
- Los objetos poderosos deben requerir bastante progreso.
- Las monedas deben sentirse valiosas.
- El usuario no debe poder eliminar todo el riesgo acumulando curación.

Los valores se utilizarán como definitivos para comenzar a desarrollar y probar la aplicación. Podrán ajustarse después de partidas reales.

---

## 5.6. Restricciones

No se podrá comprar:

- XP.
- Niveles.
- Niveles de atributos.
- Misiones completadas.
- Logros.
- Vida máxima adicional.
- Ventajas permanentes.
- Recuperación después de morir.

---

# 6. Tutorial inicial

## 6.1. Objetivo

La aplicación tendrá un tutorial inicial para enseñar las mecánicas básicas.

El tutorial mostrará progresivamente cómo:

1. Crear una misión.
2. Elegir su dificultad.
3. Elegir su atributo principal.
4. Completar una misión.
5. Recibir XP.
6. Ver la barra de nivel.
7. Ver el progreso de un atributo.
8. Consultar los HP.
9. Abrir la mochila.
10. Entrar en el mercado.
11. Entender las monedas.
12. Utilizar una Poción.

---

## 6.2. Recompensa del tutorial

Al completar el tutorial, el usuario recibe:

- 1 Poción.
- 10 monedas.

La misión de prueba del tutorial no debe causar daño real.

El tutorial completo solo entrega la recompensa una vez.

Después de morir:

- El usuario puede volver a consultar las explicaciones.
- El tutorial no vuelve a conceder la Poción ni las monedas.
- La nueva aventura comienza realmente desde cero.

---

# 7. Misiones

## 7.1. Tipos de misión

Existirán tres tipos:

1. Rutina.
2. Tarea.
3. Boss.

---

## 7.2. Rutina

Una rutina es una misión que se repite siguiendo un calendario.

Puede programarse:

- Todos los días.
- En días concretos de la semana.
- De lunes a viernes.
- Cada cierto número de días.
- Con una frecuencia personalizada.
- Durante un periodo concreto.
- De forma indefinida.

Puede tener:

- Fecha de inicio.
- Fecha final.
- Hora límite opcional.
- Frecuencia.

Cada ocurrencia de una rutina:

- Cuenta como una misión independiente.
- Concede XP una sola vez.
- Causa daño si no se completa.
- Se registra independientemente en el historial.

Ejemplos:

- Entrenar lunes, miércoles y viernes.
- Leer todos los días.
- Revisar gastos cada domingo.
- Llamar a un familiar una vez por semana.

---

## 7.3. Tarea

Una tarea es una misión puntual.

Características:

- Se completa una sola vez.
- Tiene una fecha límite.
- Puede tener una hora límite.
- Desaparece al completarse.
- Causa daño si vence sin completarse.

Ejemplos:

- Entregar un documento.
- Terminar un trabajo.
- Pedir una cita.
- Comprar algo necesario.
- Enviar un correo.
- Preparar una presentación.

---

## 7.4. Boss

Un Boss representa un objetivo importante cuyo resultado no depende completamente de realizar una acción directa.

Tipos:

| Boss | XP | Monedas al ganar | Daño al perder |
|---|---:|---:|---:|
| Menor | 200 XP | 10 | −20 HP |
| Importante | 350 XP | 20 | −20 HP |
| Legendario | 500 XP | 30 | −20 HP |

Ejemplos:

- Aprobar un examen.
- Superar una entrevista.
- Conseguir una plaza.
- Obtener una admisión.
- Ganar una competición.
- Conseguir un trabajo.

Los Bosses serán independientes.

La aplicación no creará automáticamente:

- Misiones de preparación.
- Cadenas de tareas.
- Requisitos previos.
- Submisiones.

El usuario podrá crear tareas o rutinas de preparación de forma separada.

---

## 7.5. Batalla contra Boss

Cuando llegue la fecha de resultado de un Boss aparecerá el botón:

> **Batalla contra Boss**

Al pulsarlo:

1. Se muestra una transición especial.
2. Aparece una pantalla de enfrentamiento tipo VS.
3. Se muestra el personaje frente al Boss.
4. El usuario elige Victoria o Derrota.
5. Se solicita confirmación.
6. Se aplican las consecuencias.

### Victoria

- Concede toda la XP.
- Concede las monedas correspondientes.
- No causa daño.
- El Boss pasa al historial como victoria.

### Derrota

- No concede XP.
- No concede monedas.
- Causa 20 HP de daño.
- El Boss pasa al historial como derrota.

---

## 7.6. Resultado pendiente

Si llega la fecha del Boss, pero el resultado todavía no se conoce:

- No se considera derrota.
- No causa daño automáticamente.
- El Boss permanece pendiente.
- El botón Batalla contra Boss sigue disponible.
- El Boss aparece destacado hasta que el usuario registre el resultado.
- No existe un límite automático para declarar el resultado.

Esto permite esperar resultados externos como:

- Notas.
- Admisiones.
- Respuestas de empresas.
- Resultados de competiciones.
- Decisiones administrativas.

---

## 7.7. Formulario de misión

Campos:

- Nombre.
- Tipo.
- Descripción opcional.
- Dificultad.
- Atributo principal.
- Atributo secundario opcional.
- Fecha de inicio.
- Fecha límite.
- Hora límite opcional.
- Frecuencia, si es una rutina.
- Fecha final opcional, si es una rutina.
- Tipo de Boss, si corresponde.
- Fecha de resultado, si corresponde.

La aplicación calculará automáticamente:

- XP.
- Daño por fallo.
- Monedas de Boss.
- Progreso de atributos.

---

## 7.8. Fecha y hora de vencimiento

- Por defecto, una misión vence a las 23:59 del día seleccionado.
- El usuario puede añadir una hora límite específica.
- Si existe una hora específica, la misión vence en ese momento.
- El daño se aplica al vencer.
- La misión pasa automáticamente al historial como fallada.

---

## 7.9. Completar misiones

Para misiones normales:

- Habrá un botón directo para completar.
- Al pulsarlo, se conceden las recompensas.
- La misión desaparece de la lista activa.
- Habrá unos segundos para deshacer la acción.
- Una vez terminado ese periodo, la acción será definitiva.

Para Bosses:

- Siempre se solicitará confirmación.
- No habrá una simple pulsación accidental.
- Se utilizará la pantalla Batalla contra Boss.

---

## 7.10. Misiones activas

La pantalla principal mostrará únicamente misiones pendientes.

Cuando una misión se completa:

- Desaparece de la lista activa.
- Concede sus recompensas.
- Pasa al historial.

Cuando una misión vence:

- Desaparece de la lista activa.
- Causa daño.
- Pasa al historial como fallada.

Cuando se utiliza una Cuerda Huida:

- Desaparece de la lista activa.
- No concede XP.
- No causa daño.
- Pasa al historial como evitada.

---

## 7.11. Días sin misiones y constancia

Normalmente habrá misiones todos los días.

Como medida de seguridad:

- Un día sin ninguna misión programada no rompe los logros de constancia.
- Tampoco suma un día a esos logros.
- La constancia solo se rompe si había al menos una misión disponible y no se completa ninguna.

---

## 7.12. Cuerda Huida y estadísticas

Una misión evitada mediante Cuerda Huida:

- No cuenta como completada.
- No concede XP.
- No suma para los logros de constancia.
- No suma para logros de misiones completadas.
- No aumenta el porcentaje de éxito.
- No se registra como fallo.
- Aparece en el historial como misión evitada mediante objeto.

---

## 7.13. Duplicados de misiones

Se permiten misiones parecidas cuando representan acciones distintas.

Ejemplo válido:

- Entrenamiento de fuerza.
- Entrenamiento de tiro.

No se permiten duplicados equivalentes para la misma acción y el mismo periodo.

Ejemplo no válido:

- Beber agua.
- Tomar agua.
- Hidratarme.

Si todas representan exactamente la misma acción durante el mismo periodo.

La detección debe evitar abusos sin impedir organizar actividades legítimas.

---

# 8. Objetos y rarezas

## 8.1. Rarezas

Existirán cuatro rarezas:

- Común.
- Rara.
- Épica.
- Legendaria.

La rareza aparecerá visualmente en:

- La mochila.
- El mercado.
- Las fichas.
- Las recompensas.

---

## 8.2. Lista de objetos

| Objeto | Rareza | Efecto | Precio |
|---|---|---|---:|
| Poción | Común | Recupera 5 HP | 30 monedas |
| Superpoción | Rara | Recupera 10 HP | 70 monedas |
| Hiperpoción | Épica | Recupera 20 HP | 130 monedas |
| Escudo pequeño | Común | Reduce en 3 HP el daño de la próxima misión fallada | 40 monedas |
| Escudo grande | Rara | Reduce en 10 HP el daño de la próxima misión fallada | 110 monedas |
| Cuerda Huida | Rara | Evita una rutina o tarea sin XP ni daño | 150 monedas |
| Mano Celestial | Épica | Reduce de 20 a 10 HP el daño del próximo Boss perdido | 180 monedas |
| Tótem de la Inmortalidad | Legendaria | Evita una muerte y deja al personaje con 1 HP | 400 monedas |

---

## 8.3. Poción

- Rareza: Común.
- Recupera 5 HP.
- Se utiliza manualmente.
- Se consume al utilizarse.
- No permite superar 100 HP.

## 8.4. Superpoción

- Rareza: Rara.
- Recupera 10 HP.
- Se utiliza manualmente.
- Se consume al utilizarse.
- No permite superar 100 HP.

## 8.5. Hiperpoción

- Rareza: Épica.
- Recupera 20 HP.
- Se utiliza manualmente.
- Se consume al utilizarse.
- No permite superar 100 HP.

---

## 8.6. Curación sobrante

Si una Poción recuperaría más HP de los necesarios:

- La vida se detiene en 100.
- La curación sobrante se pierde.
- Antes de utilizarla, la aplicación muestra cuánto HP se aprovechará.

Ejemplo:

- Vida actual: 98 HP.
- Superpoción: +10 HP.
- Resultado: 100 HP.
- Curación desaprovechada: 8 HP.

---

## 8.7. Escudo pequeño

- Rareza: Común.
- Reduce 3 HP del daño de la siguiente misión fallada.
- Debe activarse antes del fallo.
- Se consume al producirse el siguiente fallo.
- No funciona contra Bosses.
- El exceso de protección se pierde.

Ejemplo:

Misión media:

- Daño original: 5 HP.
- Protección: 3 HP.
- Daño final: 2 HP.

---

## 8.8. Escudo grande

- Rareza: Rara.
- Reduce 10 HP del daño de la siguiente misión fallada.
- Debe activarse antes del fallo.
- Se consume al producirse el siguiente fallo.
- No funciona contra Bosses.
- El exceso de protección se pierde.

Ejemplo:

Misión fácil:

- Daño original: 3 HP.
- Protección: 10 HP.
- Daño final: 0 HP.
- Los 7 puntos restantes se pierden.

---

## 8.9. Reglas de escudos

- Solo puede existir un escudo activo a la vez.
- No pueden acumularse dos escudos.
- No pueden combinarse un Escudo pequeño y uno grande.
- Activar uno nuevo requerirá no tener otro activo.
- Se aplican al siguiente fallo compatible.
- Se consumen completamente.
- No funcionan contra Bosses.
- Una misión protegida sigue contando como fallada.

---

## 8.10. Cuerda Huida

- Rareza: Rara.
- Permite evitar una rutina o tarea.
- No funciona con Bosses.
- Debe utilizarse antes de que venza la misión.
- La misión desaparece.
- No concede XP.
- No causa daño.
- No cuenta como completada.
- Se consume al utilizarse.

---

## 8.11. Mano Celestial

Objeto inspirado en Inazuma Eleven.

- Rareza: Épica.
- Solo funciona con Bosses.
- Debe activarse antes de conocer o registrar el resultado.
- Si se pierde el Boss, reduce el daño de 20 a 10 HP.
- Si se gana el Boss, también se consume.
- Se considera utilizada desde el momento de la activación.

La lógica es:

> El objeto se utilizó porque el usuario no confiaba plenamente en ganar. Si finalmente gana, la protección se pierde igualmente.

---

## 8.12. Tótem de la Inmortalidad

- Rareza: Legendaria.
- Se activa automáticamente.
- Solo se activa ante un daño mortal.
- Evita que la vida llegue a 0.
- Deja al personaje con 1 HP.
- Se consume automáticamente.
- Debe estar en la mochila antes del daño.
- Solo puede existir una unidad en la mochila.

---

## 8.13. Límites de objetos

| Objeto | Límite |
|---|---:|
| Poción | Sin límite |
| Superpoción | Sin límite |
| Hiperpoción | Sin límite |
| Escudo pequeño | Sin límite |
| Escudo grande | Sin límite |
| Cuerda Huida | Máximo 5 |
| Mano Celestial | Máximo 3 |
| Tótem de la Inmortalidad | Máximo 1 |

---

## 8.14. Reglas generales

- Todos los objetos son consumibles.
- Ningún objeto concede XP.
- Todos los objetos se pierden al morir.
- No existen objetos con estadísticas aleatorias.
- No existen diferentes versiones del mismo objeto con efectos variables.
- Los objetos ligados a misiones deben utilizarse antes del vencimiento.
- Los objetos defensivos de Boss deben activarse antes del resultado.
- Las pociones no pueden utilizarse después de morir.

---

# 9. Mochila

## 9.1. Concepto visual

La mochila tendrá una estética inspirada en los menús clásicos de Pokémon.

Debe sentirse como una pantalla personal donde se guardan los objetos del personaje.

---

## 9.2. Información mostrada

Cada objeto mostrará:

- Icono.
- Nombre.
- Rareza.
- Descripción.
- Efecto exacto.
- Cantidad disponible.
- Botón de uso, cuando corresponda.

Ejemplo:

| Icono | Objeto | Descripción | Cantidad |
|---|---|---|---:|
| Poción | Poción | Recupera 5 HP | ×3 |
| Escudo | Escudo pequeño | Reduce 3 HP del siguiente daño | ×1 |
| Cuerda | Cuerda Huida | Evita una rutina o tarea | ×2 |
| Tótem | Tótem de la Inmortalidad | Evita una muerte | ×1 |

---

## 9.3. Ficha del objeto

Al pulsar un objeto se abrirá una ficha.

Ejemplo:

> **Poción**  
> Rareza: Común  
> Recupera 5 HP. No puede superar el máximo de 100 HP.  
> Cantidad disponible: 3  
> Botón: Usar

---

## 9.4. Uso de objetos vinculados a misiones

Para utilizar una Cuerda Huida:

1. Se selecciona el objeto.
2. Se muestran las misiones compatibles.
3. Se selecciona una misión.
4. Se explica el resultado.
5. Se solicita confirmación.
6. El objeto se consume.
7. La misión pasa al historial como evitada.

Para activar un escudo:

1. Se selecciona el escudo.
2. Se confirma la activación.
3. La aplicación muestra que existe un escudo activo.
4. Se consume al producirse el siguiente fallo compatible.

Para Mano Celestial:

1. Se selecciona antes de la batalla.
2. Se vincula al Boss.
3. Se confirma su uso.
4. Se consume al registrar el resultado, tanto en victoria como en derrota.

---

## 9.5. Objetos automáticos

El Tótem no tendrá un botón de uso normal.

La ficha indicará:

> Se activará automáticamente cuando un daño fuera a reducir tu vida a 0.

---

## 9.6. Organización

Los objetos pueden organizarse en:

- Curación.
- Protección.
- Misiones.
- Objetos especiales.

También puede mostrarse una única lista en la primera versión, ya que solo existen ocho objetos.

---

## 9.7. Capacidad

- No habrá peso.
- No habrá casillas individuales.
- Los objetos iguales se agrupan.
- Se muestra la cantidad de cada tipo.
- No existe límite general de espacio.
- Se respetan los límites particulares de Cuerda Huida, Mano Celestial y Tótem.

---

# 10. Equipamiento

El sistema de equipamiento no formará parte de la primera versión.

No habrá:

- Armas.
- Cascos.
- Armaduras.
- Botas.
- Anillos.
- Amuletos equipables.
- Bonificaciones permanentes mediante equipo.

Motivos:

- Complicaría demasiado el equilibrio.
- Reduciría el riesgo.
- Añadiría sistemas innecesarios.
- Los consumibles ya cumplen la función de protección.

Puede reconsiderarse en una expansión futura.

---

# 11. Mercado y mercader

## 11.1. Diferencia respecto a la mochila

La mochila y el mercado comparten información sobre objetos, pero deben sentirse visualmente diferentes.

### Mochila

- Espacio personal.
- Muestra lo que el usuario posee.
- Da importancia a la cantidad.
- Permite utilizar objetos.

### Mercado

- Espacio narrativo.
- Muestra lo que está a la venta.
- Da importancia al precio.
- Permite comprar objetos.
- Está atendido por un mercader.

---

## 11.2. Estética

La tienda tendrá forma de mercado pixel art.

Elementos:

- Mercader detrás de un mostrador.
- Estanterías.
- Cajas.
- Frascos.
- Objetos colgados.
- Decoración RPG.
- Cartel del mercado.
- Monedas del jugador visibles.

---

## 11.3. Diálogos

El mercader podrá mostrar mensajes como:

> “Tengo justo lo que necesitas.”

> “Más vale llevar una poción antes de enfrentarse a un Boss.”

> “No tienes suficientes monedas.”

> “Una buena protección puede salvar una aventura.”

---

## 11.4. Distribución

### Parte superior

- Nombre del mercado.
- Monedas disponibles.

### Zona principal

- Mercader.
- Mostrador.
- Decoración.

### Productos

Cada producto mostrará:

- Icono.
- Nombre.
- Rareza.
- Descripción breve.
- Precio.
- Cantidad que ya posee el usuario.
- Botón Comprar.

---

## 11.5. Compra

1. El usuario selecciona un objeto.
2. El mercader muestra su descripción.
3. Se muestra el precio.
4. Se muestran las monedas disponibles.
5. Se confirma la compra.
6. Se descuentan las monedas.
7. El objeto se añade a la mochila.
8. Se muestra un mensaje o animación.

No se podrá comprar:

- Sin monedas suficientes.
- Si se ha alcanzado el límite de ese objeto.

---

## 11.6. Disponibilidad

Todos los objetos estarán disponibles desde el principio.

No habrá:

- Desbloqueos por nivel.
- Desbloqueos por rango.
- Rotación diaria.
- Objetos aleatorios.
- Stock temporal.

La dificultad estará en conseguir las monedas necesarias.

---

# 12. Rangos

## 12.1. Funcionamiento

Los rangos:

- Dependen exclusivamente del nivel general.
- Son principalmente visuales.
- Representan la etapa actual de la aventura.
- No conceden ventajas permanentes.
- Aparecen junto al personaje.
- Entregan una recompensa puntual al alcanzarse.

Ejemplo:

> Nivel 42 — Élite

---

## 12.2. Rangos

| Nivel | Rango |
|---:|---|
| 1–9 | Novato |
| 10–19 | Aventurero |
| 20–34 | Guerrero |
| 35–49 | Élite |
| 50–69 | Maestro |
| 70–89 | Leyenda |
| 90–99 | Héroe |
| 100 | Inmortal |

Los nombres se consideran válidos para comenzar, aunque podrán cambiarse más adelante sin alterar los niveles.

---

## 12.3. Recompensas

| Rango alcanzado | Recompensa |
|---|---|
| Aventurero | 1 Poción |
| Guerrero | 1 Superpoción |
| Élite | 1 Escudo pequeño |
| Maestro | 1 Escudo grande |
| Leyenda | 1 Mano Celestial |
| Héroe | 1 Tótem de la Inmortalidad |
| Inmortal | Solo el logro Inmortal |

No se conceden monedas adicionales por rango.

El Tótem se entrega en Héroe para ayudar a completar el tramo final hasta Inmortal.

Inmortal no concede recompensa material porque alcanzar ese rango es el premio.

---

## 12.4. Recompensas pendientes

Si el usuario alcanza un rango y no puede recibir el objeto por haber alcanzado su límite:

- La recompensa queda pendiente.
- No se convierte en monedas.
- No se pierde.
- Puede reclamarse cuando exista espacio.

Ejemplo:

Si el usuario alcanza Héroe teniendo ya un Tótem:

- El nuevo Tótem queda pendiente.
- Cuando el Tótem actual se consuma, podrá reclamar la recompensa.
- La recompensa seguirá disponible hasta ser reclamada.

---

# 13. Habilidades y privilegios futuros

Este sistema queda guardado para una futura versión.

## 13.1. Idea

Al subir de nivel, el jugador podría recibir puntos de habilidad.

Estos puntos permitirían desbloquear privilegios relacionados con la vida diaria.

Ejemplos:

- Permitir una actividad de ocio.
- Desbloquear tiempo de videojuegos.
- Autorizar una compra personal.
- Obtener una recompensa.
- Permitir algo que el usuario se haya restringido voluntariamente.

La idea es ganarse ciertas actividades cotidianas mediante el progreso.

## 13.2. Estado

- No forma parte de la primera versión.
- No forma parte del sistema inicial de progresión.
- Se guarda como posible expansión.
- Deberá diseñarse con cuidado para evitar restricciones perjudiciales o castigos excesivos.

---

# 14. Logros

## 14.1. Filosofía

La aplicación tendrá 70 logros.

Objetivos:

- Crear sensación de coleccionismo.
- Premiar diferentes estilos de progreso.
- Ofrecer metas a corto, medio y largo plazo.
- Representar visualmente el crecimiento del jugador.
- Motivar a explorar todas las mecánicas.

Reglas:

- Todos los logros aparecen dentro de una misma colección.
- Pueden existir filtros por categorías.
- No habrá una pantalla separada para rachas.
- Los logros de constancia aparecen junto a los demás.
- Ningún logro puede quedar bloqueado permanentemente por un error anterior.
- Los contadores consecutivos pueden reiniciarse.
- Siempre debe existir una nueva oportunidad de completar un logro.
- Los logros se reinician al morir.
- No conceden monedas ni objetos.
- La recompensa es la medalla y completar la colección.

---

## 14.2. Pantalla de logros

Cada logro tendrá:

- Medalla o dibujo propio.
- Nombre.
- Descripción.
- Barra de progreso.
- Progreso numérico.
- Estado visual.
- Fecha de desbloqueo.

### Logros completados

- Medalla a color.
- Tarjeta a color.
- Barra al 100 %.
- Fecha de obtención.

### Logros pendientes

- Medalla en gris.
- Tarjeta en gris.
- Texto “Por desbloquear”.
- Barra de progreso parcial.
- Contador como `37/100`.

---

## 14.3. Logros de misiones — 7

| Logro | Requisito |
|---|---|
| Primer paso | Completar la primera misión |
| Aprendiz de aventurero | Completar 10 misiones |
| Cazador de misiones | Completar 50 misiones |
| Veterano | Completar 100 misiones |
| Héroe incansable | Completar 250 misiones |
| Toda una vida de aventuras | Completar 500 misiones |
| Maestro de misiones | Completar 1.000 misiones |

---

## 14.4. Logros de constancia — 7

Para estos logros basta con completar al menos una misión cada día.

| Logro | Requisito |
|---|---|
| Primer paso firme | Completar al menos una misión durante 3 días seguidos |
| En marcha | Completar al menos una misión durante 7 días seguidos |
| Constante | Completar al menos una misión durante 14 días seguidos |
| Disciplinado | Completar al menos una misión durante 30 días seguidos |
| Imparable | Completar al menos una misión durante 60 días seguidos |
| Leyenda de la constancia | Completar al menos una misión durante 100 días seguidos |
| Un año de aventura | Completar al menos una misión durante 365 días seguidos |

Reglas:

- Si había misiones disponibles y no se completa ninguna, el contador vuelve a 0.
- Si no había ninguna misión programada, el día no suma ni rompe el contador.
- Un logro ya conseguido no se pierde durante la aventura.
- Todos los logros se pierden al morir.

---

## 14.5. Logros de Bosses — 6

| Logro | Requisito |
|---|---|
| Primer gran desafío | Vencer el primer Boss |
| Cazador de gigantes | Vencer 5 Bosses |
| Rompejefes | Vencer 10 Bosses |
| Azote de los titanes | Vencer 25 Bosses |
| Sin miedo | Vencer un Boss sin tener activa Mano Celestial |
| Conquistador | Vencer 50 Bosses |

---

## 14.6. Logros de nivel y rangos — 8

| Logro | Requisito |
|---|---|
| La aventura comienza | Alcanzar nivel 5 |
| Aventurero | Alcanzar el rango Aventurero |
| Guerrero | Alcanzar el rango Guerrero |
| Élite | Alcanzar el rango Élite |
| Maestro | Alcanzar el rango Maestro |
| Leyenda | Alcanzar el rango Leyenda |
| Héroe | Alcanzar el rango Héroe |
| Inmortal | Alcanzar nivel 100 |

---

## 14.7. Logros de atributos — 19

### Vitalidad

| Logro | Requisito |
|---|---|
| Cuerpo resistente | Alcanzar Vitalidad 10 |
| Corazón de hierro | Alcanzar Vitalidad 25 |
| Fortaleza absoluta | Alcanzar Vitalidad 50 |

### Intelecto

| Logro | Requisito |
|---|---|
| Mente despierta | Alcanzar Intelecto 10 |
| Mente brillante | Alcanzar Intelecto 25 |
| Sabio supremo | Alcanzar Intelecto 50 |

### Disciplina

| Logro | Requisito |
|---|---|
| Voluntad firme | Alcanzar Disciplina 10 |
| Voluntad inquebrantable | Alcanzar Disciplina 25 |
| Dominio de uno mismo | Alcanzar Disciplina 50 |

### Relaciones

| Logro | Requisito |
|---|---|
| Buen compañero | Alcanzar Relaciones 10 |
| Alma sociable | Alcanzar Relaciones 25 |
| Corazón de la comunidad | Alcanzar Relaciones 50 |

### Aventura

| Logro | Requisito |
|---|---|
| Primer explorador | Alcanzar Aventura 10 |
| Espíritu explorador | Alcanzar Aventura 25 |
| Leyenda errante | Alcanzar Aventura 50 |

### Fortuna

| Logro | Requisito |
|---|---|
| Golpe de suerte | Alcanzar Fortuna 10 |
| Favor de la fortuna | Alcanzar Fortuna 25 |
| Elegido del destino | Alcanzar Fortuna 50 |

### Logro final de atributos

| Logro | Requisito |
|---|---|
| Maestro de todos los caminos | Alcanzar nivel 50 en los seis atributos |

---

## 14.8. Logros de supervivencia — 6

| Logro | Requisito |
|---|---|
| Herido, pero en pie | Bajar por primera vez de 25 HP |
| Al límite | Sobrevivir quedándose exactamente con 1 HP |
| La muerte tendrá que esperar | Activar un Tótem de la Inmortalidad |
| Superviviente | Alcanzar nivel 50 sin morir |
| Intocable | Pasar 30 días consecutivos sin recibir daño |
| Camino impecable | Completar 25 misiones consecutivas sin fallar ninguna |

Los logros consecutivos pueden volver a intentarse tantas veces como sea necesario.

---

## 14.9. Logros de objetos y mercado — 8

| Logro | Requisito |
|---|---|
| Primera compra | Comprar el primer objeto |
| Preparado para el viaje | Tener cinco objetos simultáneamente en la mochila |
| Alquimista aficionado | Usar 10 pociones de cualquier tipo |
| Defensa perfecta | Evitar completamente el daño de una misión con un escudo |
| Huida estratégica | Usar una Cuerda Huida |
| La parada celestial | Usar Mano Celestial por primera vez |
| Coleccionista | Tener al menos una unidad de cada tipo de objeto |
| Cliente habitual | Realizar 25 compras en el mercado |

---

## 14.10. Logros de monedas — 4

| Logro | Requisito |
|---|---|
| Primeras ganancias | Obtener un total de 50 monedas en una aventura |
| Ahorrador | Tener 100 monedas disponibles al mismo tiempo |
| Tesoro personal | Tener 250 monedas disponibles al mismo tiempo |
| Gran fortuna | Obtener un total acumulado de 500 monedas en una aventura |

---

## 14.11. Logros de fallos, recuperación y variedad — 5

| Logro | Requisito |
|---|---|
| Una lección aprendida | Fallar la primera misión |
| De vuelta al camino | Completar una misión después de haber recibido daño |
| Nunca te rindas | Pasar de menos de 10 HP a más de 50 HP |
| Regreso triunfal | Completar 10 misiones consecutivas después de haber bajado de 25 HP |
| Maestro versátil | Completar al menos una misión principal de cada uno de los seis atributos durante un periodo de 7 días |

---

## 14.12. Total de logros

| Categoría | Cantidad |
|---|---:|
| Misiones | 7 |
| Constancia | 7 |
| Bosses | 6 |
| Nivel y rangos | 8 |
| Atributos | 19 |
| Supervivencia | 6 |
| Objetos y mercado | 8 |
| Monedas | 4 |
| Fallos, recuperación y variedad | 5 |
| **Total** | **70** |

---

# 15. Historial y estadísticas

## 15.1. Importancia

El historial y las estadísticas existirán, pero serán una sección secundaria.

No deben:

- Acaparar la pantalla principal.
- Distraer de las misiones.
- Convertir la aplicación en una herramienta de análisis empresarial.
- Mostrar demasiados datos innecesarios.

El acceso podrá estar dentro de:

- El perfil.
- Un menú secundario.
- Una sección de información.

---

## 15.2. Historial

El historial será una lista cronológica de eventos.

Podrá incluir:

- Misiones completadas.
- Misiones falladas.
- Misiones eliminadas.
- Misiones evitadas mediante Cuerda Huida.
- Bosses ganados.
- Bosses perdidos.
- Objetos utilizados.
- Escudos activados.
- Compras.
- Logros desbloqueados.
- Subidas de nivel.
- Cambios de rango.
- Daño recibido.
- Vida recuperada.
- Activaciones del Tótem.

Ejemplo:

> **24 de julio**  
> Completaste “Entrenamiento de fuerza”.  
> +30 XP general.  
> +30 XP de Vitalidad.

Ejemplo de fallo:

> **24 de julio**  
> Fallaste “Entregar documentación”.  
> −5 HP.

---

## 15.3. Estadísticas

Se mostrarán únicamente datos útiles:

- Misiones completadas.
- Misiones falladas.
- Misiones eliminadas.
- Misiones evitadas.
- Porcentaje de éxito.
- Misiones completadas por dificultad.
- Misiones completadas por atributo.
- Bosses ganados.
- Bosses perdidos.
- HP perdido.
- HP recuperado.
- Pociones utilizadas.
- Escudos utilizados.
- Cuerdas Huida utilizadas.
- Manos Celestiales utilizadas.
- Tótems activados.
- Monedas obtenidas.
- Monedas gastadas.
- Compras realizadas.
- Mejor periodo completando una misión diaria.
- Nivel actual de cada atributo.
- Nivel general actual.

---

## 15.4. Reinicio al morir

Al morir:

- El historial se elimina completamente.
- Las estadísticas vuelven a 0.
- No se conserva un total histórico.
- No se conservan datos de aventuras anteriores.
- No existen récords permanentes.
- Todo pertenece a la aventura actual.

---

# 16. Pantallas funcionales previstas

## 16.1. Pantalla principal

Será la pantalla más importante.

Mostrará:

- Personaje.
- Nivel general.
- Barra de XP.
- HP.
- Rango.
- Monedas.
- Misiones activas.
- Botón para crear una misión.

---

## 16.2. Pantalla de creación de misión

Permitirá seleccionar:

- Rutina.
- Tarea.
- Boss.

Mostrará los campos correspondientes a cada tipo.

---

## 16.3. Pantalla de atributos

Mostrará:

- Los seis atributos.
- Nivel de cada atributo.
- Barra de XP.
- XP necesaria para el siguiente nivel.
- Acceso a logros relacionados.

---

## 16.4. Pantalla de mochila

Mostrará:

- Iconos.
- Nombres.
- Rarezas.
- Descripciones.
- Cantidades.
- Uso de objetos.
- Objetos activos.
- Recompensas pendientes.

---

## 16.5. Pantalla de mercado

Mostrará:

- Mercader.
- Escenario.
- Productos.
- Precios.
- Monedas.
- Cantidades poseídas.
- Diálogos.
- Compra.

---

## 16.6. Pantalla de logros

Mostrará:

- Los 70 logros.
- Medallas.
- Progreso.
- Logros completados.
- Logros pendientes.
- Filtros por categoría.
- Fecha de desbloqueo.

No tiene que estar en el menú principal, pero debe ser fácil acceder a ella.

---

## 16.7. Pantalla de historial y estadísticas

Será una pantalla secundaria.

Mostrará:

- Historial cronológico.
- Estadísticas básicas.
- Resumen de la aventura actual.

---

## 16.8. Pantalla Batalla contra Boss

Mostrará:

- Personaje.
- Boss.
- Efecto de enfrentamiento.
- Estética VS.
- Mano Celestial activa, si existe.
- Botón Victoria.
- Botón Derrota.
- Confirmación del resultado.
- Animación de recompensa o daño.

---

# 17. Balance inicial

Los valores definidos en este documento se utilizarán como valores iniciales para desarrollar y probar la aplicación.

Se consideran cerrados para la primera versión:

- XP por dificultad.
- Curva de nivel general.
- Curva de atributos.
- Daño por dificultad.
- Monedas por nivel.
- Monedas por Boss.
- Precio de los objetos.
- Recompensas de rango.
- Límites de objetos.

Después de probar partidas reales se podrán ajustar.

El análisis deberá comprobar:

- Cuánto se tarda en subir.
- Cuánto HP se pierde.
- Cuántos objetos se compran.
- Si las pociones son demasiado eficientes.
- Si los Bosses conceden demasiada XP.
- Si morir es demasiado fácil.
- Si morir es demasiado difícil.
- Si algún objeto domina el mercado.
- Si las rutinas generan demasiada XP.
- Si maximizar atributos es razonable.

Cuando sea necesario ajustar el sistema:

- Se cambiará una variable cada vez.
- Se observará el efecto.
- Se evitarán cambios simultáneos que impidan identificar el problema.

---

# 18. Resumen de reglas principales

- La aventura comienza en nivel 1.
- El nivel máximo general es 100.
- Cada atributo tiene un máximo de 50.
- El personaje comienza con 100 HP.
- La vida no se recupera automáticamente.
- Toda misión creada es obligatoria.
- Fallar una misión causa daño.
- Las misiones pueden eliminarse antes de vencer sin daño.
- Eliminar una misión no concede recompensas.
- Existen rutinas, tareas y Bosses.
- Las misiones normales conceden XP, pero no monedas.
- Los Bosses conceden XP y monedas al ganarse.
- Los Bosses causan 20 HP de daño al perderse.
- La XP general sigue la fórmula `50 + 10 × nivel actual`.
- La XP de atributos sigue la fórmula `30 + 8 × nivel actual`.
- El atributo principal recibe el 100 % de la XP.
- El atributo secundario recibe el 25 %.
- Solo se puede tener un escudo activo.
- Los escudos no funcionan contra Bosses.
- Mano Celestial se consume tanto al ganar como al perder.
- El Tótem se activa automáticamente.
- Morir reinicia absolutamente todo.
- Las misiones configuradas pueden mantenerse como plantillas.
- Los logros se reinician al morir.
- El historial se elimina al morir.
- Las estadísticas se reinician al morir.
- El nivel 100 no finaliza la aventura.
- Después del nivel 100 se puede continuar jugando.
- No existe equipamiento en la primera versión.
- No existe un sistema independiente de rachas.
- Existen 70 logros.
- La mochila tiene estética inspirada en Pokémon.
- El mercado tiene una estética propia con un mercader.
- Los objetos son escasos y deben administrarse.
- Las habilidades y privilegios quedan reservados para una futura versión.