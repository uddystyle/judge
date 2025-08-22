// api/releaseJudge.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { judgeName, sessionId } = req.body;
    if (!judgeName || !sessionId) {
      return res.status(200).json({ status: 'ok' }); // データがなければ何もしない
    }

    // 自分のセッションIDが設定されているレコードのみ解放する
    await supabase
      .from('judges')
      .update({ status: 'available', session_id: null })
      .eq('name', judgeName)
      .eq('session_id', sessionId);

    res.status(200).json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};