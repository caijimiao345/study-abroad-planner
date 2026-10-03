// Cloudflare Pages Functions 代理：/api/* → Worker
// 借鉴 Uptime-Monitor：前端同源访问、国内无需访问 workers.dev 域名、免 CORS 配置。
// Pages 环境变量需设置 WORKER_URL（Worker 地址），未设置时返回明确错误。
export async function onRequest(context) {
  const { request, env } = context;
  const workerBase = env.WORKER_URL;
  if (!workerBase) {
    return new Response(JSON.stringify({ error: 'WORKER_URL environment variable is not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const url = new URL(request.url);
  const target = workerBase.replace(/\/$/, '') + url.pathname + url.search;
  return await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });
}
