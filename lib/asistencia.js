// Asistencia del Kangretx Old Stars (Cloudflare Pages Functions + D1).
//
// Configuración privada (Cloudflare → tu proyecto de Pages → Settings):
//   Variables y secretos:
//     CLAVE_EQUIPO      contraseña común del equipo
//     JUGADORES_EMAILS  JSON {"email": "id_jugador", ...}
//     ADMIN_EMAILS      emails que pueden marcar a cualquiera, separados por comas
//   Bindings:
//     DB                base de datos D1 donde se guardan las respuestas

const RESPUESTAS = new Set(["si", "no", "duda"]);
const ID = /^[a-z0-9-]{1,40}$/;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function tabla(db) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS asistencia (partido TEXT NOT NULL, jugador TEXT NOT NULL, respuesta TEXT NOT NULL, actualizado TEXT NOT NULL, PRIMARY KEY (partido, jugador))",
    )
    .run();
}

function emails(env) {
  try {
    const raw = JSON.parse(env.JUGADORES_EMAILS || "{}");
    return Object.fromEntries(Object.entries(raw).map(([e, j]) => [String(e).trim().toLowerCase(), j]));
  } catch {
    return {};
  }
}
const admins = (env) =>
  new Set(String(env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

// Devuelve el jugador si email + contraseña son correctos; si no, null.
async function identificar(env, email, clave) {
  const esperada = env.CLAVE_EQUIPO;
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const jugador = emails(env)[e];
  if (!esperada || typeof clave !== "string" || clave !== esperada || !jugador) {
    await pause(700); // frena a quien pruebe contraseñas a ciegas
    return null;
  }
  return { email: e, jugador, admin: admins(env).has(e) };
}

async function leerCuerpo(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// GET /api/asistencia → respuestas de todos (solo lectura)
export async function listar({ env }) {
  if (!env.DB) return json({ ok: false, error: "Falta la base de datos (binding DB)" }, 500);
  await tabla(env.DB);
  const { results } = await env.DB.prepare("SELECT partido, jugador, respuesta FROM asistencia").all();
  const out = {};
  for (const r of results || []) if (RESPUESTAS.has(r.respuesta)) (out[r.partido] ??= {})[r.jugador] = r.respuesta;
  return json(out);
}

// POST /api/acceso → comprueba email + contraseña
export async function acceso({ request, env }) {
  const body = await leerCuerpo(request);
  if (!body) return json({ ok: false, error: "Petición no válida" }, 400);
  const quien = await identificar(env, body.email, body.clave);
  if (!quien) return json({ ok: false, error: "Email o contraseña incorrectos." }, 401);
  return json({ ok: true, jugador: quien.jugador, admin: quien.admin });
}

// POST /api/asistencia → guarda una respuesta (cada uno la suya; los admin, la de cualquiera)
export async function guardar({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "Falta la base de datos (binding DB)" }, 500);
  const body = await leerCuerpo(request);
  if (!body) return json({ ok: false, error: "Petición no válida" }, 400);
  const quien = await identificar(env, body.email, body.clave);
  if (!quien) return json({ ok: false, error: "Email o contraseña incorrectos." }, 401);

  const { partido, jugador, respuesta } = body;
  if (typeof partido !== "string" || !ID.test(partido) || typeof jugador !== "string" || !ID.test(jugador)) {
    return json({ ok: false, error: "Partido o jugador no válido" }, 400);
  }
  if (respuesta !== null && !(typeof respuesta === "string" && RESPUESTAS.has(respuesta))) {
    return json({ ok: false, error: "Respuesta no válida" }, 400);
  }
  if (jugador !== quien.jugador && !quien.admin) {
    return json({ ok: false, error: "Solo puedes marcar tu propia asistencia." }, 403);
  }

  await tabla(env.DB);
  if (respuesta === null) {
    await env.DB.prepare("DELETE FROM asistencia WHERE partido = ? AND jugador = ?").bind(partido, jugador).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO asistencia (partido, jugador, respuesta, actualizado) VALUES (?, ?, ?, ?) ON CONFLICT (partido, jugador) DO UPDATE SET respuesta = excluded.respuesta, actualizado = excluded.actualizado",
    )
      .bind(partido, jugador, respuesta, new Date().toISOString())
      .run();
  }
  return json({ ok: true });
}
