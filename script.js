// === グローバル変数 ===
let currentUser = null;
let currentSession = null;
let allTestEvents = {};
let currentScore = "",
  currentBib = "",
  confirmedScore = 0;
let selectedDiscipline = "",
  selectedLevel = "",
  selectedEvent = "";
let onConfirmAction = null;
let previousScreen = "";

// 実際のSupabaseのURLとanonキーに置き換えてください
const SUPABASE_URL = "https://kbxlukbvhlxponcentyp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtieGx1a2J2aGx4cG9uY2VudHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjkzNDcsImV4cCI6MjA3MTM0NTM0N30.5MaOYEUaE4VPQHhDPW1MiJTYUsEQ4mR03Efri-iUHk4";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === 初期化と認証チェック ===
document.addEventListener("DOMContentLoaded", async () => {
  // ログイン状態をチェック
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await setUserState(session);
  } else {
    setHeaderText("ようこそ");
    showScreen("login-screen");
  }

  // 共有ボタンの表示制御
  const shareButtons = document.querySelectorAll('[id^="share-button-"]');
  if (navigator.share) {
    shareButtons.forEach((btn) => (btn.style.display = "block"));
  } else {
    shareButtons.forEach((btn) => (btn.style.display = "none"));
  }
});

async function setUserState(session) {
  currentUser = session.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", currentUser.id)
    .single();
  document.getElementById("user-info").textContent =
    profile?.full_name || currentUser.email;
  await loadDashboard();
}

