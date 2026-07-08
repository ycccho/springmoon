export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const { searchParams } = new URL(context.request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const folderPath = searchParams.get('folderPath') || 'D:\\rank';
    const listKey = `screenshots:list:${folderPath}`;
    const listData = await kv.get(listKey);
    return new Response(listData || JSON.stringify({ success: true, files: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (action === 'view-file') {
    const folderPath = searchParams.get('folderPath');
    const fileName = searchParams.get('fileName');
    if (!folderPath || !fileName) {
      return new Response("Missing folderPath or fileName", { status: 400 });
    }

    const fileKey = `screenshots:file:${folderPath}:${fileName}`;
    const fileDataStr = await kv.get(fileKey);
    if (!fileDataStr) {
      return new Response("File not found in KV", { status: 404 });
    }

    try {
      const fileData = JSON.parse(fileDataStr);
      // Decode base64 string to binary array
      const binaryString = atob(fileData.base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return new Response(bytes.buffer, {
        headers: {
          'Content-Type': fileData.mimeType || 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    } catch (e) {
      return new Response("Error decoding file: " + e.message, { status: 500 });
    }
  }

  return new Response("Invalid GET action", { status: 400 });
}

export async function onRequestPost(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const { searchParams } = new URL(context.request.url);
  const action = searchParams.get('action');

  try {
    const body = await context.request.json();

    if (action === 'sync-list') {
      const { folderPath, files } = body;
      if (!folderPath || !Array.isArray(files)) {
        return new Response(JSON.stringify({ error: "Invalid body parameters" }), { status: 400 });
      }

      // Check which files are missing in KV to optimize upload bandwidth
      const missingFiles = [];
      for (const file of files) {
        const fileKey = `screenshots:file:${folderPath}:${file.fileName}`;
        const existing = await kv.get(fileKey, { type: "text" });
        if (!existing) {
          missingFiles.push(file.fileName);
        }
      }

      // Save list metadata
      const listKey = `screenshots:list:${folderPath}`;
      await kv.put(listKey, JSON.stringify({ success: true, files }));

      return new Response(JSON.stringify({ success: true, missingFiles }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (action === 'upload-file') {
      const { folderPath, fileName, mimeType, base64Data } = body;
      if (!folderPath || !fileName || !base64Data) {
        return new Response(JSON.stringify({ error: "Invalid upload parameters" }), { status: 400 });
      }

      const fileKey = `screenshots:file:${folderPath}:${fileName}`;
      await kv.put(fileKey, JSON.stringify({ mimeType, base64Data }));

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  return new Response("Invalid POST action", { status: 400 });
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
