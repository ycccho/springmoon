export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path") || "";
  const customerId = url.searchParams.get("customerId") || "1610516";
  const downloadUrl = url.searchParams.get("downloadUrl") || "";

  if (!path) {
    return new Response(JSON.stringify({ error: "path parameter is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const accessLicense = "01000000003e8862c48a1f7ac679c6588c585e0dd35f9c064485960e8f6ff92b22c77c5e6b";
  const secretKey = "AQAAAAA+iGLEih96xnnGWIxYXg3TOQOrVq+wj1qrlppE2vLU7A==";

  const method = context.request.method;
  
  // Choose URL to call
  let targetUrlStr = "";
  let signPath = path;

  if (path === "/report-download") {
    if (!downloadUrl) {
      return new Response(JSON.stringify({ error: "downloadUrl is required for /report-download" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    targetUrlStr = downloadUrl;
    signPath = "/report-download";
  } else {
    const targetUrl = new URL(`https://api.searchad.naver.com${path}`);
    // Forward all query parameters except path, customerId, downloadUrl
    url.searchParams.forEach((value, key) => {
      if (key !== "path" && key !== "customerId" && key !== "downloadUrl") {
        targetUrl.searchParams.set(key, value);
      }
    });
    targetUrlStr = targetUrl.toString();
  }

  const timestamp = Date.now().toString();
  const message = `${timestamp}.${method}.${signPath}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const messageData = encoder.encode(message);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    const headers = {
      "X-Timestamp": timestamp,
      "X-API-KEY": accessLicense,
      "X-CUSTOMER": customerId,
      "X-Signature": base64Signature,
      "Accept": "application/json"
    };

    let fetchOptions = {
      method: method,
      headers: headers
    };

    if (method === "POST" && path !== "/report-download") {
      const bodyText = await context.request.text();
      fetchOptions.body = bodyText;
      fetchOptions.headers["Content-Type"] = "application/json; charset=UTF-8";
    }

    const naverResponse = await fetch(targetUrlStr, fetchOptions);

    // Forward response status and content-type headers
    const contentType = naverResponse.headers.get("Content-Type") || "";
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    
    if (contentType) {
      responseHeaders.set("Content-Type", contentType);
    }
    const responseContentEncoding = naverResponse.headers.get("Content-Encoding");
    if (responseContentEncoding) {
      responseHeaders.set("Content-Encoding", responseContentEncoding);
    }

    const bodyBuffer = await naverResponse.arrayBuffer();

    return new Response(bodyBuffer, {
      status: naverResponse.status,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Timestamp, X-API-KEY, X-CUSTOMER, X-Signature"
    }
  });
}