// === 認証関連 ===
async function handleSignup() {
  const fullName = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  setLoading(true);
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);

    alert(
      "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。\n（Supabase側でメール確認を無効にしている場合は、すぐにログインできます）"
    );
    showScreen("login-screen");
  } catch (error) {
    alert("登録エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

async function handleLogin() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    await setUserState(data.session);
  } catch (error) {
    alert("ログインエラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  setLoading(true);
  await supabase.auth.signOut();
  currentUser = null;
  currentSession = null;
  document.getElementById("user-info").textContent = "ログインしていません";
  document.getElementById("session-info").textContent = "検定未選択";
  setHeaderText("ようこそ");
  showScreen("login-screen");
  setLoading(false);
}

// === ダッシュボードとセッション管理 ===
async function loadDashboard() {
  setHeaderText("検定を選択");
  showScreen("dashboard-screen");
  setLoading(true);
  try {
    // SupabaseのDB関数を呼び出す
    // この 'get_my_sessions' は次のステップで作成します
    const { data, error } = await supabase.rpc("get_my_sessions");
    if (error) throw error;

    const sessionList = document.getElementById("session-list");
    sessionList.innerHTML = ""; // リストをクリア
    if (data && data.length > 0) {
      data.forEach((session) => {
        const button = document.createElement("button");
        button.className = "key select-item";
        button.innerHTML = `<div class="session-name">${session.name}</div>
          <div class="join-code-wrapper">
              <span class="join-code">コード: ${session.join_code}</span>
              <div class="copy-btn" onclick="copyJoinCode(event, '${session.join_code}')">copy</div>
          </div>`;
        button.onclick = () => selectSession(session);
        sessionList.appendChild(button);
      });
    } else {
      sessionList.innerHTML =
        '<p style="color: var(--secondary-text);">参加中の検定はありません。</p>';
    }
  } catch (error) {
    alert("検定の読み込みエラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

async function handleCreateSession() {
  const sessionName = document.getElementById("session-name-input").value;
  if (!sessionName) return alert("検定名を入力してください。");
  setLoading(true);
  try {
    // Supabase Edge Functionを呼び出す
    // この 'create-session' は次のステップで作成します
    const { data, error } = await supabase.functions.invoke("create-session", {
      body: { sessionName },
    });
    if (error) throw error;
    await loadDashboard();
  } catch (error) {
    alert("検定作成エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

async function handleJoinSession() {
  const joinCode = document
    .getElementById("join-code-input")
    .value.toUpperCase();
  if (!joinCode) return alert("参加コードを入力してください。");
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("id")
      .eq("join_code", joinCode)
      .single();
    if (error || !data) throw new Error("無効な参加コードです。");
    const { error: joinError } = await supabase
      .from("session_participants")
      .insert({ session_id: data.id, user_id: currentUser.id });
    if (joinError && joinError.code !== "23505") throw joinError; // 重複以外のエラーは投げる
    await loadDashboard();
  } catch (error) {
    alert("検定参加エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

async function selectSession(session) {
  currentSession = session;
  document.getElementById("session-info").textContent = currentSession.name;
  setLoading(true);
  try {
    const { data, error } = await supabase.from("events").select("*"); // 種目データを取得
    if (error) throw error;

    allTestEvents = {};
    data.forEach((e) => {
      if (!allTestEvents[e.discipline]) allTestEvents[e.discipline] = {};
      if (!allTestEvents[e.discipline][e.level])
        allTestEvents[e.discipline][e.level] = [];
      allTestEvents[e.discipline][e.level].push(e.name);
    });

    setupDisciplineScreen();
    setHeaderText("種別を選択してください");
    showScreen("discipline-screen");
  } catch (error) {
    alert("種目データの読み込みエラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

// === 採点フローの関数群 ===
function setupDisciplineScreen() {
  const keypad = document.getElementById("discipline-keypad");
  keypad.innerHTML = "";
  const disciplines = Object.keys(allTestEvents);
  disciplines.forEach((d) =>
    createButton(keypad, d, () => selectDiscipline(d))
  );
}
function setupLevelScreen(discipline) {
  const keypad = document.getElementById("level-keypad");
  keypad.innerHTML = "";
  const levels = Object.keys(allTestEvents[discipline] || {}).sort(
    (a, b) =>
      parseInt(
        a.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        )
      ) -
      parseInt(
        b.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        )
      )
  );
  levels.forEach((l) => createButton(keypad, l, () => selectLevel(l)));
}
function setupEventScreen(discipline, level) {
  const keypad = document.getElementById("event-keypad");
  keypad.innerHTML = "";
  const events = allTestEvents[discipline]?.[level] || [];
  events.forEach((e) => createButton(keypad, e, () => selectEvent(e)));
}

function selectDiscipline(discipline) {
  selectedDiscipline = discipline;
  updateInfoDisplay();
  setupLevelScreen(discipline);
  setHeaderText("級を選択してください");
  showScreen("level-screen");
}
function selectLevel(level) {
  selectedLevel = level;
  updateInfoDisplay();
  setupEventScreen(selectedDiscipline, level);
  setHeaderText("種目を選択してください");
  showScreen("event-screen");
}
function selectEvent(event) {
  selectedEvent = event;
  updateInfoDisplay();
  nextSkier();
}

function inputNumber(num) {
  if (currentScore.length < 2) {
    currentScore =
      currentScore === "0" && num !== "0"
        ? num
        : currentScore !== "0"
        ? currentScore + num
        : "0";
    const value = parseInt(currentScore) || 0;
    if (value <= 99)
      document.getElementById("score-display").textContent =
        currentScore || "0";
    else currentScore = currentScore.slice(0, -1);
  }
}
function clearInput() {
  currentScore = "";
  document.getElementById("score-display").textContent = "0";
}
function confirmScore() {
  const score = parseInt(currentScore) || 0;
  if (score < 0 || score > 99)
    return alert("得点は0-99の範囲で入力してください");
  confirmedScore = score;
  document.getElementById("confirmed-score").textContent = score;
  setHeaderText("ゼッケン番号を入力してください");
  showScreen("bib-screen");
}
function inputBibNumber(num) {
  if (currentBib.length < 3) {
    currentBib =
      currentBib === "0" && num !== "0"
        ? num
        : currentBib !== "0"
        ? currentBib + num
        : "0";
    const value = parseInt(currentBib) || 0;
    if (value <= 999)
      document.getElementById("bib-display").textContent = currentBib || "0";
    else currentBib = currentBib.slice(0, -1);
  }
}
function clearBibInput() {
  currentBib = "";
  document.getElementById("bib-display").textContent = "0";
}
function confirmBib() {
  const bib = parseInt(currentBib) || 0;
  if (bib < 1 || bib > 999)
    return alert("ゼッケン番号は1-999の範囲で入力してください");
  document.getElementById("final-bib").textContent = String(bib).padStart(
    3,
    "0"
  );
  document.getElementById("final-score").textContent = confirmedScore;
  setHeaderText("採点内容を確認してください");
  showScreen("submit-screen");
}

async function submitEntry() {
  document.getElementById("submit-status").innerHTML =
    '<div class="status"><div class="loading"></div> 送信中...</div>';
  try {
    const { error } = await supabase.from("results").insert({
      session_id: currentSession.id,
      bib: parseInt(currentBib),
      score: confirmedScore,
      judge_name: document.getElementById("user-info").textContent, // ログイン中のユーザー名
      discipline: selectedDiscipline,
      level: selectedLevel,
      event_name: selectedEvent,
    });
    if (error) throw error;
    onSubmitSuccess({ bib: currentBib, score: confirmedScore });
  } catch (error) {
    onSubmitError(error);
  }
}
function onSubmitSuccess(result) {
  document.getElementById("completed-bib").textContent = String(
    result.bib
  ).padStart(3, "0");
  document.getElementById("completed-score").textContent = result.score;
  setHeaderText("送信完了しました");
  showScreen("complete-screen");
}
function nextSkier() {
  currentScore = "";
  currentBib = "";
  confirmedScore = 0;
  clearInput();
  clearBibInput();
  document.getElementById("submit-status").innerHTML = "";
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}

// === ナビゲーションとヘルパー関数 ===
function changeEvent() {
  showConfirmDialog("現在の採点を中断し、種目選択に戻りますか？", () => {
    selectedDiscipline = "";
    selectedLevel = "";
    selectedEvent = "";
    updateInfoDisplay();
    setHeaderText("種別を選択してください");
    showScreen("discipline-screen");
  });
}
function executeConfirm() {
  if (typeof onConfirmAction === "function") {
    onConfirmAction();
  }
  onConfirmAction = null;
}
function goBackToDashboard() {
  selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("検定を選択");
  showScreen("dashboard-screen");
}

function goBackToDisciplineSelect() {
  selectedDiscipline = "";
  selectedLevel = "";
  selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("種別を選択してください");
  showScreen("discipline-screen");
}
function goBackToLevelSelect() {
  selectedLevel = "";
  selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("級を選択してください");
  showScreen("level-screen");
}
function goBack() {
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}
function editEntry() {
  currentScore = String(confirmedScore);
  document.getElementById("score-display").textContent = currentScore;
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}
function showConfirmDialog(message, onConfirm) {
  previousScreen = document.querySelector(".screen.active").id;
  document.getElementById("confirm-message").textContent = message;
  onConfirmAction = onConfirm;
  showScreen("confirm-screen");
}
function cancelConfirm() {
  showScreen(previousScreen);
}
async function handleExportOrShare() {
  setLoading(true);
  setHeaderText("データを準備中...");
  try {
    const { data, error } = await supabase
      .from("results")
      .select(
        "created_at, bib, score, discipline, level, event_name, judge_name"
      )
      .eq("session_id", currentSession.id)
      .order("created_at");
    if (error) throw error;
    if (!data || data.length === 0) {
      alert("エクスポート/共有するデータがありません。");
      return;
    }
    const exportData = data.map((item) => ({
      採点日時: new Date(item.created_at).toLocaleString("ja-JP"),
      ゼッケン: item.bib,
      得点: item.score,
      種別: item.discipline,
      級: item.level,
      種目: item.event_name,
      検定員: item.judge_name,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "採点結果");
    const fileName = `${currentSession.name}_採点結果.xlsx`;
    if (navigator.share) {
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: currentSession.name,
          text: "採点結果のExcelファイルです。",
          files: [file],
        });
      } else {
        XLSX.writeFile(workbook, fileName);
      }
    } else {
      XLSX.writeFile(workbook, fileName);
    }
  } catch (error) {
    if (error.name !== "AbortError") onApiError(error);
  } finally {
    setLoading(false);
    const activeScreen = document.querySelector(".screen.active").id;
    if (activeScreen === "complete-screen") setHeaderText("送信完了しました");
  }
}
function createButton(parent, text, onClick) {
  const btn = document.createElement("button");
  btn.className = "key select-item";
  btn.innerHTML = text;
  btn.onclick = onClick;
  parent.appendChild(btn);
}
function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}
function setHeaderText(text) {
  document.getElementById("header-main-text").textContent = text;
}
function setLoading(isLoading) {
  document
    .getElementById("loading-overlay")
    .classList.toggle("active", isLoading);
}
function updateInfoDisplay() {
  document.getElementById("user-info").textContent =
    currentUser?.email || "ログインしていません";
  document.getElementById("session-info").textContent =
    currentSession?.name || "未選択";
  const selEl = document.getElementById("selection-info");
  if (selEl) selEl.textContent = getSelectionLabel();
}
function getSelectionLabel() {
  const parts = [];
  if (selectedDiscipline) parts.push(selectedDiscipline);
  if (selectedLevel) parts.push(selectedLevel);
  if (selectedEvent) parts.push(selectedEvent);
  return parts.length ? `選択中: ${parts.join(" / ")}` : "選択中: ー";
}
function onApiError(error) {
  alert("エラー: " + error.message);
  setLoading(false);
}
function onSubmitError(error) {
  document.getElementById(
    "submit-status"
  ).innerHTML = `<div class="error">送信エラー: ${error.message}<br><button class="nav-btn" onclick="submitEntry()">再試行</button></div>`;
}
/**
 * 参加コードをクリップボードにコピーする
 * @param {Event} event - クリックイベント
 * @param {string} code - コピーするコード
 */
function copyJoinCode(event, code) {
  // ボタン全体がクリックされるのを防ぐ
  event.stopPropagation();

  navigator.clipboard
    .writeText(code)
    .then(() => {
      const copyButton = event.target;
      copyButton.textContent = "copied";
      setTimeout(() => {
        copyButton.textContent = "copy";
      }, 1500); // 1.5秒後に元に戻す
    })
    .catch((err) => {
      console.error("コピーに失敗しました:", err);
      alert("コピーに失敗しました。");
    });
}
