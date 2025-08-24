// api/getSessionDetails.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: "セッションIDが必要です。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // 手順1: 検定名を取得
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("name")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    // 手順2: 参加しているユーザーのIDリストを取得
    const { data: participantsLinks, error: linksError } = await supabase
      .from("session_participants")
      .select("user_id")
      .eq("session_id", sessionId);

    if (linksError) throw linksError;

    const userIds = participantsLinks.map((link) => link.user_id);

    // 手順3: 取得したIDリストをもとに、profilesテーブルから氏名を取得
    let participantsData = [];
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      participantsData = profiles;
    }

    // 最終的なデータをフロントエンドに返す
    res.status(200).json({
      session_name: sessionData.name,
      participants: participantsData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
