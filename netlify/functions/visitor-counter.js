// netlify/functions/visitor-counter.js
// Simplified Netlify function (Node 18+) using built‑in fetch
//  - Visitor counter        (?type=visitor)
//  - Notifications          (?type=notifications)
//  - Per-device dismiss     (?type=notif-dismiss)
//  - Device info / stats    (?type=device-info)
//  - Device stats dashboard (?type=device-stats)
//
// It forwards the request to your Google Apps Script Web App.
// Make sure your site uses Node 18+ runtime on Netlify.

const GAS_BASE_URL =
  process.env.GAS_BASE_URL ||
  "https://script.google.com/macros/s/AKfycbxbpGnkXH_dDJO8QUYGujQ5C4-5NFamOpi8bsqG7vWRtTbP1R5AU_bPb4aiAMeevMdzaQ/exec";

const commonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const LEVEL_ORDER = {
  "000": 0,
  "100": 1,
  "200": 2,
  "300": 3,
  "400": 4,
  other: 5,
};

function getLevelRank(level) {
  if (!level) return LEVEL_ORDER.other;
  return Object.prototype.hasOwnProperty.call(LEVEL_ORDER, level)
    ? LEVEL_ORDER[level]
    : LEVEL_ORDER.other;
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: commonHeaders,
      body: "",
    };
  }

  try {
    const qs = event.queryStringParameters || {};
    const method = event.httpMethod || "GET";

    const type =
      qs.type ||
      qs.mode ||
      (qs.visitor ? "visitor" : null) ||
      "notifications";

    let deviceId = qs.deviceId || qs.mac || qs.macId || "";

    let bodyJson = null;
    if (method === "POST" && event.body) {
      try {
        bodyJson = JSON.parse(event.body);
      } catch (e) {
        console.warn("Failed to parse POST body JSON:", e.message);
      }
      if (!deviceId && bodyJson && bodyJson.deviceId) {
        deviceId = bodyJson.deviceId;
      }
    }

    const base = new URL(GAS_BASE_URL);
    if (type) base.searchParams.set("type", type);
    if (deviceId) base.searchParams.set("deviceId", deviceId);

    if (type === "notif-dismiss" && bodyJson) {
      if (bodyJson.notificationId) {
        base.searchParams.set("notificationId", bodyJson.notificationId);
      }
      base.searchParams.set("action", bodyJson.action || "dismiss");
    }

    const finalUrl = base.toString();
    console.log("Calling GAS URL:", finalUrl);

    // Built‑in fetch (Node 18+) automatically follows redirects
    const res = await fetch(finalUrl, { method: "GET" });

    const text = await res.text();
    let responseBody;

    try {
      let parsed = text ? JSON.parse(text) : [];

      if (type === "notifications" && Array.isArray(parsed)) {
        parsed = parsed
          .filter((item) => item && item.updatedTime)
          .sort((a, b) => {
            const la = getLevelRank(a.level);
            const lb = getLevelRank(b.level);
            if (la !== lb) return la - lb;

            const ta =
              Date.parse(a.updatedTime || a.modifiedTime || a.lastUpdated) || 0;
            const tb =
              Date.parse(b.updatedTime || b.modifiedTime || b.lastUpdated) || 0;
            return tb - ta;
          });
      }

      responseBody = JSON.stringify(parsed);
    } catch (e) {
      console.error("Failed to parse GAS response as JSON:", e, "raw:", text);
      responseBody = JSON.stringify({
        note: "Response from GAS was not valid JSON.",
        raw: text,
      });
    }

    // نرجّع 200 دايمًا للفرونت؛ الفرونت يعرف يتصرف لو الداتا بايظة
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: responseBody,
    };
  } catch (error) {
    console.error("visitor-counter Netlify function error:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({
        error: true,
        message: "Netlify function encountered an internal error",
        errorMessage: error.message,
      }),
    };
  }
};
