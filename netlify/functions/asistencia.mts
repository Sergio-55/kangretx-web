import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

// Asistencia del Kangretx Old Stars.
// GET  /api/asistencia  → respuestas de todos (público, solo lectura)
// POST /api/acceso      → comprueba email + contraseña del equipo
// POST /api/asistencia  → guarda una respuesta (cada uno la suya; los admin, la de cualquiera)
//
// Configuración privada (Netlify → Project configuration → Environment variables):
//   CLAVE_EQUIPO      contraseña común del equipo
//   JUGADORES_EMAILS  JSON {"email": "id_jugador", ...}
//   ADMIN_EMAILS      emails que pueden marcar a cualquiera, separados por comas
//
// Cada respuesta se guarda en su propia clave "partido/jugador" (si | no | duda),
// así dos jugadores que marcan a la vez no se pisan.

const RESPUESTAS = new Set(["si", "no", "duda"])
const ID = /^[a-z0-9-]{1,40}$/

const store = () => getStore({ name: "asistencia", consistency: "strong" })
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

function emails(): Record<string, string> {
  try {
    const raw = JSON.parse(Netlify.env.get("JUGADORES_EMAILS") || "{}") as Record<string, string>
    return Object.fromEntries(Object.entries(raw).map(([e, j]) => [e.trim().toLowerCase(), j]))
  } catch {
    return {}
  }
}
const admins = () =>
  new Set((Netlify.env.get("ADMIN_EMAILS") || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))

// Devuelve el jugador si email + contraseña son correctos; si no, null.
async function identificar(email: unknown, clave: unknown) {
  const esperada = Netlify.env.get("CLAVE_EQUIPO")
  const e = typeof email === "string" ? email.trim().toLowerCase() : ""
  const jugador = emails()[e]
  if (!esperada || typeof clave !== "string" || clave !== esperada || !jugador) {
    await pause(700) // frena a quien pruebe contraseñas a ciegas
    return null
  }
  return { email: e, jugador, admin: admins().has(e) }
}

export default async (req: Request) => {
  const url = new URL(req.url)

  if (req.method === "GET" && url.pathname === "/api/asistencia") {
    const s = store()
    const { blobs } = await s.list()
    const out: Record<string, Record<string, string>> = {}
    await Promise.all(
      blobs.map(async ({ key }) => {
        const [partido, jugador] = key.split("/")
        if (!partido || !jugador) return
        const v = await s.get(key)
        if (v && RESPUESTAS.has(v)) (out[partido] ??= {})[jugador] = v
      }),
    )
    return json(out)
  }

  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: "Petición no válida" }, 400)
  }

  const quien = await identificar(body.email, body.clave)
  if (!quien) return json({ ok: false, error: "Email o contraseña incorrectos." }, 401)

  if (url.pathname === "/api/acceso") {
    return json({ ok: true, jugador: quien.jugador, admin: quien.admin })
  }

  const { partido, jugador, respuesta } = body
  if (typeof partido !== "string" || !ID.test(partido) || typeof jugador !== "string" || !ID.test(jugador)) {
    return json({ ok: false, error: "Partido o jugador no válido" }, 400)
  }
  if (respuesta !== null && !(typeof respuesta === "string" && RESPUESTAS.has(respuesta))) {
    return json({ ok: false, error: "Respuesta no válida" }, 400)
  }
  if (jugador !== quien.jugador && !quien.admin) {
    return json({ ok: false, error: "Solo puedes marcar tu propia asistencia." }, 403)
  }

  const key = `${partido}/${jugador}`
  if (respuesta === null) await store().delete(key)
  else await store().set(key, respuesta)
  return json({ ok: true })
}

export const config: Config = {
  path: ["/api/asistencia", "/api/acceso"],
  method: ["GET", "POST"],
}
