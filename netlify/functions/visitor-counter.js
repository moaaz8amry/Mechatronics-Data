// netlify/functions/znu-api.js
// Unified Netlify function for both:
//  - Visitor counter
//  - Notifications (Drive files with level detection)
// It forwards to a single Google Apps Script Web App and uses a `type` query param
// to decide which behavior to use.
//
// Usage from the frontend:
//   /.netlify/functions/znu-api?type=visitor
//   /.netlify/functions/znu-api?type=notifications

const GAS_BASE_URL = "https://script.google.com/macros/s/AKfycbwu8bDDGvD7d7fJmYz_2kMzGCMMZL64gEVebstG2ZdSuN3nfp9ssmSE4cDip22z9sz_/exec";

// --- Utility: common CORS headers ---
const commonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// --- START: Level Detection Logic for notifications ---
/**
 * Detects the academic level based on a file name.
 * @param {string} name - The file name.
 * @returns {string} The detected level ('000', '100', '200', '300', '400', or 'other').
 */
const detectLevel = (name) => {
  if (!name) return "other";
  const n = name.toLowerCase();

  const has = (...keys) => keys.some((k) => n.includes(k));

  // Preparatory / Level 0 / 000
  if (has("000", "l0", "level0", "level 0", "prep", "preparatory", "foundation")) return "000";

  // Level 100 / 1st year
  if (has("100", "l1", "level1", "level 1", "فرقة اولى", "1st", "first")) return "100";

  // Level 200 / 2nd year
  if (has("200", "l2", "level2", "level 2", "فرقة ثانية", "2nd", "second")) return "200";

  // Level 300 / 3rd year
  if (has("300", "l3", "level3", "level 3", "فرقة ثالثة", "3rd", "third")) return "300";

  // Level 400 / 4th year
  if (has("400", "l4", "level4", "level 4", "فرقة رابعة", "4th", "fourth")) return "400";

  return "other";
};
// --- END: Level Detection Logic ---

// --- Visitor handler: calls GAS with type=visitor and normalises response ---
async function handleVisitor() {
  const url = GAS_BASE_URL + "?type=visitor";
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("GAS HTTP (visitor) " + response.status);
  }

  const data = await response.json();
  const count =
    typeof data.count === "number"
      ? data.count
      : typeof data.visits === "number"
      ? data.visits
      : 0;

  return {
    statusCode: 200,
    headers: commonHeaders,
    body: JSON.stringify({ count }),
  };
}

// --- Notifications handler: calls GAS with type=notifications and adds `level` ---
async function handleNotifications() {
  const url = GAS_BASE_URL + "?type=notifications";
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("GAS HTTP (notifications) " + res.status);
  }

  const raw = await res.json();
  const files = Array.isArray(raw) ? raw : [];

  // Map and ensure we always send back the shape the frontend expects
  const enhanced = files.map((file) => {
    const name = file.name || file.title || "";
    const levelFromFile = file.level || detectLevel(name);

    return {
      name,
      url: file.url || file.link || "",
      mimeType: file.mimeType || "",
      updatedTime: file.updatedTime || file.modifiedTime || new Date().toISOString(),
      level: levelFromFile,
    };
  });

  return {
    statusCode: 200,
    headers: commonHeaders,
    body: JSON.stringify(enhanced),
  };
}

// --- Main Netlify handler ---
exports.handler = async (event, context) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: commonHeaders,
        body: "",
      };
    }

    const qs = event.queryStringParameters || {};
    const type = qs.type || qs.mode || "notifications"; // default: notifications

    if (type === "visitor") {
      return await handleVisitor();
    }

    if (type === "notifications") {
      return await handleNotifications();
    }

    // Unknown type
    return {
      statusCode: 400,
      headers: commonHeaders,
      body: JSON.stringify({
        error: true,
        message: "Unknown type. Use ?type=visitor or ?type=notifications",
      }),
    };
  } catch (error) {
    console.error("Unified znu-api Netlify function error:", error);
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
