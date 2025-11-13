// netlify/functions/notification.js
// Proxy بسيط بين Netlify و Google Apps Script بدون Timeout مخصص

const apiUrl = "https://script.google.com/macros/s/AKfycbze63km1LuBbt9OZihVraf2pVKJF0PTlVTG71ifUseVECEMmKh7dUiwHhdLpue14-aG/exec";

exports.handler = async (event, context) => {
  try {
    const response = await fetch(apiUrl);
    const text = await response.text(); // Apps Script بيرجع JSON كنص

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (error) {
    console.error("Error in Netlify notifications function:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: true,
        message: "Failed to fetch notifications from Apps Script",
      }),
    };
  }
};
