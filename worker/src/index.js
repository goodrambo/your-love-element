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

const REPORT_PROGRESS_STATUSES = new Set(["paid_answers_submitted", "generating", "report_generated", "delivered", "failed"]);
const REPORT_LOCKED_STATUSES = new Set(["generating", "report_generated", "delivered", "failed"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

      const readingStatusMatch = url.pathname.match(/^\/api\/readings\/([0-9a-f-]+)\/status$/i);
      if (request.method === "GET" && readingStatusMatch) {
        return json(await getReadingStatus(readingStatusMatch[1], env));
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

      if (request.method === "GET" && url.pathname === "/api/health/meta") {
        return json(checkMetaHealth(env));
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error(error);
      const status = error.status || 500;
      return json({ error: status === 500 ? "Internal server error" : error.message }, status);
    }
  },

  scheduled(event, env, ctx) {
    ctx.waitUntil(processReportQueue(env, 3));
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
  const fromEmail = env.FROM_EMAIL || "";
  const supportEmail = env.SUPPORT_EMAIL || "";
  const configured = {
    resend_api_key: Boolean(env.RESEND_API_KEY),
    from_email: Boolean(fromEmail),
    support_email: Boolean(supportEmail),
    from_email_domain: emailDomain(fromEmail),
    support_email_domain: emailDomain(supportEmail),
  };

  const missing = Object.entries({
    RESEND_API_KEY: configured.resend_api_key,
    FROM_EMAIL: configured.from_email,
    SUPPORT_EMAIL: configured.support_email,
  })
    .filter(([, present]) => !present)
    .map(([name]) => name);

  if (missing.length) {
    return {
      ok: false,
      configured,
      delivery_check: "not_attempted",
      error: `Missing email configuration: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    configured,
    delivery_check: "configuration_only",
    note: "Resend Sending access keys may not have permission to read domains. Use POST /api/test-email or a report E2E to verify actual delivery.",
  };
}

function checkMetaHealth(env) {
  const configured = {
    meta_capi_access_token: Boolean(env.META_CAPI_ACCESS_TOKEN),
    meta_pixel_id: Boolean(env.META_PIXEL_ID),
    meta_graph_api_version: Boolean(env.META_GRAPH_API_VERSION),
    meta_test_event_code: Boolean(env.META_TEST_EVENT_CODE),
  };

  return {
    ok: configured.meta_capi_access_token && configured.meta_pixel_id,
    configured,
    pixel_id: configured.meta_pixel_id ? env.META_PIXEL_ID : null,
    graph_api_version: env.META_GRAPH_API_VERSION || "v25.0",
    note: "This endpoint only reports whether Meta runtime settings are present. It never returns secrets.",
  };
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

  if (reading.lemon_squeezy_order_id || REPORT_PROGRESS_STATUSES.has(reading.status)) {
    throw httpError(409, "This reading already has a verified payment or report in progress");
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
          checkout_options: {
            locale: "en",
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
  const attrs = event.data?.attributes || {};
  const readingId = event.meta?.custom_data?.reading_id || attrs.custom_data?.reading_id;
  const validReadingId = isUuid(readingId) ? String(readingId) : null;

  let webhookRow = null;
  try {
    const webhookRows = await supabase(env, "/rest/v1/webhook_events?select=id,processed_at", {
      method: "POST",
      body: {
        provider: "lemon_squeezy",
        event_name: eventName,
        external_event_id: externalEventId,
        reading_id: validReadingId,
        payload_json: event,
      },
      prefer: "return=representation",
    });
    webhookRow = webhookRows[0] || null;
  } catch (error) {
    if (!String(error.message).includes("duplicate key")) {
      throw error;
    }
    if (!externalEventId) {
      throw error;
    }

    const existingRows = await supabase(
      env,
      `/rest/v1/webhook_events?provider=eq.lemon_squeezy&external_event_id=eq.${encodeURIComponent(externalEventId)}&select=id,processed_at&limit=1`,
    );
    webhookRow = existingRows[0] || null;
    if (webhookRow?.processed_at) {
      return { ok: true, duplicate: true };
    }
  }

  if (eventName !== "order_created" && eventName !== "order_refunded") {
    await markWebhookProcessed(env, webhookRow?.id, null, validReadingId);
    return { ok: true, ignored: true };
  }

  if (!readingId) {
    await markWebhookProcessed(env, webhookRow?.id, "Missing reading_id");
    return { ok: true, ignored: true };
  }

  if (!validReadingId) {
    await markWebhookProcessed(env, webhookRow?.id, "Invalid reading_id");
    return { ok: true, ignored: true };
  }

  const reading = await getReading(env, validReadingId);
  if (!reading) {
    await markWebhookProcessed(env, webhookRow?.id, "Reading not found", validReadingId);
    return { ok: true, ignored: true };
  }

  const orderId = String(event.data?.id || attrs.order_id || "");
  const customerEmail = attrs.user_email || attrs.customer_email || attrs.email || null;
  const status = eventName === "order_refunded"
    ? "failed"
    : nextPaymentStatus(reading.status, Boolean(reading.paid_answers_json));

  await supabase(env, `/rest/v1/readings?id=eq.${encodeURIComponent(validReadingId)}`, {
    method: "PATCH",
    body: {
      status,
      customer_email: customerEmail || reading.customer_email,
      lemon_squeezy_order_id: orderId || reading.lemon_squeezy_order_id,
      lemon_squeezy_order_number: attrs.order_number ? String(attrs.order_number) : reading.lemon_squeezy_order_number,
      lemon_squeezy_customer_id: attrs.customer_id ? String(attrs.customer_id) : reading.lemon_squeezy_customer_id,
      lemon_squeezy_variant_id: attrs.first_order_item?.variant_id ? String(attrs.first_order_item.variant_id) : reading.lemon_squeezy_variant_id,
      lemon_squeezy_product_id: attrs.first_order_item?.product_id ? String(attrs.first_order_item.product_id) : reading.lemon_squeezy_product_id,
      payment_status: attrs.status || eventName,
      paid_at: eventName === "order_created" ? new Date().toISOString() : reading.paid_at,
    },
  });

  if (eventName === "order_created") {
    await sendMetaPurchaseEvent(env, {
      readingId: validReadingId,
      orderId,
      customerEmail,
      attrs,
      eventId: externalEventId || orderId || validReadingId,
    }).catch((error) => {
      console.error("Meta Purchase event failed", error);
    });
  }

  await markWebhookProcessed(env, webhookRow?.id, null, validReadingId);
  return { ok: true, reading_id: validReadingId };
}

async function sendMetaPurchaseEvent(env, { readingId, orderId, customerEmail, attrs, eventId }) {
  if (!env.META_CAPI_ACCESS_TOKEN) {
    console.log("Skipping Meta Purchase event: META_CAPI_ACCESS_TOKEN is not configured");
    return { skipped: true, reason: "missing_token" };
  }

  const pixelId = env.META_PIXEL_ID || "4282306195342317";
  const graphVersion = env.META_GRAPH_API_VERSION || "v25.0";
  const siteUrl = env.SITE_URL || "https://yourloveelement.com";
  const email = optionalEmail(customerEmail);
  const userData = {};

  if (email) {
    userData.em = [await sha256Hex(email.trim().toLowerCase())];
  }

  if (readingId) {
    userData.external_id = [await sha256Hex(String(readingId))];
  }

  if (!Object.keys(userData).length) {
    console.log("Skipping Meta Purchase event: no matchable user_data");
    return { skipped: true, reason: "missing_user_data" };
  }

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `lemon_squeezy_order_created:${eventId}`,
        action_source: "website",
        event_source_url: `${siteUrl}/full-report/?reading_id=${encodeURIComponent(readingId)}`,
        user_data: userData,
        custom_data: {
          currency: orderCurrency(attrs),
          value: orderValue(attrs),
          order_id: orderId || String(eventId || ""),
          content_name: "Full Relationship Report",
          content_category: "Digital relationship reading",
          content_ids: ["your-love-element-full-report"],
          content_type: "product",
        },
      },
    ],
  };

  if (env.META_TEST_EVENT_CODE) {
    payload.test_event_code = env.META_TEST_EVENT_CODE;
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok || result.error) {
    throw new Error(`Meta CAPI failed: ${JSON.stringify(result)}`);
  }

  return result;
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

  if (REPORT_LOCKED_STATUSES.has(reading.status)) {
    return {
      ok: true,
      reading_id: readingId,
      status: reading.status,
      payment_verified: Boolean(reading.lemon_squeezy_order_id),
      queued: false,
      already_submitted: true,
      delivered: reading.status === "delivered",
    };
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
    payment_verified: Boolean(reading.lemon_squeezy_order_id),
    queued: Boolean(reading.lemon_squeezy_order_id),
    already_submitted: reading.status === "paid_answers_submitted",
    delivered: false,
  };
}

async function getReadingStatus(readingId, env) {
  requireUuid(readingId, "reading_id");
  const reading = await getReading(env, readingId);
  if (!reading) {
    throw httpError(404, "Reading not found");
  }

  return {
    ok: true,
    reading_id: reading.id,
    status: reading.status,
    payment_verified: Boolean(reading.lemon_squeezy_order_id),
    paid_answers_submitted: Boolean(reading.paid_answers_json),
    delivered: reading.status === "delivered",
    can_submit_paid_signals: Boolean(reading.lemon_squeezy_order_id)
      && !REPORT_LOCKED_STATUSES.has(reading.status)
      && reading.status !== "paid_answers_submitted",
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

  return processReportQueue(env, 1);
}

async function processReportQueue(env, limit = 1) {
  requireEnv(env, ["OPENAI_API_KEY", "RESEND_API_KEY"]);

  const results = [];
  for (let count = 0; count < limit; count += 1) {
    const result = await processNextQueuedReportJob(env);
    if (!result.processed) {
      return {
        ok: true,
        processed: results.length > 0,
        count: results.length,
        results,
      };
    }
    results.push(result);
  }

  return {
    ok: true,
    processed: results.length > 0,
    count: results.length,
    results,
  };
}

async function processNextQueuedReportJob(env) {
  const workerId = crypto.randomUUID();
  const jobs = await supabase(
    env,
    "/rest/v1/report_generation_jobs?select=*,readings(*)&status=eq.queued&scheduled_for=lte.now()&order=created_at.asc&limit=1",
  );

  if (!jobs.length) {
    return { ok: true, processed: false };
  }

  const job = jobs[0];
  const claimedJobs = await supabase(env, `/rest/v1/report_generation_jobs?id=eq.${job.id}&status=eq.queued`, {
    method: "PATCH",
    body: {
      status: "running",
      attempts: job.attempts + 1,
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
    },
    prefer: "return=representation",
  });
  if (!claimedJobs?.length) {
    return { ok: true, processed: false, skipped: "already_claimed" };
  }

  const reading = job.readings;
  try {
    if (!reading?.customer_email) {
      throw new Error("Reading is missing customer email");
    }

    if (reading.status === "delivered" && reading.email_message_id) {
      await supabase(env, `/rest/v1/report_generation_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: {
          status: "succeeded",
          completed_at: new Date().toISOString(),
          last_error: null,
        },
      });

      return { ok: true, processed: true, reading_id: reading.id, skipped: "already_delivered" };
    }

    await supabase(env, `/rest/v1/readings?id=eq.${reading.id}`, {
      method: "PATCH",
      body: {
        status: "generating",
        generation_started_at: new Date().toISOString(),
        generation_attempts: (reading.generation_attempts || 0) + 1,
      },
    });

    const report = reading.report_json && reading.report_text && reading.report_html
      ? {
          json: reading.report_json,
          text: reading.report_text,
          html: reading.report_html,
        }
      : await generateReport(env, reading);

    if (!reading.report_json || !reading.report_text || !reading.report_html) {
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
    }

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
        last_error: null,
      },
    });

    return { ok: true, processed: true, reading_id: reading.id };
  } catch (error) {
    const terminal = job.attempts + 1 >= job.max_attempts;
    const latestReading = reading?.id ? await getReading(env, reading.id).catch(() => null) : null;
    const alreadyDelivered = latestReading?.status === "delivered" && latestReading.email_message_id;
    await supabase(env, `/rest/v1/report_generation_jobs?id=eq.${job.id}`, {
      method: "PATCH",
      body: {
        status: alreadyDelivered ? "succeeded" : terminal ? "failed" : "queued",
        last_error: alreadyDelivered ? null : error.message,
        scheduled_for: alreadyDelivered ? job.scheduled_for : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        completed_at: alreadyDelivered || terminal ? new Date().toISOString() : null,
      },
    });

    if (alreadyDelivered) {
      return { ok: true, processed: true, reading_id: reading.id, skipped: "already_delivered_after_side_effect" };
    }

    if (reading?.id) {
      await supabase(env, `/rest/v1/readings?id=eq.${reading.id}`, {
        method: "PATCH",
        body: {
          status: terminal ? "failed" : reading.status,
          error_message: error.message,
          failed_at: terminal ? new Date().toISOString() : null,
        },
      });
    }

    throw error;
  }
}

