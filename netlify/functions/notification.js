// netlify/functions/notification.js
// Proxy بسيط بين Netlify و Google Apps Script
// وفي نفس الوقت بنقسّم الداتا حسب الليفل

const apiUrl =
  "https://script.google.com/macros/s/AKfycbw2laxCF0Xx2fB5nmlelsNaAzo9qTQ7fe2xgecar_DZPvu994T_OFxIQWONmDI6hVSe/exec";

// نفس دالة detectLevel اللي في الـ front-end تقريباً
const detectLevel = (name) => {
  if (!name) return "other";
  const n = String(name).toLowerCase();

  const has = (...keys) => keys.some((k) => n.includes(k));

  // مستوى 000 / Preparatory
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
    return "000";
  }

  // مستوى 100
  if (
    /(^|\D)(100)(\D|$)/.test(n) ||
    has("level 1", "level1", "l100", "lvl1", "lvl 1")
  ) {
    return "100";
  }

  // مستوى 200
  if (
    /(^|\D)(200)(\D|$)/.test(n) ||
    has("level 2", "level2", "l200", "lvl2", "lvl 2")
  ) {
    return "200";
  }

  // مستوى 300
  if (
    /(^|\D)(300)(\D|$)/.test(n) ||
    has("level 3", "level3", "l300", "lvl3", "lvl 3")
  ) {
    return "300";
  }

  // مستوى 400
  if (
    /(^|\D)(400)(\D|$)/.test(n) ||
    has("level 4", "level4", "l400", "lvl4", "lvl 4")
  ) {
    return "400";
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

    const text = await response.text(); // Apps Script بيرجع JSON كنص

    // لو الـ Apps Script رجّع Error، نعدّيه زي ما هو
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
      // لو مش JSON اصلاً، رجّعه زي ما هو
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

    // هنا هنقسّم حسب الليفل
    const grouped = {
      level00: [],
      level100: [],
      level200: [],
      level300: [],
      level400: [],
      other: [],
    };

    const all = data.map((file) => {
      const level = detectLevel(file.name);
      const withLevel = { ...file, level };

      switch (level) {
        case "000":
          grouped.level00.push(withLevel);
          break;
        case "100":
          grouped.level100.push(withLevel);
          break;
        case "200":
          grouped.level200.push(withLevel);
          break;
        case "300":
          grouped.level300.push(withLevel);
          break;
        case "400":
          grouped.level400.push(withLevel);
          break;
        default:
          grouped.other.push(withLevel);
      }

      return withLevel;
    });

    // تقدر في الـ front-end تستخدم:
    // data.all        → كل الملفات مع level
    // data.level00    → ملفات مستوى 00
    // data.level100   → ملفات مستوى 100
    // ...
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        all,
        ...grouped,
      }),
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
