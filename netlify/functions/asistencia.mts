import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

// Asistencia del Kangretx Old Stars.
// Cada respuesta se guarda en su propia clave "partido/jugador" (valor: si | no | duda),
// así dos jugadores que marcan a la vez no se pisan.
const RESPUESTAS = new Set(["si", "no", "duda"])
const ID = /^[a-z0-9-]{1,40}$/

const store = () => getStore({ name: "asistencia", consistency: "strong" })

export default async (req: Request) => {
  if (req.method === "GET") {
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
    return Response.json(out, { headers: { "cache-control": "no-store" } })
  }

  if (req.method === "POST") {
    let body: { partido?: unknown; jugador?: unknown; respuesta?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ ok: false, error: "JSON no válido" }, { status: 400 })
    }
    const { partido, jugador, respuesta } = body
    if (typeof partido !== "string" || !ID.test(partido) || typeof jugador !== "string" || !ID.test(jugador)) {
      return Response.json({ ok: false, error: "Partido o jugador no válido" }, { status: 400 })
    }
    if (respuesta !== null && !(typeof respuesta === "string" && RESPUESTAS.has(respuesta))) {
      return Response.json({ ok: false, error: "Respuesta no válida" }, { status: 400 })
    }
    const key = `${partido}/${jugador}`
    if (respuesta === null) await store().delete(key)
    else await store().set(key, respuesta)
    return Response.json({ ok: true })
  }

  return new Response("Método no permitido", { status: 405 })
}

export const config: Config = {
  path: "/api/asistencia",
  method: ["GET", "POST"],
}
