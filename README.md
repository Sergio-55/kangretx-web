# Kangretx Old Stars · Web del equipo

Web: Cloudflare Workers (Worker `kangretx`, configuración en `wrangler.jsonc`)

- `public/` — la web. `public/datos.js` tiene calendario, resultados del grupo, clasificación, estadísticas, plantilla y noticias.
- `worker/index.js` + `lib/asistencia.js` — sirve la web y la asistencia (email + contraseña del equipo), guardada en Cloudflare D1.

Configuración en Cloudflare:
- Secretos del Worker: `CLAVE_EQUIPO`, `JUGADORES_EMAILS`, `ADMIN_EMAILS`
- Base de datos D1 `kangretx` (enlazada como `DB` en `wrangler.jsonc`)

Para actualizar resultados o estadísticas: edita `public/datos.js` y haz commit; Cloudflare publica solo.
