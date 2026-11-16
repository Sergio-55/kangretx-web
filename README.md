# Kangretx Old Stars · Web del equipo

Web: https://kangretx.pages.dev (Cloudflare Pages)

- `public/` — la web. `public/datos.js` tiene calendario, resultados del grupo, clasificación, estadísticas, plantilla y noticias.
- `functions/api/` + `lib/asistencia.js` — asistencia con email + contraseña del equipo, guardada en Cloudflare D1.

Configuración en Cloudflare Pages:
- Build command: (vacío) · Build output directory: `public`
- Variables/secretos: `CLAVE_EQUIPO`, `JUGADORES_EMAILS`, `ADMIN_EMAILS`
- Binding D1: `DB`

Para actualizar resultados o estadísticas: edita `public/datos.js` y haz commit; Cloudflare publica solo.
