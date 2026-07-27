# Pizzerías Huracanes — nueva web

Rediseño mobile-first de la web de Pizzerías Huracanes, manteniendo la esencia (la carta como
núcleo) y añadiendo experiencia de pedido, marca y funciones pensadas para el cliente final.

## Cómo verla en local

1. Doble clic en **`iniciar-web.ps1`** (o en terminal: `.\iniciar-web.ps1`).
2. Se abre en `http://localhost:8080/`.

Requiere Python instalado. Alternativa sin scripts:
```powershell
cd docs
python -m http.server 8080
```

## Qué incluye

- **Carta completa real** (109 platos, 8 categorías) extraída del sistema HioPOS actual.
- **Pizzas con selector de tamaño** 26 / 34 / 45 cm en una sola tarjeta (en vez de 3 listados).
- **Buscador** y **filtro por los 14 alérgenos UE** (Reglamento 1169/2011).
- **Pedido**: carrito propio → WhatsApp con el pedido ya escrito, enlace al pedido online
  oficial (HioPOS) por local, y llamada directa.
- **Diseño mobile-first**: barra inferior fija (Carta / Pedido / Llamar), chips de categoría
  con scroll-spy, fotos reales en WebP (carga rápida), **modo claro/oscuro** automático.
- **Dos locales** (San José · Huelva y Punta Umbría) con pedido y "cómo llegar".
- **SEO**: `schema.org/Restaurant` + `Menu` en JSON-LD, títulos y descripción optimizados.
- **PWA**: instalable en el móvil ("añadir a pantalla de inicio").

## Estructura

```
docs/
  index.html            Página principal
  css/styles.css        Diseño (sistema de marca, claro/oscuro)
  js/app.js             Carta, buscador, filtros, carrito, pedido
  data/menu.json        Carta procesada (fuente de datos editable)
  manifest.webmanifest  PWA
  assets/               Logo, hero, fotos de categoría
  assets/productos/     173 fotos de producto (WebP)
assets/                 Datos crudos extraídos del portal (referencia)
```

## Editar la carta

Todo sale de `docs/data/menu.json`: precios, descripciones, alérgenos, tamaños y disponibilidad.
Cambiar un precio o marcar un plato agotado es editar ese archivo (o regenerarlo desde HioPOS).

## Pendiente de configurar por el propietario

- **Número de WhatsApp** del pedido (ahora el botón abre WhatsApp sin número fijado).
- **Enlaces de Google Maps** exactos de cada local (ahora usan búsqueda por nombre).
- Dominio y despliegue (cualquier hosting estático: Netlify, Vercel, Hostinger…).
