// Worker de la web del Kangretx Old Stars.
// Sirve la web (carpeta public/) y la API de asistencia (/api/asistencia, /api/acceso).
import { listar, guardar, acceso, json } from "../lib/asistencia.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const ctx = { request, env };
    if (pathname === "/api/asistencia") {
      if (request.method === "GET") return listar(ctx);
      if (request.method === "POST") return guardar(ctx);
      return json({ ok: false, error: "Método no permitido" }, 405);
    }
    if (pathname === "/api/acceso") {
      if (request.method === "POST") return acceso(ctx);
      return json({ ok: false, error: "Método no permitido" }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};