const ELEMENT_NAMES = ["Wood", "Fire", "Earth", "Metal", "Water"];

const ELEMENT_ANSWER_WEIGHTS = {
  quality: {
    "Emotional steadiness": { Earth: 3, Water: 1 },
    "Creative ambition": { Wood: 3, Fire: 1 },
    "Warm intelligence": { Water: 2, Metal: 2 },
    "Playful confidence": { Fire: 3, Wood: 1 },
  },
  setting: {
    "Through work, craft, or a shared goal": { Earth: 2, Wood: 1 },
    "Travel, relocation, or a new city": { Wood: 2, Fire: 1 },
    "A friend's wider circle": { Fire: 2, Earth: 1 },
    "Online, but through deeper conversation": { Water: 2, Metal: 1 },
  },
  secure: {
    "A quiet home base": { Earth: 3 },
    "A shared adventure": { Wood: 2, Fire: 1 },
    "A clear future plan": { Metal: 2, Earth: 1 },
    "Emotional honesty without pressure": { Water: 2, Metal: 1 },
  },
  mirror: {
    "You make people feel safe": { Earth: 2 },
    "You bring people alive": { Fire: 2 },
    "You see what others miss": { Water: 2 },
    "You help people become braver": { Wood: 2 },
  },
  pace: {
    "Slow and certain": { Earth: 2, Metal: 1 },
    "Fast, but honest": { Fire: 2, Metal: 1 },
    "Playful first, deep later": { Fire: 2, Wood: 1 },
    "Intense at first, then grounded": { Water: 1, Earth: 1, Fire: 1 },
  },
  partnerEnergy: {
    "Someone grounded and patient": { Earth: 3 },
    "Someone passionate and expressive": { Fire: 3 },
    "Someone wise and emotionally mature": { Water: 2, Metal: 1 },
    "Someone playful and socially warm": { Fire: 2, Wood: 1 },
    "Someone focused, loyal, and protective": { Metal: 2, Earth: 1 },
  },
};

