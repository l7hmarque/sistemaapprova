// HTML simples para e-mails transacionais. Mantemos inline-style + cores neutras.

const BASE = (titulo: string, corpo: string, cta?: { url: string; label: string }) => `
<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title></head>
<body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#111;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-weight:700;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#111;">Approva</div>
    <h1 style="font-size:22px;margin:24px 0 12px;line-height:1.3;">${escapeHtml(titulo)}</h1>
    <div style="font-size:14px;line-height:1.6;color:#374151;">${corpo}</div>
    ${
      cta
        ? `<div style="margin:28px 0;"><a href="${cta.url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(cta.label)}</a></div><div style="font-size:12px;color:#6b7280;word-break:break-all;">Ou abra: ${cta.url}</div>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
    <div style="font-size:12px;color:#9ca3af;">Approva — prestação de contas para OSCs e escritórios contábeis.</div>
  </div>
</body></html>`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function tplBoasVindas(nomeOuEmail: string, urlPainel: string) {
  return {
    subject: "Bem-vindo à Approva",
    html: BASE(
      `Olá, ${escapeHtml(nomeOuEmail)}`,
      `<p>Sua conta foi criada com sucesso. Você já pode acessar o painel e começar a configurar sua organização.</p>`,
      { url: urlPainel, label: "Acessar painel" }
    ),
  };
}

export function tplConvite(orgNome: string, urlConvite: string, role: string) {
  return {
    subject: `Você foi convidado para ${orgNome} na Approva`,
    html: BASE(
      `Convite para ${escapeHtml(orgNome)}`,
      `<p>Você foi convidado(a) como <strong>${escapeHtml(role)}</strong>. Clique no botão abaixo para aceitar.</p>
       <p style="font-size:12px;color:#6b7280;">O link expira em alguns dias. Se você não esperava este convite, ignore este e-mail.</p>`,
      { url: urlConvite, label: "Aceitar convite" }
    ),
  };
}
