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
  updateScoreScreenButtons,
} from "./ui.js";

let pollingInterval = null;
let scorePollingInterval = null;
let lastPromptId = null;

export async function handleFinishSession() {
  if (!state.currentSession) return goBackToDashboard();

  if (state.currentUser.id !== state.currentSession.chief_judge_id) {
    return goBackToDashboard();
  }

  showConfirmDialog(
    "この検定を終了しますか？他の検定員も検定選択画面に戻ります。",
    async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("ログインしていません。");

        await fetch("/api/endSession", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userToken: session.access_token,
            sessionId: state.currentSession.id,
          }),
        });

        goBackToDashboard();
      } catch (error) {
        alert("検定の終了に失敗しました: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  );
}

function startPollingForPrompt() {
  stopPolling();
  if (!state.currentSession) return;
  const storageKey = `lastPromptId_${state.currentSession.id}`;

  const checkForPrompt = async () => {
    if (!state.currentSession) {
      stopPolling();
      return;
    }
    const currentLastPromptId = sessionStorage.getItem(storageKey) || null;
    try {
      const response = await fetch(
        `/api/getScoringPrompt?sessionId=${state.currentSession.id}&lastSeenId=${currentLastPromptId}`
      );
      if (!response.ok) return;

      const data = await response.json();

      if (data.is_active === false) {
        stopPolling();
        alert("主任検定員が検定を終了しました。");
        goBackToDashboard();
        return;
      }

      const prompt = data.prompt;
      if (prompt) {
        stopPolling();
        sessionStorage.setItem(storageKey, prompt.id);
        lastPromptId = prompt.id;

        if (prompt.status === "canceled") {
          alert("主任検定員が採点を中断しました。準備画面に戻ります。");
          setHeaderText("準備中…");
          showScreen("judge-wait-screen");
          startPollingForPrompt();
          return;
        }
        state.currentScore = "";
        state.confirmedScore = 0;
        state.selectedDiscipline = prompt.discipline;
        state.selectedLevel = prompt.level;
        state.selectedEvent = prompt.event_name;
        state.currentBib = String(prompt.bib_number);
        updateInfoDisplay();
        document.getElementById("score-display").textContent = "0";
        updateScoreScreenButtons();
        setHeaderText("滑走者の得点を入力してください");
        showScreen("score-screen");
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  pollingInterval = setInterval(checkForPrompt, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function startPollingForScores() {
  stopScorePolling();
  if (!state.currentSession) return;
  const storageKey = `lastPromptId_${state.currentSession.id}`;

  const checkForScores = async () => {
    if (!state.currentSession) {
      stopScorePolling();
      return;
    }
    try {
      const { id } = state.currentSession;
      const { currentBib, selectedDiscipline, selectedLevel, selectedEvent } =
        state;

      const url = `/api/getScoreStatus?sessionId=${id}&bib=${currentBib}&discipline=${selectedDiscipline}&level=${selectedLevel}&event=${selectedEvent}`;
      const response = await fetch(url);
      if (!response.ok) return;

      const status = await response.json();

      if (status.is_active === false) {
        stopScorePolling();
        alert("主任検定員が検定を終了しました。");
        goBackToDashboard();
        return;
      }

      const scoreListEl = document.getElementById("score-list");
      if (!scoreListEl) return;

      scoreListEl.innerHTML = "";
      if (status.scores && status.scores.length > 0) {
        status.scores.forEach((s) => {
          const itemEl = document.createElement("div");
          itemEl.className = "participant-item";
          itemEl.innerHTML = `<span class="participant-name">${s.judge_name}</span><span class="score-value">${s.score} 点</span>`;
          scoreListEl.appendChild(itemEl);
        });
      } else {
        scoreListEl.innerHTML = '<div class="loading"></div>';
      }

      const submitBtn = document.getElementById("btn-submit-entry");
      if (state.currentUser.id === state.currentSession.chief_judge_id) {
        submitBtn.style.display = "block";
      } else {
        submitBtn.style.display = "none";
      }

      const currentLastPromptId = sessionStorage.getItem(storageKey);
      if (state.currentUser.id !== state.currentSession.chief_judge_id) {
        if (status.activePromptId != currentLastPromptId) {
          stopScorePolling();
          setHeaderText("準備中…");
          showScreen("judge-wait-screen");
          startPollingForPrompt();
        }
      }
    } catch (error) {
      console.error("Score polling error:", error);
      stopScorePolling();
    }
  };

  checkForScores();
  scorePollingInterval = setInterval(checkForScores, 3000);
}

function stopScorePolling() {
  if (scorePollingInterval) {
    clearInterval(scorePollingInterval);
    scorePollingInterval = null;
  }
}

async function broadcastCancellationSignal() {
  if (
    !state.currentSession.is_multi_judge ||
    state.currentUser.id !== state.currentSession.chief_judge_id
  ) {
    return true;
  }
  setLoading(true);
  try {
    const {
      data: { session: userSession },
    } = await supabase.auth.getSession();
    if (!userSession) throw new Error("ログインしていません。");
    const promptData = {
      session_id: state.currentSession.id,
      discipline: "CANCELED",
      level: "CANCELED",
      event_name: "CANCELED",
      bib_number: 0,
      status: "canceled",
    };
    const response = await fetch("/api/createScoringPrompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: userSession.access_token, promptData }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error);
    }
    return true;
  } catch (error) {
    alert("他の検定員へのキャンセル通知に失敗しました: " + error.message);
    return false;
  } finally {
    setLoading(false);
  }
}

async function appointChief(userId) {
  setLoading(true);
  try {
    if (!state.currentSession)
      throw new Error("対象の検定が選択されていません。");
    const {
      data: { session: userSession },
    } = await supabase.auth.getSession();
    if (!userSession) throw new Error("ログインしていません。");
    const response = await fetch("/api/updateSessionSettings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.currentSession.id,
        userToken: userSession.access_token,
        settings: { chief_judge_id: userId },
      }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error);
    }
    alert("主任を任命しました。");
    await showSessionDetails(state.currentSession);
  } catch (error) {
    alert("任命に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

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
        button.innerHTML = `<div class="session-name">${s.name}</div><div class="join-code-wrapper"><span class="join-code">コード: ${s.join_code}</span></div>`;
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

async function selectSession(session) {
  stopPolling();
  stopScorePolling();
  sessionStorage.removeItem(`lastPromptId_${session.id}`);
  lastPromptId = null;

  setLoading(true);
  try {
    const response = await fetch(
      `/api/getSessionDetails?sessionId=${session.id}`
    );
    const fullSessionData = await response.json();
    if (!response.ok) throw new Error(fullSessionData.error);

    state.currentSession = fullSessionData;
    updateInfoDisplay();

    if (
      state.currentSession.is_active === false &&
      state.currentUser.id !== state.currentSession.chief_judge_id
    ) {
      alert("この検定は終了しています。");
      setLoading(false);
      loadDashboard();
      return;
    }

    if (state.currentUser.id === state.currentSession.chief_judge_id) {
      if (state.currentSession.is_active === false) {
        try {
          const {
            data: { session: userSession },
          } = await supabase.auth.getSession();
          if (userSession) {
            await fetch("/api/reactivateSession", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userToken: userSession.access_token,
                sessionId: state.currentSession.id,
              }),
            });
            state.currentSession.is_active = true;
          }
        } catch (e) {
          console.error("検定の再開に失敗しました:", e);
          alert("検定の再開に失敗しました。");
          setLoading(false);
          return;
        }
      } else {
        try {
          const {
            data: { session: userSession },
          } = await supabase.auth.getSession();
          if (userSession) {
            await fetch("/api/clearActivePrompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userToken: userSession.access_token,
                sessionId: state.currentSession.id,
              }),
            });
          }
        } catch (e) {
          console.error("古い採点指示のクリアに失敗しました:", e);
        }
      }
    }

    const { data: events, error } = await supabase.from("events").select("*");
    if (error) throw error;
    state.allTestEvents = {};
    events.forEach((e) => {
      if (!state.allTestEvents[e.discipline])
        state.allTestEvents[e.discipline] = {};
      if (!state.allTestEvents[e.discipline][e.level])
        state.allTestEvents[e.discipline][e.level] = [];
      state.allTestEvents[e.discipline][e.level].push(e.name);
    });

    if (state.currentSession.is_multi_judge) {
      if (state.currentUser.id === state.currentSession.chief_judge_id) {
        setupDisciplineScreen();
        setHeaderText("種別を選択してください (主任)");
        showScreen("discipline-screen");
      } else {
        setHeaderText("準備中…");
        showScreen("judge-wait-screen");
        startPollingForPrompt();
      }
    } else {
      setupDisciplineScreen();
      setHeaderText("種別を選択してください");
      showScreen("discipline-screen");
    }
  } catch (error) {
    alert("検定情報の読み込みエラー: " + error.message);
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
  startNewEntry();
}

function startNewEntry() {
  state.currentScore = "";
  state.currentBib = "";
  state.confirmedScore = 0;

  const bibDisplay = document.getElementById("bib-display");
  if (bibDisplay) bibDisplay.textContent = "0";

  const scoreDisplay = document.getElementById("score-display");
  if (scoreDisplay) scoreDisplay.textContent = "0";

  document.getElementById("submit-status").innerHTML = "";

  updateInfoDisplay();
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
    updateInfoDisplay();
  }
}

export function clearBibInput() {
  state.currentBib = "";
  document.getElementById("bib-display").textContent = "0";
  updateInfoDisplay();
}

export async function confirmBib() {
  if (!state.currentSession || !state.currentUser) {
    alert(
      "エラー: 検定またはユーザー情報が見つかりません。ページをリロードして、検定選択からやり直してください。"
    );
    return;
  }
  const bib = parseInt(state.currentBib, 10) || 0;
  if (bib < 1 || bib > 999) {
    return alert("ゼッケン番号は1-999の範囲で入力してください");
  }
  if (
    state.currentSession.is_multi_judge &&
    state.currentUser.id === state.currentSession.chief_judge_id
  ) {
    setLoading(true);
    try {
      const {
        data: { session: userSession },
      } = await supabase.auth.getSession();
      if (!userSession) throw new Error("ログインしていません。");
      const promptData = {
        session_id: state.currentSession.id,
        discipline: state.selectedDiscipline,
        level: state.selectedLevel,
        event_name: state.selectedEvent,
        bib_number: bib,
      };
      const response = await fetch("/api/createScoringPrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: userSession.access_token,
          promptData: promptData,
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error);
      }
    } catch (error) {
      alert("他の検定員への通知に失敗しました: " + error.message);
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  }
  updateScoreScreenButtons();
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
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

export async function confirmScore() {
  const score = parseInt(state.currentScore, 10) || 0;
  if (score < 0 || score > 99)
    return alert("得点は0-99の範囲で入力してください");

  state.confirmedScore = score;

  if (!state.currentSession.is_multi_judge) {
    return await submitEntry();
  }

  setLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインしていません。");
    const judgeName =
      document.getElementById("user-info")?.textContent || "不明な検定員";

    const { error } = await supabase.from("results").upsert(
      {
        session_id: state.currentSession.id,
        bib: parseInt(state.currentBib),
        score: state.confirmedScore,
        judge_name: judgeName,
        discipline: state.selectedDiscipline,
        level: state.selectedLevel,
        event_name: state.selectedEvent,
      },
      {
        onConflict:
          "session_id, bib, discipline, level, event_name, judge_name",
      }
    );

    if (error) throw error;

    document.getElementById("final-bib").textContent = state.currentBib;
    setHeaderText("採点内容を確認してください");
    showScreen("submit-screen");
    startPollingForScores();
  } catch (error) {
    alert("得点の送信に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

export async function submitEntry() {
  stopPolling();
  stopScorePolling();

  if (!state.currentSession.is_multi_judge) {
    const submitStatus = document.getElementById("submit-status");
    if (submitStatus)
      submitStatus.innerHTML =
        '<div class="status"><div class="loading"></div> 送信中...</div>';
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("ログインしていません。");
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
    return;
  }

  if (state.currentUser.id === state.currentSession.chief_judge_id) {
    const completedBib = document.getElementById("completed-bib");
    if (completedBib) completedBib.textContent = state.currentBib;
    const completedScore = document.getElementById("completed-score");
    if (completedScore) completedScore.textContent = "";
    setHeaderText("送信完了しました");
    showScreen("complete-screen");
  }
}

function onSubmitSuccess(result) {
  document.getElementById("completed-bib").textContent = String(
    result.bib
  ).padStart(3, "0");
  document.getElementById("completed-score").textContent = String(result.score);
  setHeaderText("送信完了しました");
  showScreen("complete-screen");
}

export async function nextSkier() {
  document.getElementById("submit-status").innerHTML = "";
  if (
    state.currentSession.is_multi_judge &&
    state.currentUser.id === state.currentSession.chief_judge_id
  ) {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("ログインしていません。");
      await fetch("/api/clearActivePrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: session.access_token,
          sessionId: state.currentSession.id,
        }),
      });
      sessionStorage.removeItem(`lastPromptId_${state.currentSession.id}`);
      lastPromptId = null;
      startNewEntry();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  } else {
    startNewEntry();
  }
}

export function changeEvent() {
  stopPolling();
  stopScorePolling();
  showConfirmDialog("現在の採点を中断し、種目選択に戻りますか？", async () => {
    const broadcastSuccess = await broadcastCancellationSignal();
    if (!broadcastSuccess) return;

    const isChief =
      state.currentSession.is_multi_judge &&
      state.currentUser.id === state.currentSession.chief_judge_id;
    const isSingleMode = !state.currentSession.is_multi_judge;

    state.selectedDiscipline = "";
    state.selectedLevel = "";
    state.selectedEvent = "";
    state.currentBib = "";
    updateInfoDisplay();

    if (isChief || isSingleMode) {
      setHeaderText("種別を選択してください");
      showScreen("discipline-screen");
    } else {
      setHeaderText("準備中…");
      showScreen("judge-wait-screen");
      startPollingForPrompt();
    }
  });
}

export function executeConfirm() {
  if (typeof state.onConfirmAction === "function") state.onConfirmAction();
  state.onConfirmAction = null;
}

export function goBackToDashboard() {
  stopPolling();
  stopScorePolling();
  if (state.currentSession) {
    sessionStorage.removeItem(`lastPromptId_${state.currentSession.id}`);
  }
  lastPromptId = null;
  state.selectedEvent = "";
  state.currentBib = "";
  updateInfoDisplay();
  setHeaderText("検定を選択");
  showScreen("dashboard-screen");
}

export function goBackToDisciplineSelect() {
  state.selectedDiscipline = "";
  state.selectedLevel = "";
  state.selectedEvent = "";
  state.currentBib = "";
  updateInfoDisplay();
  setHeaderText("種別を選択してください");
  showScreen("discipline-screen");
}

export function goBackToLevelSelect() {
  state.selectedLevel = "";
  state.selectedEvent = "";
  state.currentBib = "";
  updateInfoDisplay();
  setHeaderText("級を選択してください");
  showScreen("event-screen");
}

export async function goBackToBibScreen() {
  stopPolling();
  stopScorePolling();

  if (state.currentUser.id === state.currentSession.chief_judge_id) {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("ログインしていません。");

      await fetch("/api/clearActivePrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: session.access_token,
          sessionId: state.currentSession.id,
        }),
      });
    } catch (error) {
      alert("採点の中断に失敗しました: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  setHeaderText("ゼッケン番号を修正してください");
  showScreen("bib-screen");
}

export function editEntry() {
  stopScorePolling();
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
      setLoading(false);
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
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
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
    state.currentSession = { ...state.currentSession, ...data };
    document.getElementById(
      "session-details-title"
    ).textContent = `${data.session_name} の詳細`;
    document.getElementById("session-details-name").value = data.session_name;
    const toggle = document.getElementById("multi-judge-toggle");
    toggle.checked = data.is_multi_judge;
    const requiredJudgesContainer = document.getElementById(
      "required-judges-container"
    );
    const requiredJudgesInput = document.getElementById(
      "required-judges-input"
    );
    if (data.is_multi_judge) {
      requiredJudgesContainer.style.display = "flex";
      requiredJudgesInput.value = data.required_judges || 1;
    } else {
      requiredJudgesContainer.style.display = "none";
    }
    const listEl = document.getElementById("session-participants-list");
    listEl.innerHTML = "";
    if (data.participants && data.participants.length > 0) {
      data.participants.forEach((p) => {
        const itemEl = document.createElement("div");
        itemEl.className = "participant-item";
        const nameEl = document.createElement("div");
        nameEl.className = "participant-name";
        nameEl.textContent = p.full_name;
        if (p.user_id === data.chief_judge_id) {
          const badge = document.createElement("span");
          badge.className = "chief-badge";
          badge.textContent = "(主任)";
          nameEl.appendChild(badge);
        }
        itemEl.appendChild(nameEl);
        if (state.currentUser.id === data.created_by) {
          const appointBtn = document.createElement("button");
          appointBtn.className = "appoint-btn";
          appointBtn.textContent =
            p.user_id === data.chief_judge_id ? "任命済み" : "主任に任命";
          appointBtn.dataset.userId = p.user_id;
          if (p.user_id === data.chief_judge_id) {
            appointBtn.disabled = true;
          }
          itemEl.appendChild(appointBtn);
        }
        listEl.appendChild(itemEl);
      });
    } else {
      listEl.innerHTML = '<p style="padding: 12px 0;">参加者はいません。</p>';
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

export async function handleUpdateSessionSettings() {
  setLoading(true);
  try {
    if (!state.currentSession)
      throw new Error("対象の検定が選択されていません。");
    const {
      data: { session: userSession },
    } = await supabase.auth.getSession();
    if (!userSession) throw new Error("ログインしていません。");
    const newSettings = {
      name: document.getElementById("session-details-name").value,
      is_multi_judge: document.getElementById("multi-judge-toggle").checked,
      required_judges: parseInt(
        document.getElementById("required-judges-input").value,
        10
      ),
    };
    const response = await fetch("/api/updateSessionSettings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.currentSession.id,
        userToken: userSession.access_token,
        settings: newSettings,
      }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error);
    }
    alert("設定を保存しました。");
    await loadDashboard();
  } catch (error) {
    alert("設定の保存に失敗しました: " + error.message);
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

export { appointChief };
