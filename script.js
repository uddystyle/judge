// === グローバル変数 ===
let currentUser = null;
let currentSession = null;
let allTestEvents = {};
let currentScore = "";
let currentBib = "";
let confirmedScore = 0;
let selectedDiscipline = "";
let selectedLevel = "";
let selectedEvent = "";
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
  if ("share" in navigator) {
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
  if (currentUser) {
    currentUser.full_name = profile?.full_name;
  }
  const userInfoEl = document.getElementById("user-info");
  if (userInfoEl) {
    userInfoEl.textContent = currentUser?.full_name || currentUser?.email || "";
  }
  await loadDashboard();
}
// === 認証関連 ===
async function handleSignup() {
  const fullNameInput = document.getElementById("signup-name");
  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");
  const fullName = fullNameInput?.value || "";
  const email = emailInput?.value || "";
  const password = passwordInput?.value || "";
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
async function handleLogin() {
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const errorMessageDiv = document.getElementById("login-error-message");
  const email = emailInput?.value || "";
  const password = passwordInput?.value || "";
  if (errorMessageDiv) errorMessageDiv.innerHTML = "";
  setLoading(true);
  try {
    if (!email || !password) {
      throw new Error("メールアドレスとパスワードを入力してください。");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (error.message === "Invalid login credentials") {
        throw new Error("メールアドレスまたはパスワードが正しくありません。");
      }
      throw error;
    }
    if (data.session) {
      await setUserState(data.session);
    } else {
      throw new Error("セッションの取得に失敗しました。");
    }
  } catch (error) {
    if (errorMessageDiv) {
      errorMessageDiv.innerHTML = `<div class="error">${error.message}</div>`;
    }
  } finally {
    setLoading(false);
  }
}
async function handleLogout() {
  setLoading(true);
  await supabase.auth.signOut();
  currentUser = null;
  currentSession = null;
  const userInfoEl = document.getElementById("user-info");
  if (userInfoEl) userInfoEl.textContent = "ログインしていません";
  const sessionInfoEl = document.getElementById("session-info");
  if (sessionInfoEl) sessionInfoEl.textContent = "検定未選択";
  setHeaderText("ようこそ");
  showScreen("landing-screen");
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
    if (response.status === 401) {
      throw new Error("認証されていません。");
    }
    const mySessions = await response.json();
    if (!response.ok) {
      const errorResult = mySessions;
      throw new Error(errorResult.error || "検定の読み込みに失敗しました。");
    }
    const sessionList = document.getElementById("session-list");
    if (!sessionList) return;
    sessionList.innerHTML = "";
    if (mySessions && mySessions.length > 0) {
      mySessions.forEach((session) => {
        const button = document.createElement("button");
        button.className = "key select-item";
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
    if (
      error.message.includes("ログインしていません") ||
      error.message.includes("認証されていません")
    ) {
      currentUser = null;
      currentSession = null;
      const userInfoEl = document.getElementById("user-info");
      if (userInfoEl) userInfoEl.textContent = "ログインしていません";
      const sessionInfoEl = document.getElementById("session-info");
      if (sessionInfoEl) sessionInfoEl.textContent = "検定未選択";
      setHeaderText("ようこそ");
      showScreen("landing-screen");
    } else {
      alert("検定の読み込みエラー: " + error.message);
    }
  } finally {
    setLoading(false);
  }
}
async function handleCreateSession() {
  const sessionNameInput = document.getElementById("session-name-input");
  const sessionName = sessionNameInput?.value || "";
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
async function handleJoinSession() {
  const joinCodeInput = document.getElementById("join-code-input");
  const joinCode = joinCodeInput?.value.toUpperCase() || "";
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
  const sessionInfoEl = document.getElementById("session-info");
  if (sessionInfoEl && currentSession)
    sessionInfoEl.textContent = currentSession.name;
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
// === 採点フロー ===
function setupDisciplineScreen() {
  const keypad = document.getElementById("discipline-keypad");
  if (!keypad) return;
  keypad.innerHTML = "";
  Object.keys(allTestEvents).forEach((d) =>
    createButton(keypad, d, () => selectDiscipline(d))
  );
}
function setupLevelScreen(discipline) {
  const keypad = document.getElementById("level-keypad");
  if (!keypad) return;
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
  if (!keypad) return;
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
    const scoreDisplay = document.getElementById("score-display");
    if (scoreDisplay) scoreDisplay.textContent = currentScore || "0";
  }
}
function clearInput() {
  currentScore = "";
  const scoreDisplay = document.getElementById("score-display");
  if (scoreDisplay) scoreDisplay.textContent = "0";
}
function confirmScore() {
  const score = parseInt(currentScore, 10) || 0;
  if (score < 0 || score > 99)
    return alert("得点は0-99の範囲で入力してください");
  confirmedScore = score;
  setHeaderText("ゼッケン番号を入力してください");
  showScreen("bib-screen");
}
function inputBibNumber(num) {
  if (currentBib.length < 3) {
    currentBib = currentBib === "0" && num !== "0" ? num : currentBib + num;
    if (parseInt(currentBib) > 999) currentBib = "999";
    const bibDisplay = document.getElementById("bib-display");
    if (bibDisplay) bibDisplay.textContent = currentBib || "0";
  }
}
function clearBibInput() {
  currentBib = "";
  const bibDisplay = document.getElementById("bib-display");
  if (bibDisplay) bibDisplay.textContent = "0";
}
function confirmBib() {
  const bib = parseInt(currentBib, 10) || 0;
  if (bib < 1 || bib > 999)
    return alert("ゼッケン番号は1-999の範囲で入力してください");
  const finalBib = document.getElementById("final-bib");
  if (finalBib) finalBib.textContent = String(bib).padStart(3, "0");
  const finalScore = document.getElementById("final-score");
  if (finalScore) finalScore.textContent = String(confirmedScore);
  setHeaderText("採点内容を確認してください");
  showScreen("submit-screen");
}
async function submitEntry() {
  const submitStatus = document.getElementById("submit-status");
  if (!submitStatus) return;
  submitStatus.innerHTML =
    '<div class="status"><div class="loading"></div> 送信中...</div>';
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");
    if (!currentSession) throw new Error("検定が選択されていません。");
    const userInfo =
      document.getElementById("user-info")?.textContent || "不明な検定員";
    const response = await fetch("/api/submitScore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSession.id,
        bib: parseInt(currentBib),
        score: confirmedScore,
        judge: userInfo,
        discipline: selectedDiscipline,
        level: selectedLevel,
        event: selectedEvent,
        userToken: session.access_token,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      const errorResult = result;
      throw new Error(errorResult.error || "送信に失敗しました。");
    }
    onSubmitSuccess(result);
  } catch (error) {
    onSubmitError(error);
  }
}
function onSubmitSuccess(result) {
  const completedBib = document.getElementById("completed-bib");
  if (completedBib)
    completedBib.textContent = String(result.bib).padStart(3, "0");
  const completedScore = document.getElementById("completed-score");
  if (completedScore) completedScore.textContent = String(result.score);
  setHeaderText("送信完了しました");
  showScreen("complete-screen");
}
function nextSkier() {
  currentScore = "";
  currentBib = "";
  confirmedScore = 0;
  clearInput();
  clearBibInput();
  const submitStatus = document.getElementById("submit-status");
  if (submitStatus) submitStatus.innerHTML = "";
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
  const scoreDisplay = document.getElementById("score-display");
  if (scoreDisplay) scoreDisplay.textContent = currentScore;
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}
function showConfirmDialog(message, onConfirm) {
  const activeScreen = document.querySelector(".screen.active");
  if (activeScreen) previousScreen = activeScreen.id;
  const confirmMessage = document.getElementById("confirm-message");
  if (confirmMessage) confirmMessage.textContent = message;
  onConfirmAction = onConfirm;
  showScreen("confirm-screen");
}
function cancelConfirm() {
  if (previousScreen) showScreen(previousScreen);
}
async function handleExportOrShare() {
  setLoading(true);
  setHeaderText("データを準備中...");
  try {
    if (!currentSession) throw new Error("検定が選択されていません。");
    const response = await fetch(
      `/api/getResults?sessionId=${currentSession.id}`
    );
    const { results } = await response.json();
    if (!response.ok) {
      const errorResult = results;
      throw new Error(errorResult.error || "結果の取得に失敗しました。");
    }
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
      検定名: currentSession?.name || "無名の検定",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "採点結果");
    const fileName = `${currentSession.name}_採点結果.xlsx`;
    if (navigator.share) {
      const wbout = XLSX.utils.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
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
    const activeScreen = document.querySelector(".screen.active");
    if (activeScreen) {
      if (activeScreen.id === "complete-screen")
        setHeaderText("送信完了しました");
      else if (activeScreen.id === "dashboard-screen")
        setHeaderText("検定を選択");
    }
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
  if (!header) return;
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
  const activeScreen = document.getElementById(screenId);
  if (activeScreen) activeScreen.classList.add("active");
}
function setHeaderText(text) {
  const headerText = document.getElementById("header-main-text");
  if (headerText) headerText.textContent = text;
}
function setLoading(isLoading) {
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) loadingOverlay.classList.toggle("active", isLoading);
}
function updateInfoDisplay() {
  const userInfo = document.getElementById("user-info");
  if (userInfo)
    userInfo.textContent = currentUser?.full_name || "ログインしていません";
  const sessionInfo = document.getElementById("session-info");
  if (sessionInfo) sessionInfo.textContent = currentSession?.name || "未選択";
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
  const submitStatus = document.getElementById("submit-status");
  if (submitStatus) {
    submitStatus.innerHTML = `<div class="error">送信エラー: ${error.message}<br><button class="nav-btn" onclick="submitEntry()">再試行</button></div>`;
  }
}
function copyJoinCode(event, code) {
  event.stopPropagation();
  navigator.clipboard
    .writeText(code)
    .then(() => {
      const copyButton = event.target;
      copyButton.textContent = "COPIED!";
      setTimeout(() => {
        copyButton.textContent = "copy"; // 元のテキストに戻す
      }, 1500);
    })
    .catch((err) => {
      console.error("コピーに失敗しました:", err);
      alert("コピーに失敗しました。");
    });
}
function clearLoginError() {
  const errorMessage = document.getElementById("login-error-message");
  if (errorMessage) errorMessage.innerHTML = "";
}
// === アカウント設定関連 ===
async function showAccountScreen() {
  try {
    setLoading(true);
    if (!currentUser) throw new Error("ユーザーがログインしていません。");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", currentUser.id)
      .single();
    if (error) throw error;
    const accountNameInput = document.getElementById("account-name");
    if (accountNameInput) accountNameInput.value = profile?.full_name || "";
    const passwordInput = document.getElementById("account-password");
    if (passwordInput) passwordInput.value = "";
    const passwordConfirmInput = document.getElementById(
      "account-password-confirm"
    );
    if (passwordConfirmInput) passwordConfirmInput.value = "";
    setHeaderText("アカウント設定");
    showScreen("account-screen");
  } catch (error) {
    alert("ユーザー情報の取得に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}
async function handleUpdateName() {
  const newNameInput = document.getElementById("account-name");
  const newName = newNameInput?.value || "";
  if (!newName.trim()) return alert("氏名を入力してください。");
  if (!currentUser) return;
  setLoading(true);
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: newName })
      .eq("id", currentUser.id);
    if (error) throw error;
    currentUser.full_name = newName;
    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.textContent = newName;
    alert("名前を更新しました。");
  } catch (error) {
    alert("名前の更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}
async function handleUpdatePassword() {
  const newPasswordInput = document.getElementById("account-password");
  const confirmPasswordInput = document.getElementById(
    "account-password-confirm"
  );
  const newPassword = newPasswordInput?.value || "";
  const confirmPassword = confirmPasswordInput?.value || "";
  if (newPassword.length < 6) {
    return alert("パスワードは6文字以上で入力してください。");
  }
  if (newPassword !== confirmPassword) {
    return alert("パスワードが一致しません。");
  }
  setLoading(true);
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    alert("パスワードを更新しました。");
    if (newPasswordInput) newPasswordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";
  } catch (error) {
    alert("パスワードの更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}
// === アカウント削除関連 ===
function showDeleteConfirm() {
  const activeScreen = document.querySelector(".screen.active");
  if (activeScreen) previousScreen = activeScreen.id;
  showScreen("delete-confirm-screen");
}
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
    const response = await fetch("/api/deleteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: session.access_token }),
    });
    const result = await response.json();
    if (!response.ok) {
      const errorResult = result;
      throw new Error(errorResult.error || "アカウントの削除に失敗しました。");
    }
    alert("アカウントが正常に削除されました。");
    await supabase.auth.signOut();
    currentUser = null;
    currentSession = null;
    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.textContent = "ログインしていません";
    const sessionInfo = document.getElementById("session-info");
    if (sessionInfo) sessionInfo.textContent = "検定未選択";
    setHeaderText("ようこそ");
    showScreen("landing-screen");
  } catch (error) {
    alert("エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}
// === 検定詳細関連 ===
async function showSessionDetails(event, session) {
  event.stopPropagation();
  setLoading(true);
  currentSession = session;
  try {
    const response = await fetch(
      `/api/getSessionDetails?sessionId=${session.id}`
    );
    const data = await response.json();
    if (!response.ok) {
      const errorData = data;
      throw new Error(errorData.error || "詳細の取得に失敗しました。");
    }
    const title = document.getElementById("session-details-title");
    if (title) title.textContent = `${data.session_name} の詳細`;
    const nameInput = document.getElementById("session-details-name");
    if (nameInput) nameInput.value = data.session_name;
    const listEl = document.getElementById("session-participants-list");
    if (!listEl) return;
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
    goBackToDashboard();
  } finally {
    setLoading(false);
  }
}
async function handleUpdateSessionName() {
  const newNameInput = document.getElementById("session-details-name");
  const newName = newNameInput?.value || "";
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
    const title = document.getElementById("session-details-title");
    if (title) title.textContent = `${newName} の詳細`;
    await loadDashboard();
  } catch (error) {
    alert("更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}
function showDeleteSessionConfirm() {
  previousScreen = "session-details-screen";
  showScreen("delete-session-confirm-screen");
}
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
