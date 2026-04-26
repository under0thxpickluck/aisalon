# Rumble バトルログモーダル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 観戦タブの「最新を取得」ボタン直下に「バトルログを再生」ボタンを追加し、バトルログを小窓モーダルでワクワク感のある順番再生で表示する。

**Architecture:** `app/mini-games/rumble/page.tsx` のみを変更。新state `showBattleLogModal` + `battleLogModalMode` でモーダル開閉と今日/前回の切り替えを管理。既存の `handleSpectatorPlay` / `handlePrevPlay` はそのまま流用し、モーダルを開くアクションとして呼ぶ。readyの大きなインラインBATTLE LOGカードは削除してモーダルに集約。

**Tech Stack:** React (useState, useRef, useEffect), Tailwind CSS, 既存のバトルログ再生ロジック

---

### Task 1: state・refの追加

**Files:**
- Modify: `app/mini-games/rumble/page.tsx` (state宣言ブロック周辺、line 122〜176付近)

- [ ] **Step 1: showBattleLogModal と battleLogModalMode のstateを追加**

既存の `prevLogCounter` stateの直後（line 175付近）に追加：

```tsx
const [showBattleLogModal,   setShowBattleLogModal]   = useState(false);
const [battleLogModalMode,   setBattleLogModalMode]   = useState<"today" | "prev">("today");
```

- [ ] **Step 2: ログ末尾自動スクロール用refを追加**

既存のstate宣言ブロックの直後（`useEffect` 群の前）に追加：

```tsx
const logEndRef = useRef<HTMLDivElement>(null);
```

`useRef` は既にimportされていないので、ファイル先頭のimport行を変更：

```tsx
// 変更前
import { useEffect, useState } from "react";
// 変更後
import { useEffect, useRef, useState } from "react";
```

- [ ] **Step 3: 自動スクロールのuseEffectを追加**

既存のuseEffect群（`useEffect(() => { if (!userId) return; fetch(...shard-status...` の後あたり）に追加：

```tsx
// バトルログモーダル：新しいログが追加されたら末尾にスクロール
useEffect(() => {
  if (!showBattleLogModal) return;
  logEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [battleLogs, prevBattleLogs, showBattleLogModal]);
```