const ATTACHMENT_LABELS = {
  calm_secure: "Consistency-seeking calm trust",
  signal_sensitive: "Clarity-seeking sensitivity",
  momentum_open: "Warm momentum and visible affection",
  protective_slow: "Protective slow trust",
};

const PACE_LABELS = {
  slow_build: "Slow-build clarity",
  balanced: "Balanced and responsive pace",
  fast_momentum: "Fast honest momentum",
  stop_start: "Intensity that needs grounding",
};

const CHEMISTRY_STABILITY_LABELS = {
  stability_led: "Stability-led attraction",
  chemistry_led: "Chemistry-led attraction",
  clarity_led: "Clarity-led attraction",
  integration: "Chemistry and stability integration",
};

const BOUNDARY_LABELS = {
  emerging: "Emerging standards",
  strengthening: "Strengthening standards",
  firm: "Clear and protective standards",
};

const GROWTH_FOCUS_LABELS = {
  openness: "Opening to love without rushing",
  pattern_release: "Releasing an old pattern",
  recognition: "Recognizing the right person sooner",
  voice: "Communicating needs with less fear",
  discernment: "Choosing between chemistry and stability",
};

function buildRelationshipScoringProfile(reading) {
  const free = reading.free_answers_json || {};
  const paid = reading.paid_answers_json || {};
  const elementScores = scoreElements(free, paid);
  const [primaryElement, supportiveElement] = topScoreEntries(elementScores);
  const attachment = pickTopDimension(scoreAttachmentRhythm(free, paid), ATTACHMENT_LABELS);
  const pace = pickTopDimension(scoreRelationshipPace(free, paid), PACE_LABELS);
  const chemistryStability = pickTopDimension(scoreChemistryStability(free, paid), CHEMISTRY_STABILITY_LABELS);
  const boundary = pickTopDimension(scoreBoundaryClarity(free, paid), BOUNDARY_LABELS);
  const growthFocus = pickTopDimension(scoreGrowthFocus(free, paid), GROWTH_FOCUS_LABELS);
  const partnerClimate = partnerClimateLabel(free, paid);

  const publicProfile = {
    primary_element: primaryElement.key,
    supportive_element: supportiveElement.key,
    element_blend: `${primaryElement.key} with ${supportiveElement.key} support`,
    attachment_rhythm: attachment.label,
    relationship_pace: pace.label,
    chemistry_stability: chemistryStability.label,
    boundary_clarity: boundary.label,
    growth_focus: growthFocus.label,
    partner_climate: partnerClimate,
  };

  return {
    version: "2026-05-12",
    public_profile: publicProfile,
    confidence: {
      element: scoreConfidence(primaryElement.score, supportiveElement.score),
      attachment_rhythm: attachment.confidence,
      relationship_pace: pace.confidence,
      chemistry_stability: chemistryStability.confidence,
      boundary_clarity: boundary.confidence,
      growth_focus: growthFocus.confidence,
    },
    internal_scores: {
      element: elementScores,
      attachment_rhythm: attachment.scores,
      relationship_pace: pace.scores,
      chemistry_stability: chemistryStability.scores,
      boundary_clarity: boundary.scores,
      growth_focus: growthFocus.scores,
    },
    prompt_context: {
      user_visible_profile: publicProfile,
      interpretation_notes: {
        element: `${primaryElement.key} is the strongest symbolic relationship style, with ${supportiveElement.key} as a supporting tone.`,
        attachment: attachment.note,
        pace: pace.note,
        chemistry_stability: chemistryStability.note,
        boundary: boundary.note,
        growth_focus: growthFocus.note,
      },
    },
  };
}

