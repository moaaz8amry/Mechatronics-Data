// netlify/functions/visitor-counter.js
// Unified Netlify function for:
//  - Visitor counter  (?type=visitor)
//  - Notifications    (?type=notifications)
// It forwards the request to your Google Apps Script Web App
// and FOLLOWS 302 redirects from Google.

const https = require("https");
const { URL } = require("url");

// ⚠️ مهم جدًا: حط هنا لينك الـ Web App بتاعك من Google Script (اللي فيه /exec)
const GAS_BASE_URL =
  process.env.GAS_BASE_URL ||
  "https://script.google.com/macros/s/AKfycbwu8bDDGvD7d7fJmYz_2kMzGCMMZL64gEVebstG2ZdSuN3nfp9ssmSE4cDip22z9sz_/exec";

// CORS headers
const commonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  // لو حابب تقفل على الدومين بتاعك بس خليه:
  // "Access-Control-Allow-Origin": "https://znuassistant.netlify.app",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

exports.handler = async (event, context) => {
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

    // type: visitor / notifications (default = notifications)
    const type =
      qs.type ||
      qs.mode ||
      (qs.visitor ? "visitor" : null) ||
      "notifications";

    // نعدّي الـ deviceId لو جاي من الفرونت إند
    const deviceId = qs.deviceId || qs.mac || qs.macId || "";

    // نبني الـ URL بتاع Google Script
    const base = new URL(GAS_BASE_URL);
    if (type) base.searchParams.set("type", type);
    if (deviceId) base.searchParams.set("deviceId", deviceId);

    const finalUrl = base.toString();
    console.log("Calling GAS URL:", finalUrl);

    // ننده على Google Apps Script مع دعم redirects
    const res = await fetchFromGAS(finalUrl);
    let text = res.body || "";

    // نحاول نفهمه JSON لو نقدر
    let responseBody;
    try {
      const parsed = JSON.parse(text);
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
