const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function isCode(value) { return /^\d{10}$/.test(value || ""); }
function isExpired(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) && t < Date.now();
}
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
function adminOK(req, env) {
  return !!env.ADMIN_KEY && req.headers.get("X-YEXUX-Admin-Key") === env.ADMIN_KEY;
}

async function rowFor(env, code) {
  return await env.DB.prepare("SELECT * FROM invites WHERE code=?").bind(code).first();
}

async function normalizeStatus(env, row) {
  if (!row) return null;
  if (row.status === "PENDENTE" && isExpired(row.expires_at)) {
    await env.DB.prepare(
      "UPDATE invites SET status='EXPIRADO' WHERE code=? AND status='PENDENTE'"
    ).bind(row.code).run();
    row.status = "EXPIRADO";
  }
  return row;
}

function activationPage(origin, row) {
  const code = row.code;
  const service = encodeURIComponent(origin);
  const deep = `yexux://ativar?code=${code}&service=${service}`;
  const disabled = row.status !== "PENDENTE";
  const label = row.status === "PENDENTE"
    ? "Convite pronto para ativação"
    : `Convite ${String(row.status).toLowerCase()}`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ativar acesso - CONTABILIZADOR YEXUX</title>
<style>
:root{font-family:Segoe UI,Arial,sans-serif;color:#18324a;background:#eef4f8}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
.card{max-width:620px;width:100%;background:#fff;border:1px solid #d8e3f0;border-radius:18px;padding:34px;box-shadow:0 14px 40px rgba(20,50,80,.10)}
h1{margin:0 0 8px;font-size:26px}.code{font-size:30px;font-weight:800;letter-spacing:3px;color:#032f67;margin:18px 0}
.actions{display:grid;gap:12px;margin-top:22px}a{display:block;text-align:center;text-decoration:none;font-weight:700;padding:14px 18px;border-radius:10px}
.activate{background:#032f67;color:#fff}.download{background:#eaf1f7;color:#032f67}.muted{color:#66778a;line-height:1.55}.status{font-weight:700;color:#269c45}.disabled{opacity:.45;pointer-events:none}
</style></head><body><main class="card">
<h1>CONTABILIZADOR YEXUX</h1><div class="status">${esc(label)}</div>
<p class="muted">Código de ativação:</p><div class="code">${esc(code)}</div>
<p class="muted">Se o YEXUX já estiver instalado, clique em ativar. Caso contrário, instale primeiro e depois volte a este link.</p>
<div class="actions"><a class="activate ${disabled ? "disabled" : ""}" href="${deep}">ATIVAR MEU ACESSO</a>
<a class="download" href="${esc(row.setup_url)}">BAIXAR CONTABILIZADOR YEXUX</a></div>
<p class="muted">Convite pessoal, intransferível e de uso único.</p>
</main></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "YEXUX Convites", version: "2.1.1" });
      }

      if (path === "/api/invites" && request.method === "POST") {
        if (!adminOK(request, env)) return json({ ok:false, error:"Não autorizado." }, 401);
        const body = await request.json();
        if (!isCode(body.code)) return json({ ok:false, error:"Código deve ter 10 dígitos." }, 400);
        if (!body.invite_id || !body.email || !body.perfil || !body.token || !body.token_hash || !body.setup_url || !body.expires_at) {
          return json({ ok:false, error:"Dados obrigatórios ausentes." }, 400);
        }
        if (await rowFor(env, body.code)) return json({ ok:false, error:"Código já existe." }, 409);
        await env.DB.prepare(
          `INSERT INTO invites(code,invite_id,nome,email,perfil,token,token_hash,setup_url,status,issued_at,expires_at)
           VALUES(?,?,?,?,?,?,?,?,'PENDENTE',?,?)`
        ).bind(
          body.code, body.invite_id, body.nome || "", String(body.email).toLowerCase(), body.perfil,
          body.token, body.token_hash, body.setup_url, body.issued_at || new Date().toISOString(), body.expires_at
        ).run();
        return json({ ok:true, code:body.code, activation_url:`${url.origin}/ativar/${body.code}` }, 201);
      }

      let m = path.match(/^\/api\/invites\/(\d{10})\/(resolve|status|activate|cancel)$/);
      if (m) {
        const code = m[1], action = m[2];
        let row = await normalizeStatus(env, await rowFor(env, code));
        if (!row) return json({ ok:false, error:"Convite não encontrado." }, 404);

        if (action === "status" && request.method === "GET") {
          return json({ ok:true, code, status:row.status, expires_at:row.expires_at, activated_at:row.activated_at || "" });
        }
        if (action === "resolve" && request.method === "GET") {
          if (row.status !== "PENDENTE") return json({ ok:false, error:`Convite ${String(row.status).toLowerCase()}.` }, 409);
          return json({ ok:true, code, status:row.status, token:row.token, expires_at:row.expires_at });
        }
        if (action === "activate" && request.method === "POST") {
          if (row.status !== "PENDENTE") return json({ ok:false, error:`Convite ${String(row.status).toLowerCase()}.` }, 409);
          const body = await request.json();
          if (!body.token_hash || body.token_hash !== row.token_hash) return json({ ok:false, error:"Validação do convite falhou." }, 403);
          const now = new Date().toISOString();
          await env.DB.prepare(
            "UPDATE invites SET status='ATIVADO',activated_at=? WHERE code=? AND status='PENDENTE'"
          ).bind(now, code).run();
          return json({ ok:true, code, status:"ATIVADO", activated_at:now });
        }
        if (action === "cancel" && request.method === "POST") {
          if (!adminOK(request, env)) return json({ ok:false, error:"Não autorizado." }, 401);
          if (row.status !== "PENDENTE") return json({ ok:false, error:"Somente convite pendente pode ser cancelado." }, 409);
          const now = new Date().toISOString();
          await env.DB.prepare(
            "UPDATE invites SET status='CANCELADO',cancelled_at=? WHERE code=?"
          ).bind(now, code).run();
          return json({ ok:true, code, status:"CANCELADO" });
        }
      }

      m = path.match(/^\/ativar\/(\d{10})$/);
      if (m && request.method === "GET") {
        const row = await normalizeStatus(env, await rowFor(env, m[1]));
        if (!row) return new Response("Convite não encontrado.", { status:404, headers:{"content-type":"text/plain; charset=utf-8"} });
        return new Response(activationPage(url.origin, row), {
          status:200,
          headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}
        });
      }

      return json({ ok:false, error:"Rota não encontrada." }, 404);
    } catch (e) {
      return json({ ok:false, error:String(e && e.message ? e.message : e) }, 500);
    }
  }
};