function scoreElements(free, paid) {
  const scores = initScores(ELEMENT_NAMES);
  addScore(scores, free.element, 6);
  addMappedScores(scores, free.quality, ELEMENT_ANSWER_WEIGHTS.quality);
  addMappedScores(scores, free.setting, ELEMENT_ANSWER_WEIGHTS.setting);
  addMappedScores(scores, free.secure, ELEMENT_ANSWER_WEIGHTS.secure);
  addMappedScores(scores, free.mirror, ELEMENT_ANSWER_WEIGHTS.mirror);
  addMappedScores(scores, free.pace, ELEMENT_ANSWER_WEIGHTS.pace);
  addMappedScores(scores, paid.partnerEnergy, ELEMENT_ANSWER_WEIGHTS.partnerEnergy);
  addScore(scores, birthSeasonElement(free.birthdate), 1);
  return scores;
}

function scoreAttachmentRhythm(free, paid) {
  const scores = initScores(Object.keys(ATTACHMENT_LABELS));
  addMappedScores(scores, paid.activation, {
    "I become curious but cautious": { protective_slow: 2, calm_secure: 1 },
    "I overthink small shifts": { signal_sensitive: 3 },
    "I get excited and want momentum": { momentum_open: 3 },
    "I stay calm until they prove consistency": { calm_secure: 2, protective_slow: 1 },
  });
  addMappedScores(scores, paid.pastPattern, {
    "I gave too much before feeling chosen": { signal_sensitive: 2, protective_slow: 1 },
    "I ignored red flags because chemistry was strong": { momentum_open: 1, signal_sensitive: 1 },
    "I kept my guard up even when things were good": { protective_slow: 3 },
    "I chose people who were unavailable in some way": { signal_sensitive: 2, protective_slow: 1 },
  });
  addMappedScores(scores, paid.reassurance, {
    "Clear communication": { signal_sensitive: 1, calm_secure: 1 },
    "Consistent effort": { calm_secure: 2 },
    "Physical closeness": { momentum_open: 2 },
    "Future planning": { calm_secure: 1, protective_slow: 1 },
    "Respect for my independence": { protective_slow: 2 },
  });
  addMappedScores(scores, paid.conflict, {
    "I need space before talking": { protective_slow: 2 },
    "I want to resolve it immediately": { signal_sensitive: 1, momentum_open: 1 },
    "I stay calm outside but feel a lot inside": { protective_slow: 1, signal_sensitive: 1 },
    "I avoid conflict until it becomes unavoidable": { protective_slow: 2 },
    "I try to understand their side first": { calm_secure: 2 },
  });
  addMappedScores(scores, paid.trustSignal, {
    "Seeing actions match words": { calm_secure: 2 },
    "Feeling emotionally understood": { signal_sensitive: 2 },
    "Knowing we want the same future": { calm_secure: 1, protective_slow: 1 },
    "Being able to move slowly without fear": { protective_slow: 2 },
    "Feeling desired without being pressured": { momentum_open: 1, calm_secure: 1 },
  });
  addMappedScores(scores, free.pace, {
    "Slow and certain": { calm_secure: 1, protective_slow: 1 },
    "Fast, but honest": { momentum_open: 1 },
    "Playful first, deep later": { momentum_open: 1, calm_secure: 1 },
    "Intense at first, then grounded": { signal_sensitive: 1, calm_secure: 1 },
  });
  return scores;
}

