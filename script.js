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

// Supabaseクライアントを初期化
const SUPABASE_URL = "https://kbxlukbvhlxponcentyp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtieGx1a2J2aGx4cG9uY2VudHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjkzNDcsImV4cCI6MjA3MTM0NTM0N30.5MaOYEUaE4VPQHhDPW1MiJTYUsEQ4mR03Efri-iUHk4";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === 初期化と認証チェック ===
document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await setUserState(session);
  } else {
    setHeaderText("ようこそ");
    showScreen("landing-screen");
  }

  const shareButtons = document.querySelectorAll('[id^="share-button-"]');
  if (navigator.share) {
    shareButtons.forEach((btn) => (btn.style.display = "block"));
  } else {
    shareButtons.forEach((btn) => (btn.style.display = "none"));
  }
});

async function setUserState(session) {
  currentUser = session.user;
  // プロフィール情報を取得してユーザー名を表示
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", currentUser.id)
    .single();

  // ★ 取得した氏名を currentUser オブジェクトに保存
  currentUser.full_name = profile?.full_name;

  document.getElementById("user-info").textContent =
    currentUser.full_name || currentUser.email; // 名前の表示を優先

  await loadDashboard();
}

// === 認証関連 ===
// [修正] /api/signup を呼び出す (これは元のままでOK)
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
    if (!response.ok) throw new Error(result.error);
    alert(
      "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。"
    );
    showScreen("login-screen");
  } catch (error) {
    alert("登録エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

// [修正] エラーメッセージを画面に表示するように変更
async function handleLogin() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const errorMessageDiv = document.getElementById("login-error-message");

  // 以前のエラーメッセージをクリア
  errorMessageDiv.innerHTML = "";
  setLoading(true);

  try {
    // 入力が空の場合のチェック
    if (!email || !password) {
      throw new Error("メールアドレスとパスワードを入力してください。");
    }

    // Supabaseでログイン試行
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Supabaseからのエラーを分かりやすい日本語に変換
      if (error.message === "Invalid login credentials") {
        throw new Error("メールアドレスまたはパスワードが正しくありません。");
      }
      // その他の予期せぬエラー
      throw error;
    }

    await setUserState(data.session);
  } catch (error) {
    // エラーメッセージを画面に表示
    errorMessageDiv.innerHTML = `<div class="error">${error.message}</div>`;
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");

    const response = await fetch(
      `/api/getMySessions?userToken=${session.access_token}`
    );
    const mySessions = await response.json();
    if (!response.ok) throw new Error(mySessions.error);

    const sessionList = document.getElementById("session-list");
    sessionList.innerHTML = "";
    if (mySessions && mySessions.length > 0) {
      mySessions.forEach((session) => {
        const button = document.createElement("button");
        button.className = "key select-item";
        // ボタンのHTMLに詳細ボタンを追加
        button.innerHTML = `<div class="session-name">${session.name}</div>
            <div class="join-code-wrapper">
                <span class="join-code">コード: ${session.join_code}</span>
                <div class="copy-btn" onclick="copyJoinCode(event, '${
                  session.join_code
                }')">copy</div>
                <div class="details-btn" onclick="showSessionDetails(event, JSON.parse(decodeURIComponent('${encodeURIComponent(
                  JSON.stringify(session)
                )}')))">詳細</div>
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

// [修正] Supabase Edge Functionから /api/createSession の呼び出しへ変更
async function handleCreateSession() {
  const sessionName = document.getElementById("session-name-input").value;
  if (!sessionName) return alert("検定名を入力してください。");
  setLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");

    const response = await fetch("/api/createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionName, userToken: session.access_token }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    await loadDashboard();
  } catch (error) {
    alert("検定作成エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

// [修正] Supabase直接操作から /api/joinSession の呼び出しへ変更
async function handleJoinSession() {
  const joinCode = document
    .getElementById("join-code-input")
    .value.toUpperCase();
  if (!joinCode) return alert("参加コードを入力してください。");
  setLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");

    const response = await fetch("/api/joinSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode, userToken: session.access_token }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

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
    const { data, error } = await supabase.from("events").select("*");
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

// === 採点フロー (ここは変更なし) ===
function setupDisciplineScreen() {
  const keypad = document.getElementById("discipline-keypad");
  keypad.innerHTML = "";
  Object.keys(allTestEvents).forEach((d) =>
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
  (allTestEvents[discipline]?.[level] || []).forEach((e) =>
    createButton(keypad, e, () => selectEvent(e))
  );
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
      currentScore === "0" && num !== "0" ? num : currentScore + num;
    if (parseInt(currentScore) > 99) currentScore = "99";
    document.getElementById("score-display").textContent = currentScore || "0";
  }
}
function clearInput() {
  currentScore = "";
  document.getElementById("score-display").textContent = "0";
}
function confirmScore() {
  const score = parseInt(currentScore, 10) || 0;
  if (score < 0 || score > 99)
    return alert("得点は0-99の範囲で入力してください");
  confirmedScore = score;
  //   document.getElementById("confirmed-score").textContent = score;
  setHeaderText("ゼッケン番号を入力してください");
  showScreen("bib-screen");
}
function inputBibNumber(num) {
  if (currentBib.length < 3) {
    currentBib = currentBib === "0" && num !== "0" ? num : currentBib + num;
    if (parseInt(currentBib) > 999) currentBib = "999";
    document.getElementById("bib-display").textContent = currentBib || "0";
  }
}
function clearBibInput() {
  currentBib = "";
  document.getElementById("bib-display").textContent = "0";
}
function confirmBib() {
  const bib = parseInt(currentBib, 10) || 0;
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

// [修正] Supabase直接操作から /api/submitScore の呼び出しへ変更
async function submitEntry() {
  document.getElementById("submit-status").innerHTML =
    '<div class="status"><div class="loading"></div> 送信中...</div>';
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");

    const response = await fetch("/api/submitScore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSession.id,
        bib: parseInt(currentBib),
        score: confirmedScore,
        judge: document.getElementById("user-info").textContent,
        discipline: selectedDiscipline,
        level: selectedLevel,
        event: selectedEvent,
        userToken: session.access_token,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    onSubmitSuccess(result);
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
  if (typeof onConfirmAction === "function") onConfirmAction();
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
    const response = await fetch(
      `/api/getResults?sessionId=${currentSession.id}`
    );
    const { results } = await response.json();
    if (!response.ok) throw new Error(results.error);

    if (!results || results.length === 0) {
      alert("エクスポート/共有するデータがありません。");
      return;
    }
    const exportData = results.map((item) => ({
      採点日時: new Date(item.created_at).toLocaleString("ja-JP"),
      ゼッケン: item.bib,
      得点: item.score,
      種別: item.discipline,
      級: item.level,
      種目: item.event_name,
      検定員: item.judge_name,
      検定名: currentSession.name,
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
    else if (activeScreen === "dashboard-screen") setHeaderText("検定を選択");
  }
}
function createButton(parent, text, onClick) {
  const btn = document.createElement("button");
  btn.className = "key select-item";
  btn.textContent = text;
  btn.onclick = onClick;
  parent.appendChild(btn);
}
function showScreen(screenId) {
  window.scrollTo(0, 0);
  const header = document.querySelector(".header");
  if (
    screenId === "landing-screen" ||
    screenId === "login-screen" ||
    screenId === "signup-screen"
  ) {
    header.style.display = "none";
  } else {
    header.style.display = "block";
  }
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
  // ★ currentUser.email から currentUser.full_name に変更
  document.getElementById("user-info").textContent =
    currentUser?.full_name || "ログインしていません";

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
function copyJoinCode(event, code) {
  event.stopPropagation();
  navigator.clipboard
    .writeText(code)
    .then(() => {
      const copyButton = event.target;
      copyButton.textContent = "COPIED!";
      setTimeout(() => {
        copyButton.textContent = "COPY";
      }, 1500);
    })
    .catch((err) => {
      console.error("コピーに失敗しました:", err);
      alert("コピーに失敗しました。");
    });
}
function clearLoginError() {
  document.getElementById("login-error-message").innerHTML = "";
}

// === アカウント設定関連 ===

/**
 * アカウント設定画面を表示し、現在のユーザー名をフォームに設定する
 */
async function showAccountScreen() {
  try {
    setLoading(true);
    // 現在のユーザーのプロフィール情報を取得
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", currentUser.id)
      .single();

    if (error) throw error;

    // フォームに現在の名前を表示
    document.getElementById("account-name").value = profile.full_name || "";

    // パスワード入力欄はクリアしておく
    document.getElementById("account-password").value = "";
    document.getElementById("account-password-confirm").value = "";

    setHeaderText("アカウント設定");
    showScreen("account-screen");
  } catch (error) {
    alert("ユーザー情報の取得に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * ユーザー名を更新する
 */
async function handleUpdateName() {
  const newName = document.getElementById("account-name").value;
  if (!newName.trim()) return alert("氏名を入力してください。");

  setLoading(true);
  try {
    // 'profiles'テーブルのfull_nameを更新
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: newName })
      .eq("id", currentUser.id);

    if (error) throw error;

    // ★ 保存している氏名情報と、ヘッダー表示を両方更新
    currentUser.full_name = newName;
    document.getElementById("user-info").textContent = newName;

    alert("名前を更新しました。");
  } catch (error) {
    alert("名前の更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * パスワードを更新する
 */
async function handleUpdatePassword() {
  const newPassword = document.getElementById("account-password").value;
  const confirmPassword = document.getElementById(
    "account-password-confirm"
  ).value;

  if (newPassword.length < 6) {
    return alert("パスワードは6文字以上で入力してください。");
  }
  if (newPassword !== confirmPassword) {
    return alert("パスワードが一致しません。");
  }

  setLoading(true);
  try {
    // Supabaseの認証機能を使ってパスワードを更新
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    alert("パスワードを更新しました。");
    // 更新が成功したら入力欄をクリア
    document.getElementById("account-password").value = "";
    document.getElementById("account-password-confirm").value = "";
  } catch (error) {
    alert("パスワードの更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

// === アカウント削除関連 ===

/**
 * アカウント削除の確認画面を表示する
 */
function showDeleteConfirm() {
  // 現在アクティブな画面を記憶しておく（キャンセル時に戻るため）
  previousScreen = document.querySelector(".screen.active").id;
  showScreen("delete-confirm-screen");
}

/**
 * アカウントを削除する処理を実行する
 */
async function handleDeleteAccount() {
  setLoading(true);
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error("ログインしていません。");
    }

    // バックエンドの削除APIを呼び出す
    const response = await fetch("/api/deleteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: session.access_token }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "アカウントの削除に失敗しました。");
    }

    alert("アカウントが正常に削除されました。");

    // ログアウト処理を行い、ログイン画面に遷移する
    await supabase.auth.signOut();
    currentUser = null;
    currentSession = null;
    document.getElementById("user-info").textContent = "ログインしていません";
    document.getElementById("session-info").textContent = "検定未選択";
    setHeaderText("ようこそ");
    showScreen("login-screen");
  } catch (error) {
    alert("エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

// === 検定詳細関連 ===

/**
 * 検定詳細画面を表示する
 * @param {Event} event - クリックイベント
 * @param {object} session - 対象のセッション情報
 */
async function showSessionDetails(event, session) {
  event.stopPropagation(); // 親要素（検定選択ボタン）のクリックイベントを抑制
  setLoading(true);
  currentSession = session; // 現在のセッションとして設定

  try {
    const response = await fetch(
      `/api/getSessionDetails?sessionId=${session.id}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    // フォームに検定名をセット
    document.getElementById(
      "session-details-title"
    ).textContent = `${data.session_name} の詳細`;
    document.getElementById("session-details-name").value = data.session_name;

    // 参加者リストを表示
    const listEl = document.getElementById("session-participants-list");
    listEl.innerHTML = "";
    if (data.participants && data.participants.length > 0) {
      const ul = document.createElement("ul");
      ul.style.cssText = "list-style: none; padding-left: 0; margin: 0;";
      data.participants.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p.full_name;
        li.style.padding = "4px 0";
        ul.appendChild(li);
      });
      listEl.appendChild(ul);
    } else {
      listEl.textContent = "参加者はいません。";
    }

    setHeaderText("検定の詳細");
    showScreen("session-details-screen");
  } catch (error) {
    alert("詳細の読み込みに失敗しました: " + error.message);
    goBackToDashboard(); // エラー時はダッシュボードに戻る
  } finally {
    setLoading(false);
  }
}

/**
 * 検定名を更新する
 */
async function handleUpdateSessionName() {
  const newName = document.getElementById("session-details-name").value;
  if (!newName.trim()) return alert("検定名を入力してください。");
  if (!currentSession) return alert("対象の検定が選択されていません。");

  setLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");

    const response = await fetch("/api/updateSessionName", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSession.id,
        newName: newName,
        userToken: session.access_token,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    alert("検定名を更新しました。");
    document.getElementById(
      "session-details-title"
    ).textContent = `${newName} の詳細`;
    await loadDashboard(); // ダッシュボードのリストも更新
  } catch (error) {
    alert("更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * 検定削除の確認画面を表示する
 */
function showDeleteSessionConfirm() {
  previousScreen = "session-details-screen";
  showScreen("delete-session-confirm-screen");
}

/**
 * 検定を削除する
 */
async function handleDeleteSession() {
  if (!currentSession) return alert("対象の検定が選択されていません。");
  setLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");

    const response = await fetch("/api/deleteSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSession.id,
        userToken: session.access_token,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    alert("検定を削除しました。");
    await loadDashboard();
  } catch (error) {
    alert("削除に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}
