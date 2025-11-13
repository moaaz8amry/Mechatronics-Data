// netlify/functions/notification.js
// نسخة بسيطة جداً عشان نتأكد إن Netlify Functions شغّالة

exports.handler = async (event, context) => {
  try {
    const demoData = [
      {
        name: "اختبار إشعار 1 - Level 000",
        url: "https://example.com/file1",
        mimeType: "application/pdf",
        updatedTime: new Date().toISOString(),
        level: "000"
      },
      {
        name: "اختبار إشعار 2 - Level 100",
        url: "https://example.com/file2",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        updatedTime: new Date(Date.now() - 3600_000).toISOString(),
        level: "100"
      }
    ];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "https://znuassistant.netlify.app",
      },
      body: JSON.stringify(demoData),
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
        message: "Failed to build demo notifications",
      }),
    };
  }
};