function scoreRelationshipPace(free, paid) {
  const scores = initScores(Object.keys(PACE_LABELS));
  addMappedScores(scores, free.pace, {
    "Slow and certain": { slow_build: 3 },
    "Fast, but honest": { fast_momentum: 3 },
    "Playful first, deep later": { balanced: 3 },
    "Intense at first, then grounded": { stop_start: 2, balanced: 1 },
  });
  addMappedScores(scores, paid.activation, {
    "I become curious but cautious": { slow_build: 1, balanced: 1 },
    "I overthink small shifts": { stop_start: 2 },
    "I get excited and want momentum": { fast_momentum: 2 },
    "I stay calm until they prove consistency": { slow_build: 2 },
  });
  addMappedScores(scores, paid.trustSignal, {
    "Seeing actions match words": { slow_build: 1, balanced: 1 },
    "Feeling emotionally understood": { balanced: 1 },
    "Knowing we want the same future": { slow_build: 1 },
    "Being able to move slowly without fear": { slow_build: 2 },
    "Feeling desired without being pressured": { balanced: 1, fast_momentum: 1 },
  });
  return scores;
}

function scoreChemistryStability(free, paid) {
  const scores = initScores(Object.keys(CHEMISTRY_STABILITY_LABELS));
  addMappedScores(scores, free.quality, {
    "Emotional steadiness": { stability_led: 2 },
    "Creative ambition": { chemistry_led: 1, integration: 1 },
    "Warm intelligence": { clarity_led: 2 },
    "Playful confidence": { chemistry_led: 2 },
  });
  addMappedScores(scores, paid.pastPattern, {
    "I gave too much before feeling chosen": { clarity_led: 1, stability_led: 1 },
    "I ignored red flags because chemistry was strong": { chemistry_led: 2 },
    "I kept my guard up even when things were good": { stability_led: 1, clarity_led: 1 },
    "I chose people who were unavailable in some way": { chemistry_led: 1, clarity_led: 1 },
  });
  addMappedScores(scores, paid.boundary, {
    "Inconsistent communication": { stability_led: 1, clarity_led: 1 },
    "Avoiding commitment": { stability_led: 2 },
    "Emotional unavailability": { stability_led: 1, clarity_led: 1 },
    "Being hidden or deprioritized": { clarity_led: 2 },
    "Confusing chemistry with care": { integration: 2 },
  });
  addMappedScores(scores, paid.guidance, {
    "How to choose between chemistry and stability": { integration: 3 },
    "How to recognize the right person sooner": { clarity_led: 2 },
  });
  return scores;
}

