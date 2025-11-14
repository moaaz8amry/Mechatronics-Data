// netlify/functions/visitor-count.js
// Simple persistent visitor counter using Netlify Blobs API.
// Each POST request will increment the counter and return the new value as JSON.

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const store = getStore("visitor-counter");
  const key = "total-visitors";

  try {
    // Handle CORS preflight if ever needed
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: "",
      };
    }

    if (event.httpMethod === "POST") {
      // Get current value (if exists)
      const { value } = await store.getWithMetadata(key);
      const current = value ? Number(value) : 0;
      const next = current + 1;

      // Save new value as string
      await store.set(key, String(next));

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ count: next }),
      };
    }

    // For GET requests, just return the current count without incrementing
    const value = await store.get(key);
    const count = value ? Number(value) : 0;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ count }),
    };
  } catch (error) {
    console.error("Visitor counter error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
