const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-signature, authorization",
};

const FREE_ANSWER_KEYS = [
  "status",
  "intent",
  "quality",
  "element",
  "setting",
  "block",
  "secure",
  "mirror",
  "pace",
  "birthdate",
];

const PAID_ANSWER_KEYS = [
  "activation",
  "pastPattern",
  "reassurance",
  "conflict",
  "partnerEnergy",
  "boundary",
  "trustSignal",
  "guidance",
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/api/readings") {
        return json(await createReading(request, env), 201);
      }

      if (request.method === "POST" && url.pathname === "/api/create-checkout") {
        return json(await createCheckout(request, env), 201);
      }

      if (request.method === "POST" && url.pathname === "/api/webhooks/lemon-squeezy") {
        return json(await handleLemonSqueezyWebhook(request, env));
      }

      const paidSignalsMatch = url.pathname.match(/^\/api\/readings\/([0-9a-f-]+)\/paid-signals$/i);
      if (request.method === "POST" && paidSignalsMatch) {
        return json(await submitPaidSignals(paidSignalsMatch[1], request, env));
      }

      if (request.method === "POST" && url.pathname === "/api/jobs/process") {
        return json(await processNextReportJob(request, env));
      }

      if (request.method === "POST" && url.pathname === "/api/test-email") {
        return json(await sendTestEmail(request, env));
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/api/health/supabase") {
        return json(await checkSupabaseHealth(env));
      }

      if (request.method === "GET" && url.pathname === "/api/health/email") {
        return json(await checkEmailHealth(env));
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error(error);
      const status = error.status || 500;
      return json({ error: status === 500 ? "Internal server error" : error.message }, status);
    }
  },
};

async function createReading(request, env) {
  const body = await readJson(request);
  const freeAnswers = pickAnswers(body.free_answers || body.freeAnswers || body, FREE_ANSWER_KEYS);
  requireAnswers(freeAnswers, FREE_ANSWER_KEYS, "free answers");

  const rows = await supabase(env, "/rest/v1/readings?select=id,status", {
    method: "POST",
    body: {
      status: "previewed",
      free_answers_json: freeAnswers,
    },
    prefer: "return=representation",
  });

  return {
    reading_id: rows[0].id,
    status: rows[0].status,
  };
}

async function checkSupabaseHealth(env) {
  const configured = {
    supabase_url: Boolean(env.SUPABASE_URL),
    supabase_service_role_key: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (!configured.supabase_url || !configured.supabase_service_role_key) {
    return {
      ok: false,
      configured,
      error: "Supabase environment variables are missing",
    };
  }

  try {
    const rows = await supabase(env, "/rest/v1/readings?select=id&limit=1");
    return {
      ok: true,
      configured,
      reachable: true,
      sample_count: Array.isArray(rows) ? rows.length : 0,
    };
  } catch (error) {
    return {
      ok: false,
      configured,
      reachable: false,
      error: error.message,
    };
  }
}

async function checkEmailHealth(env) {
  const configured = {
    resend_api_key: Boolean(env.RESEND_API_KEY),
    from_email: Boolean(env.FROM_EMAIL),
    support_email: Boolean(env.SUPPORT_EMAIL),
  };

  if (!configured.resend_api_key) {
    return {
      ok: false,
      configured,
      error: "Resend API key is missing",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
    });

    return {
      ok: response.ok,
      configured,
      reachable: response.ok,
      resend_status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      configured,
      reachable: false,
      error: error.message,
    };
  }
}

