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
    "Return JSON with keys: title, emotional_summary, sections, text.",
    "emotional_summary should be a warm 2-3 sentence note that makes the reader feel seen and reassured.",
    "sections must be an object with exactly these keys: partner_portrait, element_profile, compatibility_map, pattern_to_release, timing_window, thirty_day_guidance.",
    "Each sections value must be a plain string, not an object or array.",
    "The thirty_day_guidance section must be a 30-day timeline with exactly these nodes: Day 1, Day 3, Day 7, Day 14, Day 21, Day 30.",
    "Write each timeline node on its own line in this format: Day N — short emotionally supportive action step.",
    "Each section should feel specific to the answers, not generic. Use elegant, emotionally generous prose.",
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
  const html = buildStandaloneReportHtml(env, reading, report, text);

  return {
    json: report,
    text,
    html,
  };
}

async function sendReportEmail(env, reading, report) {
  const email = buildReportEmail(env, reading, report);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || "Your Love Element <reports@yourloveelement.com>",
      to: [reading.customer_email],
      subject: email.subject,
      html: email.html,
      text: email.text,
      reply_to: env.SUPPORT_EMAIL || "support@yourloveelement.com",
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend failed: ${await response.text()}`);
  }

  return response.json();
}

function buildReportEmail(env, reading, report) {
  const siteUrl = env.SITE_URL || "https://yourloveelement.com";
  const answers = reading.free_answers_json || {};
  const element = answers.element || "love";
  const quality = answers.quality || "emotional clarity";
  const pace = answers.pace || "a pace your heart can trust";
  const bannerUrl = elementBannerUrl(siteUrl, element);
  const title = report.json?.title || `Your Love Element Report: ${element}`;
  const summary = report.json?.emotional_summary || `Your report is ready. It was shaped from your free reading and deeper signals, with special attention to ${quality.toLowerCase()}, ${element} energy, and ${pace.toLowerCase()}.`;
  const sections = normalizeReportSections(report.json?.sections, report.text);
  const supportEmail = env.SUPPORT_EMAIL || "support@yourloveelement.com";

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#fff7ee;color:#2a1e18;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">Your full relationship report is ready, with a personalized reading of your element, patterns, timing, and next steps.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ee;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:720px;background:#fffaf5;border:1px solid #eaded2;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:0;">
                <img src="${bannerUrl}" alt="${escapeHtml(element)} element relationship report banner" width="720" style="display:block;width:100%;max-height:260px;object-fit:cover;border:0;">
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 18px;">
                <p style="margin:0 0 10px;color:#4f877b;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Your full report is ready</p>
                <h1 style="margin:0;color:#4b1f2f;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.12;">${escapeHtml(title)}</h1>
                <p style="margin:18px 0 0;color:#5f514b;font-size:17px;line-height:1.7;">${escapeHtml(summary)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4ebe2;border-radius:14px;">
                  <tr>
                    <td style="padding:18px;">
                      <p style="margin:0;color:#4b1f2f;font-size:15px;line-height:1.7;"><strong>A note before you read:</strong> this report is not here to rush your heart. It is here to give language to what you already sense, soften the old pattern, and help you recognize love that feels steady enough to trust.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px;">
                ${sections.map(renderEmailSection).join("")}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#4b1f2f;border-radius:14px;">
                  <tr>
                    <td style="padding:22px;">
                      <h2 style="margin:0 0 10px;color:#fffaf5;font-family:Georgia,'Times New Roman',serif;font-size:22px;">How to use this reading</h2>
                      <p style="margin:0;color:#f5dfcb;font-size:15px;line-height:1.7;">Read it once for recognition, then save it and return to the 30-day guidance when your nervous system is quieter. The most useful part may not be the line that feels exciting. It may be the line that helps you stop negotiating with uncertainty.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 30px;">
                <p style="margin:0;color:#6f625b;font-size:14px;line-height:1.7;">If anything in your report feels especially true, confusing, or tender, you can reply directly to this email. Replies go to <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4f877b;font-weight:700;">${escapeHtml(supportEmail)}</a>.</p>
                <p style="margin:18px 0 0;color:#9a8b83;font-size:12px;line-height:1.6;">Your Love Element is a reflective relationship reading for personal insight. It is not medical, legal, financial, or mental health advice.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    title,
    "",
    summary,
    "",
    "A note before you read: this report is not here to rush your heart. It is here to give language to what you already sense, soften the old pattern, and help you recognize love that feels steady enough to trust.",
    "",
    ...sections.flatMap((section) => [section.title, section.body, ""]),
    "How to use this reading",
    "Read it once for recognition, then save it and return to the 30-day guidance when your nervous system is quieter.",
    "",
    `Questions? Reply to this email or contact ${supportEmail}.`,
  ].join("\n");

  return {
    subject: `Your full report is ready: ${element} love, ${pace.toLowerCase()}`,
    html,
    text,
  };
}

function buildStandaloneReportHtml(env, reading, report, fallbackText) {
  const sections = normalizeReportSections(report.sections, fallbackText);
  const title = report.title || `Your Love Element Report: ${reading.free_answers_json?.element || "Love"}`;
  const summary = report.emotional_summary || "";

  return [
    `<article class="yle-report">`,
    `<header><p>Your Love Element</p><h1>${escapeHtml(title)}</h1>${summary ? `<p>${escapeHtml(summary)}</p>` : ""}</header>`,
    ...sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body).replace(/\n/g, "<br>")}</p></section>`),
    `</article>`,
  ].join("");
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