function scoreBoundaryClarity(free, paid) {
  const scores = initScores(Object.keys(BOUNDARY_LABELS));
  addMappedScores(scores, paid.boundary, {
    "Inconsistent communication": { strengthening: 2 },
    "Avoiding commitment": { firm: 2 },
    "Emotional unavailability": { strengthening: 2 },
    "Being hidden or deprioritized": { firm: 2 },
    "Confusing chemistry with care": { strengthening: 2 },
  });
  addMappedScores(scores, paid.pastPattern, {
    "I gave too much before feeling chosen": { emerging: 1, strengthening: 1 },
    "I ignored red flags because chemistry was strong": { strengthening: 2 },
    "I kept my guard up even when things were good": { firm: 1, strengthening: 1 },
    "I chose people who were unavailable in some way": { strengthening: 2 },
  });
  addMappedScores(scores, paid.conflict, {
    "I need space before talking": { firm: 1 },
    "I want to resolve it immediately": { emerging: 1 },
    "I stay calm outside but feel a lot inside": { emerging: 1, strengthening: 1 },
    "I avoid conflict until it becomes unavoidable": { emerging: 2 },
    "I try to understand their side first": { strengthening: 1 },
  });
  addMappedScores(scores, free.block, {
    "Mixed signals": { strengthening: 1 },
    "Feeling rushed": { firm: 1 },
    "Emotional distance": { strengthening: 1 },
    "Too much intensity too soon": { firm: 1 },
    "Losing my sense of independence": { firm: 1 },
  });
  return scores;
}

function scoreGrowthFocus(free, paid) {
  const scores = initScores(Object.keys(GROWTH_FOCUS_LABELS));
  addMappedScores(scores, paid.guidance, {
    "How to become more open to love": { openness: 3 },
    "How to stop repeating the same pattern": { pattern_release: 3 },
    "How to recognize the right person sooner": { recognition: 3 },
    "How to communicate needs without fear": { voice: 3 },
    "How to choose between chemistry and stability": { discernment: 3 },
  });
  addMappedScores(scores, free.intent, {
    "Who I naturally attract": { recognition: 1 },
    "Why old patterns repeat": { pattern_release: 2 },
    "When love may feel easier": { openness: 1 },
    "What kind of partner truly fits me": { discernment: 1, recognition: 1 },
  });
  addMappedScores(scores, free.block, {
    "Mixed signals": { discernment: 1, pattern_release: 1 },
    "Feeling rushed": { voice: 1 },
    "Emotional distance": { openness: 1 },
    "Too much intensity too soon": { discernment: 1 },
    "Losing my sense of independence": { voice: 1 },
  });
  return scores;
}