- [ ] **Step 4: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): add battle log modal state and auto-scroll ref"
```

---

### Task 2: バトルログモーダルのJSX追加

**Files:**
- Modify: `app/mini-games/rumble/page.tsx` (モーダル群の末尾、分解確認モーダルの直後 line 897付近)

- [ ] **Step 1: 分解確認モーダルの `</div>` 直後にバトルログモーダルを追加**

分解モーダルの閉じタグ（`{/* ヘッダー */}` の直前）の位置に挿入：

```tsx
      {/* バトルログモーダル */}
      {showBattleLogModal && (() => {
        const isToday   = battleLogModalMode === "today";
        const logs      = isToday ? battleLogs      : prevBattleLogs;
        const playing   = isToday ? isPlaying       : prevIsPlaying;
        const phase     = isToday ? spectatorPhase  : prevPhase;
        const sData     = isToday ? spectatorData   : prevSpectatorData;
        const hasData   = sData?.status === "ready";
        const handlePlay   = isToday ? handleSpectatorPlay : handlePrevPlay;
        const handleReplay = () => {
          if (isToday) {
            setBattleLogs([]);
            setShowWinners(false);
            setSpectatorPlayers((spectatorData?.players ?? []).map(p => ({ ...p, status: "alive" as const })));
            handleSpectatorPlay();
          } else {
            setPrevBattleLogs([]);
            setPrevPhase("waiting");
            handlePrevPlay();
          }
        };

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
            <div className="bg-[#0d0d1a] border border-purple-500/30 rounded-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: "80vh" }}>
              {/* モーダルヘッダー */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-purple-400/80 tracking-widest">
                    {isToday ? "TODAY" : "PREV"} BATTLE LOG
                  </span>
                  {playing && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                      <span className="text-[9px] text-pink-400 font-black">LIVE</span>
                    </span>
                  )}
                  {phase === "result" && !playing && (
                    <span className="text-[9px] text-yellow-400 font-black">RESULT</span>
                  )}
                </div>
                <button
                  onClick={() => setShowBattleLogModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-xs hover:bg-white/20 transition"
                >
                  ✕
                </button>
              </div>

              {/* ログエリア */}
              <div className="overflow-y-auto px-4 py-3 flex-1 font-mono space-y-2 min-h-[200px]">
                {logs.length === 0 && !playing && (
                  <p className="text-white/20 text-sm text-center pt-8">▶ 再生してください</p>
                )}
                {logs.map(log => (
                  <p key={log.id} className={`text-sm leading-relaxed whitespace-pre-line ${log.color}`}>
                    {log.text}
                  </p>
                ))}
                {playing && (
                  <p className="text-white/30 text-xs animate-pulse">▌</p>
                )}
                <div ref={logEndRef} />
              </div>

              {/* フッターボタン */}
              <div className="px-4 pb-4 pt-2 border-t border-white/10 shrink-0 space-y-2">
                {!playing && phase === "waiting" && hasData && (
                  <button
                    onClick={handlePlay}
                    className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 transition"
                  >
                    ⚔️ 再生スタート
                  </button>
                )}
                {!playing && phase === "result" && hasData && (
                  <button
                    onClick={handleReplay}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 transition"
                  >
                    🔄 もう一度見る
                  </button>
                )}
                {!hasData && (
                  <p className="text-center text-white/30 text-xs py-2">バトルデータがありません</p>
                )}
                <button
                  onClick={() => setShowBattleLogModal(false)}
                  className="w-full py-2 rounded-xl text-xs text-white/30 hover:bg-white/5 transition"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        );
      })()}
```

- [ ] **Step 2: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): add battle log modal JSX"
```

---

### Task 3: pendingセクションへのボタン追加

**Files:**
- Modify: `app/mini-games/rumble/page.tsx` (pending状態の「最新を取得」ボタン付近、line 1233〜1247付近)

- [ ] **Step 1: 「最新を取得」ボタンの直後に「バトルログを再生」ボタンを追加**

現在の「最新を取得」ボタン（`disabled={dailyResultLoading}` のbutton）の直後に追加：

```tsx
              {/* バトルログ再生ボタン（pending状態：前回バトル） */}
              <button
                onClick={() => {
                  setBattleLogModalMode("prev");
                  setShowBattleLogModal(true);
                }}
                disabled={!prevSpectatorData || prevSpectatorData.status !== "ready"}
                className="w-full py-3 rounded-xl font-bold text-sm bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 transition text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ⚔️ バトルログを再生
              </button>
```

- [ ] **Step 2: 既存の「前回バトルリプレイ」セクションを削除**

line 1249〜1306付近の以下ブロックを削除する（ボタンがモーダルに集約されたので不要）：

```
{/* 前回バトルリプレイ */}
{/* prevLoading中は静かに待つ... */}
{!prevLoading && prevDailyResult && prevBattleDate && (
  <div className="mt-2 space-y-3">
    ...（前回バトルlog・ボタン・当選者全ブロック）...
  </div>
)}
{!prevLoading && !prevSpectatorData && prevBattleDate === null && dailyResult?.participant_count === 0 && (
  ...
)}
```

ただし **前回バトル当選者（winners）表示は残す** ため、winnersのみ抜き出してボタン直後に配置する：

