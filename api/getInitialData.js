// api/getInitialData.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  try {
    const { sessionId } = req.query;
    console.log('--- getInitialData API Start ---'); // ★ログ1
    console.log('API received sessionId:', sessionId); // ★ログ2

    // デバッグのため、statusとsession_idも取得するように変更
    const { data: judgesData, error: judgesError } = await supabase
      .from('judges')
      .select('name, status, session_id')
      .or(`status.eq.available,session_id.eq.${sessionId || '""'}`);

    if (judgesError) throw judgesError;

    // ★ログ3: Supabaseから返ってきた生のデータを確認
    console.log('Supabase query result:', JSON.stringify(judgesData, null, 2));

    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('discipline, level, name');

    if (eventsError) throw eventsError;

    const availableJudges = judgesData.map(j => j.name);
    // ★ログ4: フロントエンドに返す最終的なリストを確認
    console.log('Final available judges list:', availableJudges);
    console.log('--- getInitialData API End ---');

    const allEvents = {};
    eventsData.forEach(e => {
      if (!allEvents[e.discipline]) allEvents[e.discipline] = {};
      if (!allEvents[e.discipline][e.level]) allEvents[e.discipline][e.level] = [];
      allEvents[e.discipline][e.level].push(e.name);
    });

    res.status(200).json({
      availableJudges: availableJudges,
      events: allEvents,
    });

  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};