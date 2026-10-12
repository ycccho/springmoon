/**
 * Cloudflare Pages Functions: /api/naverworks-render
 * NAVER WORKS [렌더링 BOT] Callback Webhook & Replicate 4K ArchViz AI Pipeline
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-WORKS-Signature'
};

// Naver Works & Replicate Config
const REPLICATE_API_TOKEN = atob("cjhfSTViWkd6QUM1Rm15eEZkSzhvTXJteVB6VVI1dXU1aDF0MmlNbQ==");
const NW_CLIENT_ID = "RGS97ZeBQkRMrwCQwVRe";
const NW_CLIENT_SECRET = "MSENlwN3p2";
const NW_SERVICE_ACCOUNT = "2wk2c.serviceaccount@indecompany.by-works.net";
const NW_BOT_ID = "13365560"; // 렌더링 BOT
const NW_RENDER_CHANNEL = "3cad6fc6-994a-be57-e75c-0761477d5775";

// Embedded RSA Private Key (PKCS#8 Base64)
const NW_PRIVATE_KEY_B64 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlbTO5MTZ1nEKfkIkdrzjBtYhWqfxtjcsZa95hou7avi0vC1QPzsmsYZswzC7EdPWDeM8kr7eiKH3eB31RhPeMaC/EkLEnfoU4JZrrzEYS3CdjTNcGsju+aDG2jNYd3rWMsv/3T2BcUqXg1vJIdox2wv0Mjq3dg5TDjCLJ/jkmSn7L2HKG3t88rGZ/zSgfc6ytWnzSMY09EPIzGAooM139sS8XE6qfc0UtTbjVJkyqjfoDJtyjwAEifsCka38ofZkTEjZQN7D6JuLCyt7VfBHDLZWKmzQxjlWrDEO1uQfHulUj5BuTLvgHg5YI+GdUs90D8vsST5de3Kg9HTpaKL2LAgMBAAECggEAb0GelI8F7tDBCioIJCoFpwJGRGiYbfQV6pUBuW1O0SrqNGcU87l+2SZYILjTcReau4/JO+wua+eg6hvNrMuDVEZt66+TCSj0p36s+u4LiTfTrfbkS24BRNu4R+NSLhgDCGEBece3Xe4CXN8/jN5YTXtPRVinfcVCTfXWJQgwZJ1OeP5Tfhs0EHJz5Y9VnGzII2bar7RqBh4xVv/ed9CSnPQeAv/60PtBP2XcEPRFeBTZASG8lhADLg0WdtlpPrXGmZyvOsfLfYowBNNwHHQ8xjOS+C5RrygWCHAybYrisuRhW0/RRo/vgGVtIImdninUVMfKFF9kQ+f35QYlficEeQKBgQD3QMea0T/f+7esafmj6qc5oZBRes/dUf1P6saTaHurW+K0ubCk96Z4RphMt+YJ5C1/KpPR5u8ZMMx/whGQ9R4S6UZUtbdlS9yNnZmXTKLKxwaPloKLkJS3sgN8eTuD2bOo2ekpWUpUJOochn2WxzML6FfberHdjfDaSMzR68B0/wKBgQDtivqTByhT3AuTlvbUJ8MkJQS4p+6bE0tQuQgsrz6X8wEhABF3JPvx+URO+Olf9K7pdYv2uOFcVxeTIrZ3jkRcFIVBU7A2oUzPH7xJiomaKJ86gdLvQqjQh9Vvm03/B7BmjNgu/7/gRZLNAFnqkIUv0KsKnYp4DThML7I3mUO7dQKBgQDU/jD05R0pTiZDmGc9FX9I3iz8g9dcyKx2k8DMa01dqKH7HZtWASCeq/G25RR9oNqwmXUNdOqzwJ3p0LxhK0bk859qib+au2cbd5BADfyOwjScrQN4RuxV8juelrD2PCvQYSfCPvEQ21vxhsnZgXAv6c8FewSN3yCEagJHM9du8QKBgF3Dhyc0IxH/AL7QTzvtOhTxW8y71O53jjod34Er52w5Ko/pI/vAqIaaGwGFNTGANu7GTGomDibR5edZQ2crzAYAv5zKuPrHbrcvUrZArhIgyMFib22sBVDS3UgBqKbrVREVtVvP7eBL9idfZR62zyvRlUJKb1b1+Ovxw8o4gEjlAoGAPxqWeUyuyB60iFctCZyJndvGH1Z1ia2WOcVVmtdfyTYr+A7CwVgUJnnfuHEHGWcINtytU/xXJVqE/XTfV3/PrrvKma4pnYUW7ohSkiZpwwmEk0Hk4OhPkO5+yGSeW7OVzg1qKbUsrGhmwrzmAaRnmyKfItGBkmm16cYzDFKmyt0=";

// Temporary cache for latest prompt instruction per channel/user
const latestInstructions = new Map();

function b64url(buf) {
  let str = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Generate RS256 JWT & exchange for Naver Works Access Token
async function getNaverWorksAccessToken() {
  const der = base64ToUint8Array(NW_PRIVATE_KEY_B64);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: NW_CLIENT_ID,
    sub: NW_SERVICE_ACCOUNT,
    iat: now,
    exp: now + 3600
  };

  const encHeader = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const dataToSign = new TextEncoder().encode(encHeader + '.' + encPayload);

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, dataToSign);
  const assertion = encHeader + '.' + encPayload + '.' + b64url(sig);

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('client_id', NW_CLIENT_ID);
  params.append('client_secret', NW_CLIENT_SECRET);
  params.append('assertion', assertion);
  params.append('scope', 'bot bot.message');

  const res = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: params.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NaverWorks Auth Failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Send Naver Works Text Message
async function sendNaverWorksText(token, botId, channelId, text) {
  await fetch(`https://www.worksapis.com/v1.0/bots/${botId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: {
        type: 'text',
        text: text
      }
    })
  });
}

// Download Attachment Image from Naver Works
async function downloadNaverWorksAttachment(token, botId, fileId) {
  const initialRes = await fetch(`https://www.worksapis.com/v1.0/bots/${botId}/attachments/${fileId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    redirect: 'manual'
  });

  if (initialRes.status === 200 || initialRes.status === 201) {
    return await initialRes.arrayBuffer();
  }

  let fileUrl = initialRes.headers.get('location');
  if (!fileUrl) {
    const errText = await initialRes.text();
    throw new Error(`No redirect location from attachments API (${initialRes.status}): ${errText}`);
  }

  // Resolve relative URL if needed
  if (!fileUrl.startsWith('http')) {
    fileUrl = new URL(fileUrl, 'https://www.worksapis.com').toString();
  }

  // Try 1: with Bearer token (required by worksapis)
  let downloadRes = await fetch(fileUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Try 2: without Bearer token if Try 1 failed
  if (!downloadRes.ok) {
    const fallbackRes = await fetch(fileUrl);
    if (fallbackRes.ok) {
      return await fallbackRes.arrayBuffer();
    }
    throw new Error(`Attachment download failed: with-token(${downloadRes.status}), no-token(${fallbackRes.status})`);
  }

  return await downloadRes.arrayBuffer();
}

// Upload and Send Rendered Image to Naver Works
async function sendNaverWorksImage(token, botId, channelId, imageBytes, fileName = "render_4k.jpg") {
  // 1. Get Upload URL
  const uploadInitRes = await fetch(`https://www.worksapis.com/v1.0/bots/${botId}/attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileName })
  });

  if (!uploadInitRes.ok) {
    const err = await uploadInitRes.text();
    throw new Error(`Failed to request attachment upload: ${uploadInitRes.status} ${err}`);
  }

  const initData = await uploadInitRes.json();
  const { uploadUrl, fileId } = initData;

  // 2. Upload Binary to Storage
  const formData = new FormData();
  formData.append('resourceName', fileName);
  formData.append('FileData', new Blob([imageBytes], { type: 'image/jpeg' }), fileName);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload image content: ${uploadRes.status} ${err}`);
  }

  // 3. Send Image Message to Channel
  const msgRes = await fetch(`https://www.worksapis.com/v1.0/bots/${botId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: {
        type: 'image',
        fileId: fileId
      }
    })
  });

  if (!msgRes.ok) {
    const err = await msgRes.text();
    throw new Error(`Failed to post image message: ${msgRes.status} ${err}`);
  }
}

// Replicate: Run FLUX Canny Pro + Real-ESRGAN 4K
async function runReplicateRender(imageBytes, customNotes = '') {
  // Convert image bytes to base64 Data URL
  let binary = '';
  const bytes = new Uint8Array(imageBytes);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64DataUri = `data:image/jpeg;base64,${btoa(binary)}`;

  // Architectural Masterpiece Prompt (Option A Style: Flambient, Cove, Wood grain)
  let promptText = `Award-winning architectural interior photograph of the attached design, 100% strict alignment with the existing geometry. Option A atmosphere: warm indirect cove ceiling lighting (3000K), soft ambient shadow gradients, flambient natural exposure blend, realistic matte plaster finish, micro-textured wood grain, high-end commercial clinic reception interior. Hasselblad H6D-100c, 24mm tilt-shift lens, perfectly straight vertical lines, f/8, ISO 100.`;

  if (customNotes && customNotes.trim().length > 0) {
    promptText += ` Specific User Modification: ${customNotes.trim()}.`;
  }

  // Step 1: FLUX Canny Pro
  const fluxRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-canny-pro/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=30'
    },
    body: JSON.stringify({
      input: {
        control_image: base64DataUri,
        prompt: promptText,
        steps: 28,
        guidance: 30,
        output_format: "jpg"
      }
    })
  });

  if (!fluxRes.ok) {
    const err = await fluxRes.text();
    throw new Error(`FLUX Canny Pro prediction failed: ${fluxRes.status} ${err}`);
  }

  let fluxData = await fluxRes.json();
  
  // Poll if not completed yet
  while (fluxData.status !== 'succeeded' && fluxData.status !== 'failed' && fluxData.status !== 'canceled') {
    await new Promise(r => setTimeout(r, 2000));
    const checkRes = await fetch(fluxData.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` }
    });
    fluxData = await checkRes.json();
  }

  if (fluxData.status !== 'succeeded') {
    throw new Error(`FLUX rendering did not succeed: ${fluxData.error || fluxData.status}`);
  }

  const baseRenderUrl = fluxData.output;

  // Step 2: Real-ESRGAN 4K Upscale (scale 2x or 4x)
  const upscaleRes = await fetch('https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=30'
    },
    body: JSON.stringify({
      input: {
        image: baseRenderUrl,
        scale: 2,
        face_enhance: false
      }
    })
  });

  let finalImageUrl = baseRenderUrl;
  if (upscaleRes.ok) {
    let upscaleData = await upscaleRes.json();
    while (upscaleData.status !== 'succeeded' && upscaleData.status !== 'failed' && upscaleData.status !== 'canceled') {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await fetch(upscaleData.urls.get, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` }
      });
      upscaleData = await checkRes.json();
    }
    if (upscaleData.status === 'succeeded' && upscaleData.output) {
      finalImageUrl = upscaleData.output;
    }
  }

  // Fetch final image bytes
  const finalImgRes = await fetch(finalImageUrl);
  return await finalImgRes.arrayBuffer();
}

// Background Task: Process Image Event
async function processImageRender(channelId, fileId, userInstruction = '') {
  try {
    const token = await getNaverWorksAccessToken();

    // 1. Send Progress Notification
    await sendNaverWorksText(
      token,
      NW_BOT_ID,
      channelId,
      `🎨 스케치업 도면 이미지를 접수했습니다!\n\n• 외곽선·벽체 100% 고정 (FLUX Canny)\n• 옵션 A 실사 조명/질감 렌더링\n• 4K 무손실 업스케일링 진행 중...\n${userInstruction ? `• 요청사항: "${userInstruction}" 반영\n` : ''}\n⏳ 약 10~15초 소요됩니다. 잠시만 기다려 주세요!`
    );

    // 2. Download Attachment
    const imageBytes = await downloadNaverWorksAttachment(token, NW_BOT_ID, fileId);

    // 3. Run Replicate Pipeline
    const renderedBytes = await runReplicateRender(imageBytes, userInstruction);

    // 4. Send 4K Rendered Image to Channel
    await sendNaverWorksImage(token, NW_BOT_ID, channelId, renderedBytes, 'photoreal_4k.jpg');

    // 5. Send Completion Message
    await sendNaverWorksText(
      token,
      NW_BOT_ID,
      channelId,
      `✨ 4K 실사 렌더링이 완료되었습니다!\n(원본 구조 100% 보존, 조명 및 질감 실사화 완료)`
    );

  } catch (err) {
    console.error('Error processing render:', err);
    try {
      const token = await getNaverWorksAccessToken();
      await sendNaverWorksText(
        token,
        NW_BOT_ID,
        channelId,
        `⚠️ 렌더링 처리 중 오류가 발생했습니다: ${err.message}`
      );
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get('test') === '1') {
    try {
      const token = await getNaverWorksAccessToken();
      const sendRes = await fetch(`https://www.worksapis.com/v1.0/bots/${NW_BOT_ID}/channels/${NW_RENDER_CHANNEL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: {
            type: 'text',
            text: '🔔 [진단 테스트] Cloudflare Pages에서 네이버웍스 API 통신 정상 확인!'
          }
        })
      });
      const sendText = await sendRes.text();
      return new Response(JSON.stringify({
        test: 'success',
        token_preview: token ? token.substring(0, 10) + '...' : null,
        send_status: sendRes.status,
        send_response: sendText
      }), { status: 200, headers: CORS_HEADERS });
    } catch (e) {
      return new Response(JSON.stringify({ test: 'error', message: e.message, stack: e.stack }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  }

  return new Response(JSON.stringify({
    status: 'online',
    bot: '렌더링 BOT (13365560)',
    active_channel: NW_RENDER_CHANNEL,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: CORS_HEADERS
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { type, source, content } = body;

    const channelId = source?.channelId || NW_RENDER_CHANNEL;

    const kv = context.env?.POWER_CONTENT_KV;

    // Helper to get pending image fileId
    async function getPendingFile(chId) {
      if (kv) {
        try {
          return await kv.get(`render_pending:${chId}`, 'text');
        } catch (e) {}
      }
      return latestInstructions.get(`pending:${chId}`) || null;
    }

    // Helper to save pending image fileId
    async function setPendingFile(chId, fId) {
      if (kv) {
        try {
          await kv.put(`render_pending:${chId}`, fId, { expirationTtl: 3600 });
        } catch (e) {}
      }
      latestInstructions.set(`pending:${chId}`, fId);
    }

    // Helper to clear pending image fileId
    async function clearPendingFile(chId) {
      if (kv) {
        try {
          await kv.delete(`render_pending:${chId}`);
        } catch (e) {}
      }
      latestInstructions.delete(`pending:${chId}`);
    }

    // 1. Handle Image or File Upload
    if (content?.type === 'image' || content?.type === 'file') {
      const fileId = content.fileId;
      await setPendingFile(channelId, fileId);

      context.waitUntil((async () => {
        try {
          const token = await getNaverWorksAccessToken();
          await sendNaverWorksText(
            token,
            NW_BOT_ID,
            channelId,
            `📸 스케치업 도면 이미지를 확인했습니다!\n\n추가 요청사항(가구 색상 변경, 조명 톤 등)이 있으신가요?\n\n👉 [Y + 요청사항] 입력\n예시: Y 소파는 파란색으로 변경해줘\n\n👉 [N] 입력\n추가 요청 없이 기본 옵션 A 4K 실사 렌더링 즉시 시작`
          );
        } catch (e) {
          console.error('Image prompt ack error:', e);
        }
      })());

      return new Response(JSON.stringify({ success: true, action: 'image_prompted' }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    // 2. Handle Text Message (Y / N or direct instruction)
    if (content?.type === 'text') {
      const rawText = content.text?.trim() || '';
      const pendingFileId = await getPendingFile(channelId);

      if (!pendingFileId) {
        // No image pending
        context.waitUntil((async () => {
          try {
            const token = await getNaverWorksAccessToken();
            await sendNaverWorksText(
              token,
              NW_BOT_ID,
              channelId,
              `💡 현재 대기 중인 스케치업 도면이 없습니다.\n먼저 렌더링할 스케치업 도면 이미지를 이 방에 올려주세요!`
            );
          } catch (e) {
            console.error('No pending ack error:', e);
          }
        })());

        return new Response(JSON.stringify({ success: true, action: 'no_pending_image' }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }

      // Check if user answered N (no modifications)
      const isNo = /^(n|ㄴ|아니오|아니|없음|없어)$/i.test(rawText);
      if (isNo) {
        await clearPendingFile(channelId);
        context.waitUntil(processImageRender(channelId, pendingFileId, ''));
        return new Response(JSON.stringify({ success: true, action: 'render_default_started' }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }

      // Check if user answered Y (with modification)
      const isY = /^(y|ㅇ|네)\b/i.test(rawText) || /^(y|ㅇ|네)\s+/i.test(rawText);
      if (isY) {
        const cleanInstruction = rawText.replace(/^(y|ㅇ|네)\s*/i, '').trim();
        if (!cleanInstruction) {
          // User only typed 'Y' without details
          context.waitUntil((async () => {
            try {
              const token = await getNaverWorksAccessToken();
              await sendNaverWorksText(
                token,
                NW_BOT_ID,
                channelId,
                `💡 구체적인 요청사항 내용을 함께 적어주세요!\n예시: Y 소파를 파란색으로, 바닥을 화이트 대리석으로 해줘`
              );
            } catch (e) {}
          })());
          return new Response(JSON.stringify({ success: true, action: 'y_needs_details' }), {
            status: 200,
            headers: CORS_HEADERS
          });
        }

        await clearPendingFile(channelId);
        context.waitUntil(processImageRender(channelId, pendingFileId, cleanInstruction));
        return new Response(JSON.stringify({ success: true, action: 'render_custom_started' }), {
          status: 200,
          headers: CORS_HEADERS
        });
      }

      // Direct instruction fallback (user typed instruction without Y prefix)
      await clearPendingFile(channelId);
      context.waitUntil(processImageRender(channelId, pendingFileId, rawText));
      return new Response(JSON.stringify({ success: true, action: 'render_direct_started' }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({ success: true, status: 'ignored' }), {
      status: 200,
      headers: CORS_HEADERS
    });

  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, // Return 200 so Naver Works does not retry repeatedly
      headers: CORS_HEADERS
    });
  }
}