async function createCheckout(request, env) {
  requireEnv(env, [
    "LEMON_SQUEEZY_API_KEY",
    "LEMON_SQUEEZY_STORE_ID",
    "LEMON_SQUEEZY_VARIANT_ID",
  ]);

  const body = await readJson(request);
  const readingId = requireUuid(body.reading_id || body.readingId, "reading_id");
  const email = optionalEmail(body.email);
  const reading = await getReading(env, readingId);

  if (!reading) {
    throw httpError(404, "Reading not found");
  }

  const siteUrl = env.SITE_URL || "https://yourloveelement.com";
  const checkout = await lemonSqueezy(env, "/v1/checkouts", {
    method: "POST",
    body: {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: email || undefined,
            custom: {
              reading_id: readingId,
            },
          },
          product_options: {
            redirect_url: `${siteUrl}/full-report/?reading_id=${encodeURIComponent(readingId)}`,
            receipt_button_text: "Complete your full report",
            receipt_link_url: `${siteUrl}/full-report/?reading_id=${encodeURIComponent(readingId)}`,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: String(env.LEMON_SQUEEZY_STORE_ID),
            },
          },
          variant: {
            data: {
              type: "variants",
              id: String(env.LEMON_SQUEEZY_VARIANT_ID),
            },
          },
        },
      },
    },
  });

  const checkoutUrl = checkout.data?.attributes?.url;
  const checkoutId = checkout.data?.id;
  if (!checkoutUrl) {
    throw httpError(502, "Checkout URL was not returned");
  }

  await supabase(env, `/rest/v1/readings?id=eq.${readingId}`, {
    method: "PATCH",
    body: {
      status: "checkout_created",
      customer_email: email || reading.customer_email,
      lemon_squeezy_checkout_id: checkoutId || null,
      checkout_url: checkoutUrl,
      checkout_created_at: new Date().toISOString(),
    },
  });

  return {
    reading_id: readingId,
    checkout_url: checkoutUrl,
  };
}

async function handleLemonSqueezyWebhook(request, env) {
  requireEnv(env, ["LEMON_SQUEEZY_WEBHOOK_SECRET"]);

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") || "";
  const expected = await hmacHex(env.LEMON_SQUEEZY_WEBHOOK_SECRET, rawBody);

  if (!timingSafeEqual(signature, expected)) {
    throw httpError(401, "Invalid webhook signature");
  }

  const event = JSON.parse(rawBody);
  const eventName = event.meta?.event_name || "unknown";
  const externalEventId = event.meta?.webhook_id || event.data?.id || null;

  let webhookRows = [];
  try {
    webhookRows = await supabase(env, "/rest/v1/webhook_events?select=id", {
      method: "POST",
      body: {
        provider: "lemon_squeezy",
        event_name: eventName,
        external_event_id: externalEventId,
        payload_json: event,
      },
      prefer: "return=representation",
    });
  } catch (error) {
    if (!String(error.message).includes("duplicate key")) {
      throw error;
    }
  }

  if (eventName !== "order_created" && eventName !== "order_refunded") {
    await markWebhookProcessed(env, webhookRows[0]?.id);
    return { ok: true, ignored: true };
  }

  const readingId = event.meta?.custom_data?.reading_id || event.data?.attributes?.custom_data?.reading_id;
  if (!readingId) {
    await markWebhookProcessed(env, webhookRows[0]?.id, "Missing reading_id");
    return { ok: true, ignored: true };
  }

  const attrs = event.data?.attributes || {};
  const orderId = String(event.data?.id || attrs.order_id || "");
  const customerEmail = attrs.user_email || attrs.customer_email || attrs.email || null;
  const status = eventName === "order_refunded" ? "failed" : "paid";

  await supabase(env, `/rest/v1/readings?id=eq.${encodeURIComponent(readingId)}`, {
    method: "PATCH",
    body: {
      status,
      customer_email: customerEmail,
      lemon_squeezy_order_id: orderId,
      lemon_squeezy_order_number: attrs.order_number ? String(attrs.order_number) : null,
      lemon_squeezy_customer_id: attrs.customer_id ? String(attrs.customer_id) : null,
      lemon_squeezy_variant_id: attrs.first_order_item?.variant_id ? String(attrs.first_order_item.variant_id) : null,
      lemon_squeezy_product_id: attrs.first_order_item?.product_id ? String(attrs.first_order_item.product_id) : null,
      payment_status: attrs.status || eventName,
      paid_at: eventName === "order_created" ? new Date().toISOString() : null,
    },
  });

  await markWebhookProcessed(env, webhookRows[0]?.id);
  return { ok: true, reading_id: readingId };
}

