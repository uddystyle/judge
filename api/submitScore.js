// api/submitScore.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { bib, score, judge, discipline, event } = req.body;

    if (!bib || !score || !judge || !discipline || !event) {
      return res.status(400).json({ error: '必須データが不足しています。' });
    }

    // ▼▼▼ 修正箇所 ▼▼▼
    // 挿入するデータに、サーバーの現在時刻をcreated_atとして追加
    const { data, error } = await supabase
      .from('results')
      .insert([
        {
          created_at: new Date().toISOString(), // 現在時刻を追加
          bib: bib,
          score: score,
          judge_name: judge,
          discipline: discipline,
          event_name: event
        }
      ])
      .select()
      .single();
    // ▲▲▲ 修正完了 ▲▲▲

    if (error) {
      throw error;
    }

    console.log('データ保存成功:', data);
    res.status(200).json({
      status: 'success',
      bib: data.bib,
      score: data.score
    });

  } catch (error) {
    console.error('データ保存エラー:', error.message);
    res.status(500).json({ error: error.message });
  }
};