```tsx
              {/* 前回バトル当選者（観戦データ不要、すぐ表示） */}
              {!prevLoading && prevDailyResult?.winners && prevDailyResult.winners.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 mt-2">
                  <p className="text-xs font-bold text-yellow-400/60 mb-3 text-center">
                    🎰 前回({prevBattleDate})のBP抽選結果
                  </p>
                  <div className="space-y-1">
                    {prevDailyResult.winners.map(w => (
                      <div key={w.rank} className="flex justify-between text-xs px-2 py-1">
                        <span className={`text-white/70 ${w.user_id === userId ? "text-purple-300 font-bold" : ""}`}>
                          {w.rank}位 {w.display_name}
                        </span>
                        <span className="text-yellow-400">+{w.bp_amount.toLocaleString()} BP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
```

- [ ] **Step 3: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): add battle log replay button to pending state"
```

---

### Task 4: readyセクションのインラインログ削除とボタン追加

**Files:**
- Modify: `app/mini-games/rumble/page.tsx` (ready状態のbattle log card + 再生ボタン群周辺、line 1372〜1421付近)

- [ ] **Step 1: インラインの「BATTLE LOG」カードを削除**

以下のブロック（line 1372〜1389付近）を丸ごと削除：

```tsx
              {/* バトルログカード */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4">
                <p className="text-xs font-bold text-purple-400/60 mb-3 tracking-widest">BATTLE LOG</p>
                <div className="min-h-[200px] space-y-2 font-mono">
                  {battleLogs.length === 0 && !isPlaying && (
                    <p className="text-white/20 text-sm text-center pt-8">
                      ▶ 観戦を開始してください
                    </p>
                  )}
                  {battleLogs.map(log => (
                    <p key={log.id} className={`text-sm leading-relaxed whitespace-pre-line ${log.color}`}>
                      {log.text}
                    </p>
                  ))}
                  {isPlaying && (
                    <p className="text-white/30 text-xs animate-pulse">▌</p>
                  )}
                </div>
              </div>
```

- [ ] **Step 2: 「再生ボタン群」を「バトルログを再生」ボタン1個＋「最新を取得」に置き換え**

既存の「再生ボタン群」ブロック（line 1392〜1421付近）を以下に置き換え：

```tsx
              {/* アクションボタン群 */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setBattleLogModalMode("today");
                    setShowBattleLogModal(true);
                    // まだ未再生なら自動でplay開始
                    if (!isPlaying && spectatorPhase === "waiting" && spectatorData?.status === "ready") {
                      handleSpectatorPlay();
                    }
                  }}
                  disabled={spectatorData?.status !== "ready"}
                  className="w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ⚔️ バトルログを再生
                </button>
                <button
                  onClick={handleSpectatorRefresh}
                  disabled={spectatorLoading}
                  className="w-full py-2 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 transition text-white/50 disabled:opacity-40"
                >
                  {spectatorLoading ? "取得中..." : "🔃 最新を取得"}
                </button>
              </div>
```

- [ ] **Step 3: コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): replace inline battle log with modal button in ready state"
```

---

### Task 5: 動作確認と最終調整

**Files:**
- Modify: `app/mini-games/rumble/page.tsx` (必要に応じて微調整)

- [ ] **Step 1: TypeScriptビルドエラーがないか確認**

```bash
cd C:/Users/unite/aisalon && npx tsc --noEmit 2>&1 | head -30
```

エラーがなければOK。あれば該当行を修正する。

- [ ] **Step 2: ブラウザで動作確認（サーバー起動）**

```bash
npm run dev
```

以下を確認：
- 観戦タブ > pending状態 → 「バトルログを再生」ボタンが表示される（データなしでグレーアウト）
- 観戦タブ > ready状態 → 「バトルログを再生」ボタンが大きく表示される
- ボタン押下 → モーダルが開く
- モーダル内「再生スタート」押下 → ログが1行ずつ流れる
- ログが流れるとき自動スクロールされる
- 終了後「もう一度見る」が表示される
- ✕ボタン or「閉じる」でモーダルが閉じる

- [ ] **Step 3: 最終コミット**

```bash
git add app/mini-games/rumble/page.tsx
git commit -m "feat(rumble): battle log modal - sequential replay in small window"
```
