// netlify/functions/visitor-counter.js
// Unified Netlify function for:
//  - Visitor counter  (?type=visitor)
//  - Notifications    (?type=notifications)
// It forwards the request to your Google Apps Script Web App.

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

// لو محتاج https في Node (موجود في Netlify)
const https = require("https");
const { URL } = require("url");

// Helper بسيط يعمل GET للـ GAS URL
function fetchFromGAS(urlString) {
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
        resolve({
          statusCode: res.statusCode || 200,
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
    const url = new URL(GAS_BASE_URL);
    if (type) url.searchParams.set("type", type);
    if (deviceId) url.searchParams.set("deviceId", deviceId);

    // ننده على Google Apps Script
    const res = await fetchFromGAS(url.toString());
    let text = res.body || "";
    const status = res.statusCode;

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

    return {
      statusCode: status,
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
