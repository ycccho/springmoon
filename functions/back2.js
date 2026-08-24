// Cloudflare Pages Function for /back2 route
export async function onRequestGet(context) {
  // Fetch the static back2.html file from ASSETS
  if (context.env && context.env.ASSETS) {
    const res = await context.env.ASSETS.fetch(new URL('/back2.html', context.request.url));
    if (res.ok) {
      return new Response(await res.text(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }
  }
  
  // Fallback direct response
  return context.next();
}
