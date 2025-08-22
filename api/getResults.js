// api/getResults.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  try {
    // resultsテーブルからid以外の全データを取得し、作成日時順に並べる
    const { data, error } = await supabase
      .from('results')
      .select('created_at, bib, score, discipline, event_name, judge_name')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 成功した場合、フロントエンドに結果データを返す
    res.status(200).json({
      results: data
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};