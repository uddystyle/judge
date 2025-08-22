// api/clearCache.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  try {
    // 'judges'テーブルの全ての行を更新する
    const { error } = await supabase
      .from('judges')
      .update({ status: 'available', session_id: null })
      .neq('status', 'available'); // 既に'available'のものは更新しない

    if (error) {
      throw error;
    }

    console.log('検定員のステータスキャッシュをクリアしました。');
    // ブラウザに成功メッセージを表示
    res.status(200).send('検定員の「使用中」ステータスを全てリセットしました。アプリの「リストを更新」ボタンを押してください。');

  } catch (error) {
    console.error('キャッシュのクリアに失敗しました:', error.message);
    res.status(500).json({ error: error.message });
  }
};