// netlify/functions/notification.js
// This file processes the data from Apps Script and adds a 'level' property.

const apiUrl = "https://script.google.com/macros/s/AKfycbw2laxCF0Xx2fB5nmlelsNaAzo9qTQ7fe2xgecar_DZPvu994T_OFxIQWONmDI6hVSe/exec";

// --- START: Added Level Detection Logic ---
/**
 * Detects the academic level based on a file name.
 * @param {string} name - The file name.
 * @returns {string} The detected level ('000', '100', '200', '300', '400', or 'other').
 */
const detectLevel = (name) => {
  if (!name) return 'other';
  const n = name.toLowerCase();

  const has = (...keys) => keys.some(k => n.includes(k));

  // Level 000 (تحضيري)
  if (
    /(^|\D)(000)(\D|$)/.test(n) ||
    has(
      'تحضيري',
      'prep',
      'prep.',
      'prep ',
      'prep-',
      'level 0',
      'level0',
      'lvl0',
      'lvl 0',
      ' l0',
      ' l00',
      'level 00',
      'level00'
    )
  ) {
    return '000';
  }

  // Level 100
  if (/(^|\D)(100)(\D|$)/.test(n) || has('level 1', 'level1', 'l100', 'lvl1', 'lvl 1', 'level 100', 'level100')) {
    return '100';
  }

  // Level 200
  if (/(^|\D)(200)(\D|$)/.test(n) || has('level 2', 'level2', 'l200', 'lvl2', 'lvl 2', 'level 200', 'level200')) {
    return '200';
  }

  // Level 300
  if (/(^|\D)(300)(\D|$)/.test(n) || has('level 3', 'level3', 'l300', 'lvl3', 'lvl 3', 'level 300', 'level300')) {
    return '300';
  }

  // Level 400
  if (/(^|\D)(400)(\D|$)/.test(n) || has('level 4', 'level4', 'l400', 'lvl4', 'lvl 4', 'level 400', 'level400')) {
    return '400';
  }

  return 'other';
};
// --- END: Added Level Detection Logic ---

exports.handler = async (event, context) => {
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Netlify-Function-Proxy/1.0'
      }
    });

    const text = await response.text(); // Apps Script returns JSON as text

    if (!response.ok) {
      console.error(`Upstream Apps Script request failed with status ${response.status}: ${text}`);
      // Pass through the error response
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: text,
      };
    }

    // --- START: Process Data and Add Levels ---
    let processedData = [];
    try {
      const data = JSON.parse(text); // Parse the JSON text

      if (Array.isArray(data)) {
        // Map over the data and add the 'level' property
        processedData = data.map(file => ({
          ...file,                       // ✅ هنا كانت المشكلة: لازم spread
          level: detectLevel(file.name) // Add the new level property
        }));
      }
      // If data is not an array, processedData will remain []
    } catch (parseError) {
      console.error("Error parsing JSON from Apps Script:", parseError);
      // Return an error if JSON is invalid
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: true,
          message: "Failed to parse upstream data",
          errorMessage: parseError.message,
        }),
      };
    }
    // --- END: Process Data and Add Levels ---

    // Return the *modified* data
    return {
      statusCode: 200, // We successfully processed it
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(processedData), // Send back the array with levels
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
