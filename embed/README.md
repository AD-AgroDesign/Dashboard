# Mapa público de intervenciones — cómo embeberlo en la landing

Bloque de mapa con un pin por establecimiento rediseñado. Se alimenta solo de la
misma base que el dashboard: al editar un punto en **Perfil → Puntos del mapa**,
la landing lo refleja en la siguiente carga, sin volver a publicar nada.

**No muestra el nombre del campo ni el del cliente.** Cada popup dice sólo:

```
Establecimiento rediseñado
Ha. totales              1.234,00
Ha. naturaleza             290,55
Ubicación aproximada para resguardar los datos del cliente.
```

Esos nombres no se ocultan en el navegador: **no salen de la base**. Los datos
vienen de la vista `v_mapa_publico`, que sólo tiene `lat`, `lng`, `ha_total` y
`ha_naturaleza`, con las coordenadas redondeadas a ~1 km en el servidor. Aunque
alguien abra la pestaña Red del navegador, no hay ningún nombre que leer.

---

## Opción A — iframe (funciona en cualquier plataforma)

No requiere tocar nada más que el HTML del bloque:

```html
<section class="ad-mapa-bloque">
  <h2>Nuestras intervenciones</h2>
  <iframe src="https://dashboard.agrodesign.site/mapa-publico.html"
          title="Mapa de intervenciones de AgroDesign" loading="lazy"
          style="width:100%;height:min(70vh,620px);border:0;border-radius:12px"></iframe>
</section>
```

## Opción B — sin iframe, dentro de la propia landing

Queda mejor integrado (hereda el ancho y el fondo de la página, sin scroll
anidado). El script carga Leaflet solo si la landing no lo trae ya:

```html
<div data-agrodesign-mapa style="height:520px;border-radius:12px;overflow:hidden"></div>
<script src="https://dashboard.agrodesign.site/embed/agrodesign-mapa.js" defer></script>
```

El alto lo define la landing con CSS (si no se especifica, el script pone 480px).
Se puede repetir el `<div>` varias veces en la misma página.

Si la landing tuviera una CSP que bloquee scripts de otro dominio, usar la
opción A.

---

## Detalles que conviene conocer

- **Gestos.** La rueda del mouse no hace zoom hasta que hacés click dentro del
  mapa, y en celular el mapa no se arrastra hasta que lo tocás una vez. Sin eso
  el mapa secuestra el scroll de la página. Los botones `+ / −` andan siempre.
- **Si falla la carga**, el bloque muestra un aviso discreto y nunca tira un
  error que pueda romper la landing.
- **Qué puntos salen.** Los que tengan coordenadas y el check *Publicar en el
  mapa de la web* activo (Perfil → Puntos del mapa). El Balance del dashboard
  sigue mostrando todos, publicados o no.
- **El SQL va primero.** `output_sql/add_mapa_publico.sql` crea la vista y el
  flag `publico`. Sin eso el mapa carga vacío.

⚠️ **Agregar una columna a `v_mapa_publico` es publicarla en internet.** Es el
único lugar que decide qué se ve y qué no.
