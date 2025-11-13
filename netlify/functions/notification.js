// netlify/functions/notification.js

const apiUrl = "https://script.google.com/macros/s/AKfycbzN5pAPEAsiV50q7czW3fREchi8glqTtXJbPqXb0iPKVLgpy_sOJEJh6EJZDHNMwGFm/exec";

exports.handler = async (event, context) => {
  try {
    const response = await fetch(apiUrl);
    const text = await response.text(); // Apps Script بيرجع JSON كنص أصلاً

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // ممكن تخليها "*" لو بتجرّب على Preview Domains
        "Access-Control-Allow-Origin": "https://znuassistant.netlify.app",
      },
      body: text,
    };
  } catch (error) {
    console.error("Error in Netlify notifications function:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "https://znuassistant.netlify.app",
      },
      body: JSON.stringify({
        error: true,
        message: "Failed to fetch notifications from Apps Script",
      }),
    };
  }
};
