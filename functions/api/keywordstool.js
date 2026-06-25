export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const keywords = url.searchParams.get("keywords") || "";
  const customerId = url.searchParams.get("customerId") || "";

  if (!keywords) {
    return new Response(JSON.stringify({ error: "조회할 키워드를 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!customerId) {
    return new Response(JSON.stringify({ error: "Customer ID가 제공되지 않았습니다. 홈페이지 화면에서 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const accessLicense = "01000000003e8862c48a1f7ac679c6588c585e0dd35f9c064485960e8f6ff92b22c77c5e6b";
  const secretKey = "AQAAAAA+iGLEih96xnnGWIxYXg3TOQOrVq+wj1qrlppE2vLU7A==";

  const method = "GET";
  const uri = "/keywordstool";

  const allKeywords = keywords.split(",")
    .map(k => k.trim().replace(/\s+/g, ""))
    .filter(k => k.length > 0);

  // Group keywords into chunks of 5 (Naver API limit per request)
  const chunks = [];
  for (let i = 0; i < allKeywords.length; i += 5) {
    chunks.push(allKeywords.slice(i, i + 5));
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);

  try {
    const fetchPromises = chunks.map(async (chunk) => {
      const apiTargetUrl = new URL("https://api.naver.com/keywordstool");
      apiTargetUrl.searchParams.set("hintKeywords", chunk.join(","));
      apiTargetUrl.searchParams.set("showDetail", "1");

      const timestamp = Date.now().toString();
      const message = `${timestamp}.${method}.${uri}`;

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

      const naverResponse = await fetch(apiTargetUrl.toString(), {
        method: "GET",
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": accessLicense,
          "X-CUSTOMER": customerId,
          "X-Signature": base64Signature,
          "Accept": "application/json"
        }
      });

      if (!naverResponse.ok) {
        const errorText = await naverResponse.text();
        throw new Error(`Naver API returned status ${naverResponse.status}: ${errorText}`);
      }

      return naverResponse.json();
    });

    const results = await Promise.all(fetchPromises);
    
    // Merge results from all chunks
    const mergedList = [];
    results.forEach(res => {
      if (res && res.keywordList) {
        mergedList.push(...res.keywordList);
      }
    });

    return new Response(JSON.stringify({ keywordList: mergedList }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
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
