export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan.'
    });
  }

  try {

    const response = await fetch(
      'https://script.google.com/macros/s/AKfycbxwpkFzjuBeTEJD5C5rVtek07MXBT5jQor3P1yrmQFvRdQvU1r5zYG22_ZSDmRij0J-/exec',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },

        body: JSON.stringify(req.body)
      }
    );

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {

      return res.status(502).json({
        success: false,
        message: 'Response Apps Script bukan JSON.',
        raw: text
      });

    }

    return res.status(200).json(result);

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
}
