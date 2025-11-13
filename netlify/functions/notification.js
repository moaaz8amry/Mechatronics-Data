// netlify/functions/notification.js
// Proxy بسيط بين Netlify و Google Apps Script
// (A simple proxy between Netlify and Google Apps Script)
// تم إضافة خيارات لـ fetch لضمان متابعة إعادة التوجيه وإضافة User-Agent
// (Added options to fetch to ensure following redirects and add a User-Agent)

const apiUrl = "https://script.google.com/macros/s/AKfycbze63km1LuBbt9OZihVraf2pVKJF0PTlVTG71ifUseVECEMmKh7dUiwHhdLpue14-aG/exec";

exports.handler = async (event, context) => {
  try {
    // Added fetch options:
    // method: 'GET' - Explicitly state the method.
    // redirect: 'follow' - Explicitly tells fetch to follow redirects (this is the default, but it's good to be clear).
    // headers - Added a basic User-Agent, as some servers (like Apps Script)
    // might behave differently or block requests without one.
    const response = await fetch(apiUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Netlify-Function-Proxy/1.0'
      }
    });

  	const text = await response.text(); // Apps Script بيرجع JSON كنص

    // Check if the final response from Google Apps Script was not successful
    if (!response.ok) {
      // Log the error from Apps Script for debugging
      console.error(`Upstream Apps Script request failed with status ${response.status}: ${text}`);
    }

    // Pass through the response, including the original status code
    return {
      statusCode: response.status, // Pass through the final status code (e.g., 200, 404, etc.)
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: text, // Pass the text (JSON) from Apps Script
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
  	  message: "Netlify function encountered an internal error",
      errorMessage: error.message,
      }),
    };
  }
};