function partnerClimateLabel(free, paid) {
  const direct = {
    "Someone grounded and patient": "Grounded and patient",
    "Someone passionate and expressive": "Passionate and expressive",
    "Someone wise and emotionally mature": "Wise and emotionally mature",
    "Someone playful and socially warm": "Playful and socially warm",
    "Someone focused, loyal, and protective": "Focused, loyal, and protective",
  }[paid.partnerEnergy];
  if (direct) {
    return direct;
  }

  return {
    "Emotional steadiness": "Calm, consistent, and quietly ambitious",
    "Creative ambition": "Expressive, decisive, and self-directed",
    "Warm intelligence": "Thoughtful, witty, and emotionally generous",
    "Playful confidence": "Socially warm, expressive, and emotionally awake",
  }[free.quality] || "Emotionally steady and clear";
}

function buildSignalProfileSection(scoringProfile) {
  const profile = scoringProfile.public_profile;
  return [
    `Primary signal: ${profile.element_blend}. This means your relationship field is led by ${profile.primary_element} qualities, while ${profile.supportive_element} adds a secondary tone to how you recognize safety, attraction, and timing.`,
    `Attachment rhythm: ${profile.attachment_rhythm}. Your answers suggest that the most useful love will not only create chemistry; it will also speak to the pace and reassurance your nervous system actually trusts.`,
    `Decision lens: ${profile.chemistry_stability}, with ${profile.boundary_clarity.toLowerCase()}. This is the part of the reading that helps separate a real signal from an old pattern asking for another chance.`,
    `Growth focus: ${profile.growth_focus}. The 30-day guidance is built around this theme so the report gives you something practical to notice, practice, and repeat.`,
  ].join("\n\n");
}

function initScores(keys) {
  return keys.reduce((scores, key) => {
    scores[key] = 0;
    return scores;
  }, {});
}

function addMappedScores(scores, answer, mapping) {
  const weights = mapping?.[answer];
  if (!weights) {
    return;
  }
  Object.entries(weights).forEach(([key, points]) => addScore(scores, key, points));
}

function addScore(scores, key, points) {
  if (!key || scores[key] === undefined || !Number.isFinite(points)) {
    return;
  }
  scores[key] += points;
}

function topScoreEntries(scores) {
  const entries = Object.entries(scores)
    .map(([key, score]) => ({ key, score }))
    .sort((left, right) => right.score - left.score || left.key.localeCompare(right.key));
  return [entries[0], entries[1] || entries[0]];
}

function pickTopDimension(scores, labels) {
  const [top, second] = topScoreEntries(scores);
  const label = labels[top.key] || titleCase(top.key);
  return {
    key: top.key,
    label,
    score: top.score,
    scores,
    confidence: scoreConfidence(top.score, second.score),
    note: `${label} is the strongest signal in this dimension; ${labels[second.key] || titleCase(second.key)} is the nearest secondary signal.`,
  };
}

function scoreConfidence(topScore, secondScore) {
  const gap = Number(topScore || 0) - Number(secondScore || 0);
  if (gap >= 3) {
    return "dominant";
  }
  if (gap >= 1) {
    return "clear";
  }
  return "blended";
}

function birthSeasonElement(birthdate = {}) {
  const month = String(birthdate.month || "").trim();
  if (["March", "April"].includes(month)) {
    return "Wood";
  }
  if (["May", "June"].includes(month)) {
    return "Fire";
  }
  if (["July", "August"].includes(month)) {
    return "Earth";
  }
  if (["September", "October"].includes(month)) {
    return "Metal";
  }
  if (["November", "December", "January", "February"].includes(month)) {
    return "Water";
  }
  return null;
}