const REPORT_SECTION_LABELS = {
  partner_portrait: "The Partner Who Fits You Best",
  element_profile: "Your Love Element",
  compatibility_map: "Your Compatibility Map",
  pattern_to_release: "The Pattern To Release",
  timing_window: "Your Timing Window",
  thirty_day_guidance: "30-Day Guidance",
};

function elementBannerUrl(siteUrl, element) {
  const slug = String(element || "")
    .trim()
    .toLowerCase();
  const known = new Set(["wood", "fire", "earth", "metal", "water"]);
  const file = known.has(slug) ? `${slug}-banner.jpg` : "earth-banner.jpg";
  return `${siteUrl}/assets/elements/${file}`;
}

function normalizeReportSections(sections = {}, fallbackText = "") {
  const normalized = Object.entries(REPORT_SECTION_LABELS)
    .map(([key, title]) => {
      const value = sections?.[key];
      if (!value) {
        return null;
      }

      return {
        title,
        body: reportValueToText(value),
      };
    })
    .filter(Boolean);

  if (normalized.length) {
    return normalized;
  }

  return String(fallbackText || "")
    .split(/\n{2,}/)
    .map((paragraph, index) => ({
      title: index === 0 ? "Your Full Report" : `Part ${index + 1}`,
      body: paragraph.trim(),
    }))
    .filter((section) => section.body);
}

function reportValueToText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(reportValueToText).filter(Boolean).join("\n\n");
  }

  if (typeof value === "object") {
    const preferred = value.body || value.content || value.text || value.summary || value.description;
    if (preferred) {
      return reportValueToText(preferred);
    }

    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const text = reportValueToText(nestedValue);
        if (!text) {
          return "";
        }
        return `${titleCase(key)}: ${text}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return String(value);
}

function titleCase(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderEmailSection(section) {
  if (section.title === REPORT_SECTION_LABELS.thirty_day_guidance) {
    return renderTimelineSection(section);
  }

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #eaded2;">
    <tr>
      <td style="padding:22px 0;">
        <h2 style="margin:0 0 10px;color:#4b1f2f;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;">${escapeHtml(section.title)}</h2>
        <p style="margin:0;color:#2a1e18;font-size:16px;line-height:1.75;">${escapeHtml(section.body).replace(/\n/g, "<br>")}</p>
      </td>
    </tr>
  </table>`;
}

function renderTimelineSection(section) {
  const nodes = parseTimelineNodes(section.body);
  const timeline = nodes.length ? nodes : [{ day: "30 days", text: section.body }];

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #eaded2;">
    <tr>
      <td style="padding:24px 0;">
        <h2 style="margin:0 0 10px;color:#4b1f2f;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;">${escapeHtml(section.title)}</h2>
        <p style="margin:0 0 16px;color:#6f625b;font-size:15px;line-height:1.7;">A softer month works better when it has rhythm. Use these checkpoints as small invitations, not pressure.</p>
        ${timeline.map(renderTimelineNode).join("")}
      </td>
    </tr>
  </table>`;
}

function parseTimelineNodes(body) {
  return String(body || "")
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .map((line) => {
      const match = line.match(/^(Day\s*\d+)\s*(?:[-–—:])\s*(.+)$/i);
      if (!match) {
        return null;
      }

      return {
        day: match[1].replace(/\s+/, " "),
        text: match[2],
      };
    })
    .filter(Boolean);
}

function renderTimelineNode(node) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;background:#f4ebe2;border-radius:12px;">
    <tr>
      <td width="86" valign="top" style="padding:14px 0 14px 16px;">
        <p style="margin:0;color:#4f877b;font-size:13px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(node.day)}</p>
      </td>
      <td valign="top" style="padding:14px 16px 14px 8px;">
        <p style="margin:0;color:#2a1e18;font-size:15px;line-height:1.65;">${escapeHtml(node.text)}</p>
      </td>
    </tr>
  </table>`;
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
