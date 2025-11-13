// netlify/functions/notification.js
// Proxy بين Netlify و Google Apps Script عشان نتفادى CORS في المتصفح

const apiUrl = "https://script.google.com/macros/s/AKfycbze63km1LuBbt9OZihVraf2pVKJF0PTlVTG71ifUseVECEMmKh7dUiwHhdLpue14-aG/exec";

exports.handler = async (event, context) => {
  // نعمل timeout بسيط عشان ما نوصلش لحد 504 من Netlify
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8 ثواني

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });

    clearTimeout(timeout);

    const text = await response.text(); // Apps Script بيرجع JSON كنص أصلاً

    // لو Apps Script رجع كود غير 200، نرجّعه برضه عشان نعرف المشكلة
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: text,
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // نسمح لأي origin (أبسط وأريح مع previews)
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (error) {
    clearTimeout(timeout);
    console.error("Error in Netlify notifications function:", error);

    const isTimeout = error.name === "AbortError";

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: true,
        timeout: isTimeout,
        message: isTimeout
          ? "Timed out while contacting Google Apps Script"
          : "Failed to fetch notifications from Apps Script",
      }),
    };
  }
};
