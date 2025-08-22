// api/selectJudge.js
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
      return res.status(400).json({ error: '必須データが不足しています。' });
    }

    // ステータスが 'available' のレコードを 'in_use' に更新しようと試みる
    const { data, error, count } = await supabase
      .from('judges')
      .update({ status: 'in_use', session_id: sessionId })
      .eq('name', judgeName)
      .eq('status', 'available') // 'available' の場合のみ更新
      .select()
      .single();

    if (error) throw error;

    // countが0の場合、他の誰かが先に選択した（競合が発生した）
    if (count === 0) {
      return res.status(200).json({ status: 'error', message: `「${judgeName}」は、他の方が先に選択しました。リストを更新します。` });
    }

    res.status(200).json({ status: 'success', judgeName: data.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};