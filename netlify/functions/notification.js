// netlify/functions/notification.js
// Proxy بسيط بين Netlify و Google Apps Script
// + إضافة level لكل ملف (level00 / level100 / level200 / level300 / level400)

const apiUrl =
  "https://script.google.com/macros/s/AKfycbw2laxCF...x2fB5nmlelsNaAzo9qTQ7fe2xgecar_DZPvu994T_OFxIQWONmDI6hVSe/exec";

// دالة لتحديد الليفل من اسم الملف
const detectLevel = (name) => {
  if (!name) return "other";
  const n = String(name).toLowerCase();

  const has = (...keys) => keys.some((k) => n.includes(k));

  // LEVEL 00
  if (
    /(^|\D)(000)(\D|$)/.test(n) ||
    has(
      "تحضيري",
      "prep",
      "prep.",
      "prep ",
      "prep-",
      "level 0",
      "level0",
      "lvl0",
      "lvl 0",
      " l0",
      " l00"
    )
  ) {
    return "level00";
  }

  // LEVEL 100
  if (
    /(^|\D)(100)(\D|$)/.test(n) ||
    has("level 1", "level1", "l100", "lvl1", "lvl 1")
  ) {
    return "level100";
  }

  // LEVEL 200
  if (
    /(^|\D)(200)(\D|$)/.test(n) ||
    has("level 2", "level2", "l200", "lvl2", "lvl 2")
  ) {
    return "level200";
  }

  // LEVEL 300
  if (
    /(^|\D)(300)(\D|$)/.test(n) ||
    has("level 3", "level3", "l300", "lvl3", "lvl 3")
  ) {
    return "level300";
  }

  // LEVEL 400
  if (
    /(^|\D)(400)(\D|$)/.test(n) ||
    has("level 4", "level4", "l400", "lvl4", "lvl 4")
  ) {
    return "level400";
  }

  return "other";
};

exports.handler = async (event, context) => {
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Netlify-Function-Proxy/1.0",
      },
    });

    const text = await response.text();

    // لو Apps Script راجع Error، رجّعه زي ما هو
    if (!response.ok) {
      console.error(
        `Upstream Apps Script request failed with status ${response.status}: ${text}`
      );
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: text,
      };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // لو مش JSON، رجّعه زي ما هو
      console.error("Failed to parse Apps Script JSON:", e);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: text,
      };
    }

    // لو اللي جاي مش Array، رجّعه زي ما هو
    if (!Array.isArray(data)) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(data),
      };
    }

    // هنا بنضيف level لكل ملف
    const withLevels = data.map((file) => {
      const level = detectLevel(file.name || file.title || "");
      return { ...file, level }; // <== هنا السحر
    });

    // IMPORTANT:
    // بنرجّع ARRAY زي الأول علشان الكود في الـ front يشتغل زي ما هو
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(withLevels),
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
