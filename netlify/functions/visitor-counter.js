// netlify/functions/visitor-counter.js
// This function is called by your index.html.
// It forwards the request to a Google Apps Script Web App
// which actually increments and stores the visitor count.

const GAS_VISITOR_URL = "https://script.google.com/macros/s/AKfycby_-d8jTAAQP8k9joGhJWTIue-0V9iDXsBT9SHDC9nLXhjeNHQKsf0gkoNbxlDRhzhD0Q/exec";

exports.handler = async (event, context) => {
  try {
    // Optional: handle CORS preflight
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

    // Call the Google Apps Script Web App
    const response = await fetch(GAS_VISITOR_URL);

    if (!response.ok) {
      throw new Error("GAS HTTP " + response.status);
    }

    const data = await response.json();

    // Normalise the property name just in case
    const count = typeof data.count === "number"
      ? data.count
      : (typeof data.visits === "number" ? data.visits : 0);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ count }),
    };
  } catch (error) {
    console.error("Visitor counter Netlify function error:", error);
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