async function submitPaidSignals(readingId, request, env) {
  requireUuid(readingId, "reading_id");
  const body = await readJson(request);
  const paidAnswers = pickAnswers(body.paid_answers || body.paidAnswers || body, PAID_ANSWER_KEYS);
  requireAnswers(paidAnswers, PAID_ANSWER_KEYS, "paid answers");

  const reading = await getReading(env, readingId);
  if (!reading) {
    throw httpError(404, "Reading not found");
  }

  const nextStatus = reading.lemon_squeezy_order_id ? "paid_answers_submitted" : reading.status;
  await supabase(env, `/rest/v1/readings?id=eq.${encodeURIComponent(readingId)}`, {
    method: "PATCH",
    body: {
      paid_answers_json: paidAnswers,
      customer_email: optionalEmail(body.email) || reading.customer_email,
      status: nextStatus,
      paid_answers_submitted_at: new Date().toISOString(),
    },
  });

  return {
    ok: true,
    reading_id: readingId,
    status: nextStatus,
    queued: Boolean(reading.lemon_squeezy_order_id),
  };
}

async function sendTestEmail(request, env) {
  requireBearerSecret(request, env.JOB_RUNNER_SECRET);
  requireEnv(env, ["RESEND_API_KEY"]);

  const body = await readJson(request).catch(() => ({}));
  const to = optionalEmail(body.to) || env.SUPPORT_EMAIL || "support@yourloveelement.com";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || "Your Love Element <reports@yourloveelement.com>",
      to: [to],
      subject: "Your Love Element test email",
      html: "<p>This is a test email from the Your Love Element Worker.</p>",
      text: "This is a test email from the Your Love Element Worker.",
      reply_to: env.SUPPORT_EMAIL || "support@yourloveelement.com",
    }),
  });

  const result = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    throw httpError(502, `Resend failed: ${JSON.stringify(result)}`);
  }

  return {
    ok: true,
    id: result.id,
    to,
  };
}

async function processNextReportJob(request, env) {
  requireBearerSecret(request, env.JOB_RUNNER_SECRET);
  requireEnv(env, ["OPENAI_API_KEY", "RESEND_API_KEY"]);

  const workerId = crypto.randomUUID();
  const jobs = await supabase(
    env,
    "/rest/v1/report_generation_jobs?select=*,readings(*)&status=eq.queued&scheduled_for=lte.now()&order=created_at.asc&limit=1",
  );

  if (!jobs.length) {
    return { ok: true, processed: false };
  }

  const job = jobs[0];
  await supabase(env, `/rest/v1/report_generation_jobs?id=eq.${job.id}`, {
    method: "PATCH",
    body: {
      status: "running",
      attempts: job.attempts + 1,
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
    },
  });

  const reading = job.readings;
  try {
    if (!reading?.customer_email) {
      throw new Error("Reading is missing customer email");
    }

    await supabase(env, `/rest/v1/readings?id=eq.${reading.id}`, {
      method: "PATCH",
      body: {
        status: "generating",
        generation_started_at: new Date().toISOString(),
        generation_attempts: (reading.generation_attempts || 0) + 1,
      },
    });

    const report = await generateReport(env, reading);
    await supabase(env, `/rest/v1/readings?id=eq.${reading.id}`, {
      method: "PATCH",
      body: {
        status: "report_generated",
        report_html: report.html,
        report_text: report.text,
        report_json: report.json,
        generated_at: new Date().toISOString(),
      },
    });

    const email = await sendReportEmail(env, reading, report);
    await supabase(env, `/rest/v1/readings?id=eq.${reading.id}`, {
      method: "PATCH",
      body: {
        status: "delivered",
        email_message_id: email.id,
        delivered_at: new Date().toISOString(),
      },
    });

    await supabase(env, `/rest/v1/report_generation_jobs?id=eq.${job.id}`, {
      method: "PATCH",
      body: {
        status: "succeeded",
        completed_at: new Date().toISOString(),
      },
    });

    return { ok: true, processed: true, reading_id: reading.id };
  } catch (error) {
    const terminal = job.attempts + 1 >= job.max_attempts;
    await supabase(env, `/rest/v1/report_generation_jobs?id=eq.${job.id}`, {
      method: "PATCH",
      body: {
        status: terminal ? "failed" : "queued",
        last_error: error.message,
        scheduled_for: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        completed_at: terminal ? new Date().toISOString() : null,
      },
    });

    await supabase(env, `/rest/v1/readings?id=eq.${reading.id}`, {
      method: "PATCH",
      body: {
        status: terminal ? "failed" : reading.status,
        error_message: error.message,
        failed_at: terminal ? new Date().toISOString() : null,
      },
    });

    throw error;
  }
}

