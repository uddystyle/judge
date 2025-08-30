// scripts/session.js
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import {
  showScreen,
  setLoading,
  setHeaderText,
  updateInfoDisplay,
  createButton,
  onApiError,
  onSubmitError,
  showConfirmDialog,
  copyJoinCode,
} from "./ui.js";

export async function loadDashboard() {
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
    if (response.status === 401) throw new Error("認証されていません。");

    const mySessions = await response.json();
    if (!response.ok)
      throw new Error(mySessions.error || "検定の読み込みに失敗しました。");

    const sessionList = document.getElementById("session-list");
    if (!sessionList) return;
    sessionList.innerHTML = "";

    if (mySessions && mySessions.length > 0) {
      mySessions.forEach((s) => {
        const button = document.createElement("button");
        button.className = "key select-item";
        button.addEventListener("click", () => selectSession(s));

        button.innerHTML = `<div class="session-name">${s.name}</div>
            <div class="join-code-wrapper">
                <span class="join-code">コード: ${s.join_code}</span>
            </div>`;

        const copyBtn = document.createElement("div");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "copy";
        copyBtn.addEventListener("click", (e) => copyJoinCode(e, s.join_code));

        const detailsButton = document.createElement("div");
        detailsButton.className = "details-btn";
        detailsButton.textContent = "詳細";
        detailsButton.addEventListener("click", (event) => {
          event.stopPropagation();
          showSessionDetails(s);
        });

        const wrapper = button.querySelector(".join-code-wrapper");
        if (wrapper) {
          wrapper.appendChild(copyBtn);
          wrapper.appendChild(detailsButton);
        }
        sessionList.appendChild(button);
      });
    } else {
      sessionList.innerHTML =
        '<p style="color: var(--secondary-text);">参加中の検定はありません。</p>';
    }
  } catch (error) {
    if (error.message.includes("ログイン") || error.message.includes("認証")) {
      state.currentUser = null;
      state.currentSession = null;
      updateInfoDisplay();
      setHeaderText("ようこそ");
      showScreen("landing-screen");
    } else {
      alert("検定の読み込みエラー: " + error.message);
    }
  } finally {
    setLoading(false);
  }
}