async function generateReport(env, reading) {
  const scoringProfile = buildRelationshipScoringProfile(reading);
  const prompt = [
    "Create a premium Your Love Element relationship report.",
    "Use the user's free 10 answers and paid 8 signals.",
    "Use the computed relationship signal profile as the report's interpretation backbone.",
    "Tone: intimate, grounded, emotionally intelligent, practical.",
    "Do not make medical, legal, or deterministic claims.",
    "Do not expose raw numeric scores. Translate scoring labels into warm user-facing language.",
    "Return JSON with keys: title, emotional_summary, signal_profile, sections, text.",
    "emotional_summary should be a warm 2-3 sentence note that makes the reader feel seen and reassured.",
    "signal_profile must mirror the provided user_visible_profile labels without raw numeric scores.",
    "sections must be an object with exactly these keys: relationship_signal_profile, partner_portrait, element_profile, compatibility_map, pattern_to_release, timing_window, thirty_day_guidance.",
    "Each sections value must be a plain string, not an object or array.",
    "The relationship_signal_profile section should explain the primary element blend, attachment rhythm, pace, chemistry/stability lens, boundary clarity, and growth focus in 180-260 words.",
    "The thirty_day_guidance section must be a practical 30-day timeline with exactly these nodes: Day 1, Day 3, Day 7, Day 14, Day 21, Day 30.",
    "Write each timeline node on its own line in this format: Day N — Goal: specific emotional or relational outcome. Practice: concrete action, reflection prompt, or conversation script. Notice: one observable signal the reader can use to track progress.",
    "Each thirty_day_guidance node should be 35-60 words, specific to the user's answers, and useful enough that a paying reader feels they received a clear exercise rather than a vague affirmation.",
    "Each section should feel specific to the answers, not generic. Use elegant, emotionally generous prose.",
    "",
    `Free answers: ${JSON.stringify(reading.free_answers_json)}`,
    `Paid answers: ${JSON.stringify(reading.paid_answers_json)}`,
    `Computed relationship signal profile: ${JSON.stringify(scoringProfile.prompt_context)}`,
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
  const generatedSections = report.sections || {};
  report.signal_profile = scoringProfile.public_profile;
  report.scoring_model = scoringProfile;
  report.sections = {
    relationship_signal_profile: generatedSections.relationship_signal_profile || buildSignalProfileSection(scoringProfile),
    partner_portrait: generatedSections.partner_portrait,
    element_profile: generatedSections.element_profile,
    compatibility_map: generatedSections.compatibility_map,
    pattern_to_release: generatedSections.pattern_to_release,
    timing_window: generatedSections.timing_window,
    thirty_day_guidance: generatedSections.thirty_day_guidance,
  };
  const text = stringifySections(report.sections);
  report.text = text;
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
      "idempotency-key": `full-report/${reading.id}`,
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
                <img src="${bannerUrl}" alt="${escapeHtml(element)} element relationship report banner" width="720" height="405" style="display:block;width:100%;height:auto;border:0;line-height:100%;">
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

async function markWebhookProcessed(env, webhookId, processingError = null, readingId = null) {
  if (!webhookId) {
    return;
  }

  const body = {
    processed_at: new Date().toISOString(),
    processing_error: processingError,
  };

  if (isUuid(readingId)) {
    body.reading_id = readingId;
  }

  await supabase(env, `/rest/v1/webhook_events?id=eq.${webhookId}`, {
    method: "PATCH",
    body,
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

function nextPaymentStatus(currentStatus, hasPaidAnswers) {
  if (REPORT_PROGRESS_STATUSES.has(currentStatus)) {
    return currentStatus;
  }
  return hasPaidAnswers ? "paid_answers_submitted" : "paid";
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

function requireUuid(value, label) {
  if (!isUuid(value)) {
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

function orderCurrency(attrs = {}) {
  return String(attrs.currency || attrs.currency_code || "USD").trim().toUpperCase();
}

function orderValue(attrs = {}) {
  const cents = Number(
    attrs.total_usd ??
    attrs.total ??
    attrs.subtotal_usd ??
    attrs.subtotal ??
    attrs.first_order_item?.price ??
    "",
  );

  if (Number.isFinite(cents) && cents > 0) {
    return Number((cents / 100).toFixed(2));
  }

  const formatted = String(attrs.total_formatted || attrs.subtotal_formatted || "").match(/[\d.]+/);
  if (formatted) {
    const parsed = Number(formatted[0]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 9.99;
}

function emailDomain(value) {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match ? match[1].toLowerCase() : null;
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

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
  relationship_signal_profile: "Your Relationship Signal Profile",
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
        <p style="margin:0 0 16px;color:#6f625b;font-size:15px;line-height:1.7;">Use these checkpoints as a 30-day practice plan: each one gives you a goal, a small action, and a signal to watch so the reading turns into something you can actually use.</p>
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