async function generateReport(env, reading) {
  const prompt = [
    "Create a premium Your Love Element relationship report.",
    "Use the user's free 10 answers and paid 8 signals.",
    "Tone: intimate, grounded, emotionally intelligent, practical.",
    "Do not make medical, legal, or deterministic claims.",
    "Return JSON with keys: title, sections, text, html.",
    "sections should include partner_portrait, element_profile, compatibility_map, pattern_to_release, timing_window, thirty_day_guidance.",
    "",
    `Free answers: ${JSON.stringify(reading.free_answers_json)}`,
    `Paid answers: ${JSON.stringify(reading.paid_answers_json)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You write polished personalized relationship reports for a reflective digital product.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI failed: ${await response.text()}`);
  }

  const data = await response.json();
  const report = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  const text = report.text || stringifySections(report.sections);
  const html = report.html || textToHtml(text);

  return {
    json: report,
    text,
    html,
  };
}

async function sendReportEmail(env, reading, report) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || "Your Love Element <support@yourloveelement.com>",
      to: [reading.customer_email],
      subject: "Your Love Element full report is ready",
      html: report.html,
      text: report.text,
      reply_to: env.SUPPORT_EMAIL || "support@yourloveelement.com",
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend failed: ${await response.text()}`);
  }

  return response.json();
}

async function getReading(env, readingId) {
  const rows = await supabase(env, `/rest/v1/readings?id=eq.${encodeURIComponent(readingId)}&select=*`);
  return rows[0] || null;
}

async function markWebhookProcessed(env, webhookId, processingError = null) {
  if (!webhookId) {
    return;
  }

  await supabase(env, `/rest/v1/webhook_events?id=eq.${webhookId}`, {
    method: "PATCH",
    body: {
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    },
  });
}

async function supabase(env, path, options = {}) {
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: options.prefer || "",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Supabase failed: ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function lemonSqueezy(env, path, options = {}) {
  const response = await fetch(`https://api.lemonsqueezy.com${path}`, {
    method: options.method || "GET",
    headers: {
      authorization: `Bearer ${env.LEMON_SQUEEZY_API_KEY}`,
      accept: "application/vnd.api+json",
      "content-type": "application/vnd.api+json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Lemon Squeezy failed: ${await response.text()}`);
  }

  return response.json();
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw httpError(400, "Invalid JSON");
  }
}

function pickAnswers(source, keys) {
  return keys.reduce((answers, key) => {
    if (source[key] !== undefined && source[key] !== "") {
      answers[key] = source[key];
    }
    return answers;
  }, {});
}

function requireAnswers(answers, keys, label) {
  const missing = keys.filter((key) => answers[key] === undefined || answers[key] === "");
  if (missing.length) {
    throw httpError(400, `Missing ${label}: ${missing.join(", ")}`);
  }
}

function requireUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""))) {
    throw httpError(400, `Invalid ${label}`);
  }
  return String(value);
}

function optionalEmail(value) {
  if (!value) {
    return null;
  }

  const email = String(value).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, "Invalid email");
  }
  return email;
}

function requireEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw httpError(500, `Missing Worker env: ${missing.join(", ")}`);
  }
}

function requireBearerSecret(request, secret) {
  if (!secret) {
    throw httpError(500, "Missing Worker env: JOB_RUNNER_SECRET");
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !timingSafeEqual(token, secret)) {
    throw httpError(401, "Unauthorized");
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function stringifySections(sections = {}) {
  return Object.entries(sections)
    .map(([title, value]) => `${title.replaceAll("_", " ")}\n${value}`)
    .join("\n\n");
}

function textToHtml(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