export async function handleCreateSession() {
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

export async function handleJoinSession() {
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

export async function selectSession(session) {
  state.currentSession = session;
  updateInfoDisplay();
  setLoading(true);
  try {
    const { data, error } = await supabase.from("events").select("*");
    if (error) throw error;
    state.allTestEvents = {};
    data.forEach((e) => {
      if (!state.allTestEvents[e.discipline])
        state.allTestEvents[e.discipline] = {};
      if (!state.allTestEvents[e.discipline][e.level])
        state.allTestEvents[e.discipline][e.level] = [];
      state.allTestEvents[e.discipline][e.level].push(e.name);
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

function setupDisciplineScreen() {
  const keypad = document.getElementById("discipline-keypad");
  if (!keypad) return;
  keypad.innerHTML = "";
  Object.keys(state.allTestEvents).forEach((d) =>
    createButton(keypad, d, () => selectDiscipline(d))
  );
}

function setupLevelScreen(discipline) {
  const keypad = document.getElementById("level-keypad");
  if (!keypad) return;
  keypad.innerHTML = "";
  const levels = Object.keys(state.allTestEvents[discipline] || {}).sort(
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
  (state.allTestEvents[discipline]?.[level] || []).forEach((e) =>
    createButton(keypad, e, () => selectEvent(e))
  );
}

function selectDiscipline(discipline) {
  state.selectedDiscipline = discipline;
  updateInfoDisplay();
  setupLevelScreen(discipline);
  setHeaderText("級を選択してください");
  showScreen("level-screen");
}

function selectLevel(level) {
  state.selectedLevel = level;
  updateInfoDisplay();
  setupEventScreen(state.selectedDiscipline, level);
  setHeaderText("種目を選択してください");
  showScreen("event-screen");
}

function selectEvent(event) {
  state.selectedEvent = event;
  updateInfoDisplay();
  nextSkier();
}

export function inputNumber(num) {
  if (state.currentScore.length < 2) {
    state.currentScore =
      state.currentScore === "0" && num !== "0"
        ? num
        : state.currentScore + num;
    if (parseInt(state.currentScore) > 99) state.currentScore = "99";
    document.getElementById("score-display").textContent =
      state.currentScore || "0";
  }
}

export function clearInput() {
  state.currentScore = "";
  document.getElementById("score-display").textContent = "0";
}

export function confirmScore() {
  const score = parseInt(state.currentScore, 10) || 0;
  if (score < 0 || score > 99)
    return alert("得点は0-99の範囲で入力してください");
  state.confirmedScore = score;
  setHeaderText("ゼッケン番号を入力してください");
  showScreen("bib-screen");
}

export function inputBibNumber(num) {
  if (state.currentBib.length < 3) {
    state.currentBib =
      state.currentBib === "0" && num !== "0" ? num : state.currentBib + num;
    if (parseInt(state.currentBib) > 999) state.currentBib = "999";
    document.getElementById("bib-display").textContent =
      state.currentBib || "0";
  }
}

export function clearBibInput() {
  state.currentBib = "";
  document.getElementById("bib-display").textContent = "0";
}

export function confirmBib() {
  const bib = parseInt(state.currentBib, 10) || 0;
  if (bib < 1 || bib > 999)
    return alert("ゼッケン番号は1-999の範囲で入力してください");
  document.getElementById("final-bib").textContent = String(bib).padStart(
    3,
    "0"
  );
  document.getElementById("final-score").textContent = state.confirmedScore;
  setHeaderText("採点内容を確認してください");
  showScreen("submit-screen");
}

export async function submitEntry() {
  const submitStatus = document.getElementById("submit-status");
  if (!submitStatus) return;
  submitStatus.innerHTML =
    '<div class="status"><div class="loading"></div> 送信中...</div>';
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");
    if (!state.currentSession) throw new Error("検定が選択されていません。");
    const judgeName =
      document.getElementById("user-info")?.textContent || "不明な検定員";

    const response = await fetch("/api/submitScore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.currentSession.id,
        bib: parseInt(state.currentBib),
        score: state.confirmedScore,
        judge: judgeName,
        discipline: state.selectedDiscipline,
        level: state.selectedLevel,
        event: state.selectedEvent,
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

export function nextSkier() {
  state.currentScore = "";
  state.currentBib = "";
  state.confirmedScore = 0;
  clearInput();
  clearBibInput();
  document.getElementById("submit-status").innerHTML = "";
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}

export function changeEvent() {
  showConfirmDialog("現在の採点を中断し、種目選択に戻りますか？", () => {
    state.selectedDiscipline = "";
    state.selectedLevel = "";
    state.selectedEvent = "";
    updateInfoDisplay();
    setHeaderText("種別を選択してください");
    showScreen("discipline-screen");
  });
}

export function executeConfirm() {
  if (typeof state.onConfirmAction === "function") state.onConfirmAction();
  state.onConfirmAction = null;
}

export function goBackToDashboard() {
  state.selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("検定を選択");
  showScreen("dashboard-screen");
}

export function goBackToDisciplineSelect() {
  state.selectedDiscipline = "";
  state.selectedLevel = "";
  state.selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("種別を選択してください");
  showScreen("discipline-screen");
}

export function goBackToLevelSelect() {
  state.selectedLevel = "";
  state.selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("級を選択してください");
  showScreen("event-screen");
}

export function goBack() {
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}

export function editEntry() {
  state.currentScore = String(state.confirmedScore);
  document.getElementById("score-display").textContent = state.currentScore;
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}

export async function handleExportOrShare() {
  setLoading(true);
  setHeaderText("データを準備中...");
  try {
    if (!state.currentSession) throw new Error("検定が選択されていません。");
    const response = await fetch(
      `/api/getResults?sessionId=${state.currentSession.id}`
    );
    const { results } = await response.json();
    if (!response.ok)
      throw new Error(results.error || "結果の取得に失敗しました。");
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
      検定名: state.currentSession?.name || "無名の検定",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "採点結果");
    const fileName = `${state.currentSession.name}_採点結果.xlsx`;
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
          title: state.currentSession.name,
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
    const activeScreenId = document.querySelector(".screen.active")?.id;
    if (activeScreenId === "complete-screen") setHeaderText("送信完了しました");
    else if (activeScreenId === "dashboard-screen") setHeaderText("検定を選択");
  }
}

export async function showSessionDetails(session) {
  setLoading(true);
  state.currentSession = session;
  try {
    const response = await fetch(
      `/api/getSessionDetails?sessionId=${session.id}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    document.getElementById(
      "session-details-title"
    ).textContent = `${data.session_name} の詳細`;
    document.getElementById("session-details-name").value = data.session_name;

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
    goBackToDashboard();
  } finally {
    setLoading(false);
  }
}

export async function handleUpdateSessionName() {
  const newName = document.getElementById("session-details-name").value;
  if (!newName.trim()) return alert("検定名を入力してください。");
  if (!state.currentSession) return alert("対象の検定が選択されていません。");
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
        sessionId: state.currentSession.id,
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
    await loadDashboard();
  } catch (error) {
    alert("更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

export function showDeleteSessionConfirm() {
  showScreen("delete-session-confirm-screen");
}

export async function handleDeleteSession() {
  if (!state.currentSession) return alert("対象の検定が選択されていません。");
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
        sessionId: state.currentSession.id,
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
