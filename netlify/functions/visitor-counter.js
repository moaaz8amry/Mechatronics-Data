// netlify/functions/visitor-counter.js
// Unified Netlify function for:
//  - Visitor counter        (?type=visitor)
//  - Notifications          (?type=notifications)
//  - Per-device dismiss     (?type=notif-dismiss)
//  - Device info / stats    (?type=device-info, ?type=device-stats)
// It forwards the request to your Google Apps Script Web App
// and FOLLOWS 302 redirects from Google.

const https = require("https");
const { URL } = require("url");


const GAS_BASE_URL =
  process.env.GAS_BASE_URL ||
  "https://script.google.com/macros/s/AKfycbwu8bDDGvD7d7fJmYz_2kMzGCMMZL64gEVebstG2ZdSuN3nfp9ssmSE4cDip22z9sz_/exec";

// CORS headers
const commonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  // لو حابب تقفل على الدومين بتاعك بس خليه مثلاً:
  // "Access-Control-Allow-Origin": "https://znuassistant.netlify.app",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // شوية هيدرز بسيطة تخلي الديباجينج أسهل
  "Cache-Control": "no-store",
  "X-Proxy-Source": "netlify-visitor-counter",
};

// Helper يعمل GET مع دعم للـ redirects
function fetchFromGAS(urlString, redirectCount = 0) {
  const MAX_REDIRECTS = 5;

  return new Promise((resolve, reject) => {
    const url = new URL(urlString);

    const options = {
      method: "GET",
      hostname: url.hostname,
      path: url.pathname + url.search,
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const status = res.statusCode || 200;

        // لو جالنا 301/302/303/307/308 ومعاه Location → نكمّل redirect
        if (
          [301, 302, 303, 307, 308].includes(status) &&
          res.headers.location &&
          redirectCount < MAX_REDIRECTS
        ) {
          const nextUrl = new URL(res.headers.location, urlString).toString();
          console.log(
            `Redirecting (${status}) from ${urlString} → ${nextUrl} (step ${
              redirectCount + 1
            })`
          );
          return fetchFromGAS(nextUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        }

        // لو مفيش redirect أو عدينا الحد → نرجّع اللي عندنا
        resolve({
          statusCode: status,
          body: data,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

exports.handler = async (event) => {
  // Preflight CORS
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

    // type: visitor / notifications / notif-dismiss / device-info / device-stats ...
    const type =
      qs.type ||
      qs.mode ||
      (qs.visitor ? "visitor" : null) ||
      "notifications";

    // Device ID من الكويري (ونحتفظ بيه حتى لو جاي من البودي)
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

    // نبني الـ URL بتاع Google Script
    const base = new URL(GAS_BASE_URL);
    if (type) base.searchParams.set("type", type);
    if (deviceId) base.searchParams.set("deviceId", deviceId);

    // لو بنعمل dismiss لإشعار معيّن
    if (type === "notif-dismiss" && bodyJson) {
      if (bodyJson.notificationId) {
        base.searchParams.set("notificationId", bodyJson.notificationId);
      }
      if (bodyJson.action) {
        base.searchParams.set("action", bodyJson.action);
      } else {
        base.searchParams.set("action", "dismiss");
      }
    }

    const finalUrl = base.toString();
    console.log("Calling GAS URL:", finalUrl);

    // ننده على Google Apps Script مع دعم redirects (GET)
    const res = await fetchFromGAS(finalUrl);
    let text = res.body || "";

    // نحاول نفهمه JSON لو نقدر
    let responseBody;
    try {
      let parsed = JSON.parse(text);

      // تحسين للـ sorting بتاع الإشعارات من الناحية دي (الباك إند)
      if (type === "notifications" && Array.isArray(parsed)) {
        parsed = parsed
          .filter(
            (item) =>
              item &&
              (item.updatedTime ||
                item.modifiedTime ||
                item.lastUpdated ||
                item.timestamp)
          )
          .map((item) => {
            const rawTime =
              item.updatedTime ||
              item.modifiedTime ||
              item.lastUpdated ||
              item.timestamp;
            return { ...item, updatedTime: rawTime };
          })
          .sort((a, b) => {
            const ta = Date.parse(a.updatedTime) || 0;
            const tb = Date.parse(b.updatedTime) || 0;
            return tb - ta; // الأحدث الأول
          });
      }

      responseBody = JSON.stringify(parsed);
    } catch (e) {
      // لو مش JSON (مثلاً error HTML من جوجل) نرجّعه جوّه object
      responseBody = JSON.stringify({
        raw: text,
        note: "Response from GAS was not valid JSON.",
      });
    }

    // مهم: نرجّع 200 للمتصفح حتى لو Google رجّع 302 داخليًا
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
