function normalizeFolderPath(pathStr) {
  if (!pathStr) return 'D:\\rank';
  return pathStr.replace(/[\/\\]+/g, '\\').replace(/\\$/, '');
}

export async function onRequestGet(context) {
  const kv = context.env.POWER_CONTENT_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "POWER_CONTENT_KV binding not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
    });
  }

  const { searchParams } = new URL(context.request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const rawFolder = searchParams.get('folderPath') || 'D:\\rank';
    const folderPath = normalizeFolderPath(rawFolder);
    const listKey = `screenshots:list:${folderPath}`;
    const listData = await kv.get(listKey);

    let finalData = listData;
    if (!finalData && rawFolder !== folderPath) {
      finalData = await kv.get(`screenshots:list:${rawFolder}`);
    }

    return new Response(finalData || JSON.stringify({ success: true, files: [] }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (action === 'view-file') {
    const rawFolder = searchParams.get('folderPath');
    const fileName = searchParams.get('fileName');
    if (!rawFolder || !fileName) {
      return new Response("Missing folderPath or fileName", { status: 400 });
    }

    const folderPath = normalizeFolderPath(rawFolder);
    let fileKey = `screenshots:file:${folderPath}:${fileName}`;
    let fileDataStr = await kv.get(fileKey);

    if (!fileDataStr && rawFolder !== folderPath) {
      fileDataStr = await kv.get(`screenshots:file:${rawFolder}:${fileName}`);
    }

    if (!fileDataStr) {
      return new Response("File not found in KV", { status: 404 });
    }

    try {
      const fileData = JSON.parse(fileDataStr);
      const binaryString = atob(fileData.base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return new Response(bytes.buffer, {
        headers: {
          'Content-Type': fileData.mimeType || 'image/jpeg',
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
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
    });
  }

  const { searchParams } = new URL(context.request.url);
  const action = searchParams.get('action');

  try {
    const body = await context.request.json();

    if (action === 'sync-list') {
      const { folderPath: rawFolder, files } = body;
      if (!rawFolder || !Array.isArray(files)) {
        return new Response(JSON.stringify({ error: "Invalid body parameters" }), { status: 400 });
      }

      const folderPath = normalizeFolderPath(rawFolder);
      const keyPrefix = `screenshots:file:${folderPath}:`;

      // kv.get()을 파일 수만큼 호출하면 Worker 리소스 한도(Error 1102)를 초과하므로
      // kv.list()로 본문 없이 키 목록만 조회해 O(1) 메모리/서브리퀘스트로 누락 파일 판별
      const existingKeys = new Set();
      let cursor = undefined;
      let pageCount = 0;
      const MAX_LIST_PAGES = 20;
      do {
        const listResult = await kv.list({ prefix: keyPrefix, cursor });
        for (const keyObj of listResult.keys) {
          existingKeys.add(keyObj.name);
        }
        cursor = listResult.list_complete ? undefined : listResult.cursor;
        pageCount++;
      } while (cursor && pageCount < MAX_LIST_PAGES);

      const missingFiles = [];
      for (const file of files) {
        const fileKey = `${keyPrefix}${file.fileName}`;
        if (!existingKeys.has(fileKey)) {
          missingFiles.push(file.fileName);
        }
      }

      const listData = JSON.stringify({ success: true, files });
      await kv.put(`screenshots:list:${folderPath}`, listData);
      if (rawFolder !== folderPath) {
        await kv.put(`screenshots:list:${rawFolder}`, listData);
      }

      return new Response(JSON.stringify({ success: true, missingFiles }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (action === 'upload-file') {
      const { folderPath: rawFolder, fileName, mimeType, base64Data } = body;
      if (!rawFolder || !fileName || !base64Data) {
        return new Response(JSON.stringify({ error: "Invalid upload parameters" }), { status: 400 });
      }

      const folderPath = normalizeFolderPath(rawFolder);
      const val = JSON.stringify({ mimeType, base64Data });

      await kv.put(`screenshots:file:${folderPath}:${fileName}`, val);
      if (rawFolder !== folderPath) {
        await kv.put(`screenshots:file:${rawFolder}:${fileName}`, val);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
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
