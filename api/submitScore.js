// api/submitScore.js

const { createClient } = require('@supabase/supabase-js');

// .env.localファイルから環境変数を読み込む
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // POSTリクエスト以外は受け付けない
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // フロントエンドから送られてきたデータを取得
    const { bib, score, judge, discipline, event } = req.body;

    // 簡単なデータ検証
    if (!bib || !score || !judge || !discipline || !event) {
      return res.status(400).json({ error: '必須データが不足しています。' });
    }

    // Supabaseの'results'テーブルに新しい行としてデータを挿入
    const { data, error } = await supabase
      .from('results')
      .insert([
        {
          bib: bib,
          score: score,
          judge_name: judge,
          discipline: discipline,
          event_name: event
        }
      ])
      .select()
      .single(); // 挿入したデータを返却

    // データベースエラーがあればここで処理
    if (error) {
      throw error;
    }

    // 成功した場合、フロントエンドに成功の応答とデータを返す
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