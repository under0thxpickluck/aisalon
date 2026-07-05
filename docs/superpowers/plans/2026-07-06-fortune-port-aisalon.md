# 占い(団子ハブ + AIカード占い)aisalon移植 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LIFAIOV で完成した占い機能(`/fortune` を「団子占い/AIカード占い」ハブ化 + 没入型カード占い)を aisalon へ忠実移植する。

**Architecture:** サロン非依存のタロット機能19ファイルを LIFAIOV `fortune-card` から verbatim コピーし、aisalon 自前の団子ページを `/fortune/dango` へ移設、`/fortune` をハブ(= LIFAIOV と同一の `FortuneHub`)へ置換、`/fortune` へ向かう入口ラベルを「占い」に統一する。

**Tech Stack:** Next.js 14.2.5 App Router / React 18.3.1 / TypeScript / TailwindCSS / framer-motion ^12(導入済み) / openai ^6(導入済み, `gpt-4o-mini`)。

## Global Constraints

- 対象は **aisalon のみ**(`C:\Users\unite\aisalon`)。ブランチ `fortune-card`(`main` から分岐・作成済み)。**LIFAIOV には一切書き込まない**(コピー元として読むだけ)。
- 移植元(コピー元)は **LIFAIOV `fortune-card` ブランチのワーキングツリー**: `C:\Users\unite\LIFAIOV`。
- コピーする19ファイルは **1文字も変えない**(検証済みの動くコード。サロン固有名/import を含まないことを確認済み)。
- aisalon の既存団子占い(診断・今日の運勢・BP付与導線・localStorage キー・`/fortune/config/*.json` 参照)を**壊さない**。団子ページは移設のみ(verbatim)。
- 検証ゲートは `npm run build` の成功(aisalon はテスト/lint 未設定のため。ユニットテストは追加しない)。
- テーマ配色(タロット): 背景 `#09070F` / 紫 `#231235` / 金 `#D9B76B` / 文字 `#F4EFE8` / アクセント `#B56DFF`(コピーする `lib/fortune/theme.ts` に内包)。
- コミットは論理ファイルのみ stage。ビルド生成物(`public/sw.js`, `tsconfig.tsbuildinfo`)と `.claude/settings.local.json` は **stage しない**。
- **触ってはいけない**: `components/GalleryNav.tsx:11` の `{ id: "fortune", label: "占い" }` はギャラリー内スクロールアンカー(IntersectionObserver)で `/fortune` ルートと無関係。除外。

---

### Task 1: サロン非依存タロット機能19ファイルをコピー

**Files:**
- Create: `lib/fortune/types.ts`, `lib/fortune/theme.ts`, `lib/fortune/billing.ts`, `lib/fortune/cards.ts`
- Create: `data/tarot-cards.json`
- Create: `app/api/tarot/route.ts`
- Create: `app/fortune/cards/page.tsx`
- Create: `components/tarot/StarBackground.tsx`, `FortuneTeller.tsx`, `TarotCard.tsx`, `CardDeck.tsx`, `FortuneIntro.tsx`, `QuestionInput.tsx`, `PreQuestionForm.tsx`, `ModeSelector.tsx`, `LoadingScene.tsx`, `SelectedCards.tsx`, `FortuneResult.tsx`, `FortuneApp.tsx`

**Interfaces:**
- Produces: 型/課金/カードローダ(`lib/fortune/*`)、`POST /api/tarot`、ページ `/fortune/cards`(`FortuneApp` を描画)。これらは Task 2 のハブ(`/fortune/cards` へのリンク)が参照する。
- Consumes: なし(自己完結。依存 framer-motion/openai は導入済み)。

- [ ] **Step 1: ブランチ確認**

Run:
```bash
cd /c/Users/unite/aisalon && git rev-parse --abbrev-ref HEAD
```
Expected: `fortune-card`

- [ ] **Step 2: ディレクトリ作成 + 19ファイルを verbatim コピー**

Run:
```bash
cd /c/Users/unite/aisalon
SRC=/c/Users/unite/LIFAIOV
mkdir -p lib/fortune components/tarot data app/api/tarot app/fortune/cards
cp "$SRC"/lib/fortune/types.ts   lib/fortune/
cp "$SRC"/lib/fortune/theme.ts   lib/fortune/
cp "$SRC"/lib/fortune/billing.ts lib/fortune/
cp "$SRC"/lib/fortune/cards.ts   lib/fortune/
cp "$SRC"/data/tarot-cards.json  data/
cp "$SRC"/app/api/tarot/route.ts app/api/tarot/
cp "$SRC"/app/fortune/cards/page.tsx app/fortune/cards/
cp "$SRC"/components/tarot/*.tsx  components/tarot/
```

- [ ] **Step 3: コピーが verbatim であることを検証(差分ゼロ)**

Run:
```bash
cd /c/Users/unite/aisalon
SRC=/c/Users/unite/LIFAIOV
rc=0
for f in lib/fortune/types.ts lib/fortune/theme.ts lib/fortune/billing.ts lib/fortune/cards.ts \
         data/tarot-cards.json app/api/tarot/route.ts app/fortune/cards/page.tsx \
         components/tarot/StarBackground.tsx components/tarot/FortuneTeller.tsx \
         components/tarot/TarotCard.tsx components/tarot/CardDeck.tsx \
         components/tarot/FortuneIntro.tsx components/tarot/QuestionInput.tsx \
         components/tarot/PreQuestionForm.tsx components/tarot/ModeSelector.tsx \
         components/tarot/LoadingScene.tsx components/tarot/SelectedCards.tsx \
         components/tarot/FortuneResult.tsx components/tarot/FortuneApp.tsx; do
  diff -q "$SRC/$f" "$f" >/dev/null || { echo "DIFF: $f"; rc=1; }
done
[ $rc -eq 0 ] && echo "ALL VERBATIM (19 files)"
```
Expected: `ALL VERBATIM (19 files)`

- [ ] **Step 4: ビルド確認**

Run:
```bash
cd /c/Users/unite/aisalon && rm -rf .next/types && npm run build 2>&1 | grep -E '/fortune/cards|error|Error|Failed' | head -20
```
Expected: `/fortune/cards` ルートが一覧に出て、`error`/`Failed` が出ないこと。
- もし `@/data/tarot-cards.json` の import で失敗した場合のみ、`tsconfig.json` の `compilerOptions.resolveJsonModule` を `true` にして再ビルド(既に他所で JSON import があれば不要)。この時点で `/fortune` はまだ団子ページのまま(次タスクで置換)。

- [ ] **Step 5: コミット(論理19ファイルのみ)**

Run:
```bash
cd /c/Users/unite/aisalon
git add lib/fortune data/tarot-cards.json app/api/tarot/route.ts app/fortune/cards/page.tsx components/tarot
git commit -m "feat(tarot): AIカード占い機能をLIFAIOVから移植(サロン非依存19ファイル)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 団子を /fortune/dango へ移設 + /fortune をハブ化

**Files:**
- Create: `app/fortune/dango/page.tsx`(aisalon 現行 `app/fortune/page.tsx` の verbatim コピー)
- Modify(全置換): `app/fortune/page.tsx`(→ ハブ `FortuneHub`。LIFAIOV `fortune-card` の同ファイルと同一)

**Interfaces:**
- Consumes: Task 1 の `@/components/tarot/StarBackground` と `@/lib/fortune/theme`(ハブが import)。`/fortune/cards`(Task 1)、`/fortune/dango`(本タスクで作成)。
- Produces: `/fortune`(ハブ)・`/fortune/dango`(団子)の2ルート。

- [ ] **Step 1: 団子ページを /fortune/dango へ verbatim 移設**

⚠️ 順序厳守: `app/fortune/page.tsx` がまだ団子である**今のうちに**コピーする。

Run:
```bash
cd /c/Users/unite/aisalon
mkdir -p app/fortune/dango
cp app/fortune/page.tsx app/fortune/dango/page.tsx
diff app/fortune/page.tsx app/fortune/dango/page.tsx && echo "DANGO MOVED VERBATIM"
```
Expected: `DANGO MOVED VERBATIM`(差分ゼロ)

- [ ] **Step 2: /fortune をハブへ全置換(LIFAIOV の同一ハブをコピー)**

LIFAIOV `fortune-card` の `app/fortune/page.tsx` は `FortuneHub`(サロン非依存: `@/components/tarot/StarBackground` と `@/lib/fortune/theme` のみ import)。これを verbatim コピーする。

Run:
```bash
cd /c/Users/unite/aisalon
cp /c/Users/unite/LIFAIOV/app/fortune/page.tsx app/fortune/page.tsx
grep -c 'FortuneHub' app/fortune/page.tsx
diff app/fortune/page.tsx /c/Users/unite/LIFAIOV/app/fortune/page.tsx && echo "HUB VERBATIM"
```
Expected: `1`(FortuneHub 検出)と `HUB VERBATIM`。

- [ ] **Step 3: ビルド確認(3ルート生成)**

Run:
```bash
cd /c/Users/unite/aisalon && rm -rf .next/types && npm run build 2>&1 | grep -E '^\S*\s+/fortune(\s|/|$)|/fortune/dango|/fortune/cards|error|Failed' | head
```
Expected: `/fortune`・`/fortune/dango`・`/fortune/cards` の3ルートが生成され、`error`/`Failed` なし。

- [ ] **Step 4: 手動確認(任意)**

Run: `npm run dev` → ブラウザで `/fortune`。
Expected: ハブに「団子占い🍡 / カード占い🔮」。団子→ `/fortune/dango` で従来どおり(診断・今日の運勢・BP付与導線が壊れていない)。カード→ `/fortune/cards` で没入フロー。

- [ ] **Step 5: コミット**

Run:
```bash
cd /c/Users/unite/aisalon
git add app/fortune/page.tsx app/fortune/dango/page.tsx
git commit -m "feat(fortune): /fortune を占いハブ化(団子を /fortune/dango へ移設)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 入口ラベルを「占い」に統一(6箇所)

**Files:**
- Modify: `components/AppSidebar.tsx:42`
- Modify: `app/top/page.tsx:406`
- Modify: `app/5000/page.tsx:712`(表示専用タイル。onClick 無し=ナビ非依存の安全な表示変更)
- Modify: `app/chat/page.tsx:22`
- Modify: `app/api/cat-recommendation/route.ts:52`
- Modify: `components/LifaiCat.tsx:444`

**Interfaces:**
- Consumes: Task 2 のハブ `/fortune`。
- Produces: なし(表示ラベルのみ)。

**維持(変更しない)**: `app/api/cat-recommendation/route.ts:43` の `label: "占いを見る"`、`components/GalleryNav.tsx:11`(ギャラリーアンカー)、団子ページ自身の見出し。

- [ ] **Step 1: AppSidebar のラベル改名**

`components/AppSidebar.tsx` の該当行を置換:
```tsx
    { href: "/fortune",icon: "🔮", label: "占い" },
```
(元: `label: "団子占い"`)

- [ ] **Step 2: top のラベル+desc 改名**

`app/top/page.tsx` の該当行を置換:
```tsx
      { id: "fortune",  label: "占い",     icon: "🔮", color: "from-violet-500 to-purple-600",  href: "/fortune",    desc: "団子占い・カード占い" },
```
(元: `label: "団子占い"` / `desc: "毎日の運勢 +10BP"`)

- [ ] **Step 3: 5000 タイルの title+desc 改名(表示専用・安全)**

`app/5000/page.tsx` の該当行を置換:
```tsx
              { icon: "🔮", title: "占い",         desc: "団子占い・AIカード占い",             accent: "#8b5cf6", i: 6 },
```
(元: `title: "団子占い"` / `desc: "毎日の運勢チェックでBPを +10獲得"`)

- [ ] **Step 4: chat のラベル改名**

`app/chat/page.tsx` の該当行を置換:
```tsx
  { icon: "🔮", label: "占い",        href: "/fortune" },
```
(元: `label: "団子占い"`)

- [ ] **Step 5: cat-recommendation のラベル改名**

`app/api/cat-recommendation/route.ts` の52行目付近を置換:
```tsx
  { icon: "🔮", label: "占い",             href: "/fortune" },
```
(元: `label: "団子占い"`。※同ファイル43行目の `label: "占いを見る"` は変更しない)

- [ ] **Step 6: LifaiCat のラベル改名(+10BP 除去)**

`components/LifaiCat.tsx` の該当行を置換:
```tsx
    todos.push({ label: '🔮 占いを見る',        href: '/fortune'   });
```
(元: `label: '🔮 占いを見る +10BP'`。ハブ化で +10BP は団子固有のため除去)

- [ ] **Step 7: 残存「団子占い」ラベルが `/fortune` 導線に無いことを確認**

Run:
```bash
cd /c/Users/unite/aisalon
git grep -nE 'label: *"団子占い"|title: *"団子占い"|団子占い.*/fortune|/fortune.*団子占い' -- 'app/**' 'components/**' | grep -v 'GalleryNav'
```
Expected: 出力なし(空)。※団子ページ自身の見出し `団子占い 🍡` は `/fortune/dango` 側なので導線ラベルではない。

- [ ] **Step 8: ビルド確認**

Run:
```bash
cd /c/Users/unite/aisalon && rm -rf .next/types && npm run build 2>&1 | grep -E '/fortune|error|Failed' | head
```
Expected: 3ルート生成継続、`error`/`Failed` なし。

- [ ] **Step 9: コミット**

Run:
```bash
cd /c/Users/unite/aisalon
git add components/AppSidebar.tsx app/top/page.tsx app/5000/page.tsx app/chat/page.tsx app/api/cat-recommendation/route.ts components/LifaiCat.tsx
git commit -m "feat(fortune): 入口ラベルを「占い」に統一(ハブ化に追従)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 忠実移植・no-opスタブ据え置き → Task 1(19ファイルverbatim)。✓
- 団子を /fortune/dango へ非破壊移設 → Task 2 Step1(verbatim + diff検証)。✓
- /fortune ハブ化 → Task 2 Step2(LIFAIOVハブをverbatim)。✓
- 入口ラベル改名6箇所 → Task 3。✓
- GalleryNav 除外・cat-recommendation:43 維持 → Task 3 の維持リスト + Step7 grep で担保。✓
- 検証=npm run build + 3ルート → 各 Task の build ステップ。✓
- 5000タイルの安全性(表示専用) → Task 3 Step3 に明記。✓
- 未デプロイ(fortune-card ブランチ) → Global Constraints。✓

**Placeholder scan:** TBD/TODO なし。全ステップに実コマンド/実コード/期待出力あり。

**Type consistency:** Task 1 でコピーする `lib/fortune/*`・`components/tarot/*` は LIFAIOV で型整合済み(無改変)。Task 2 のハブも同ソースを verbatim コピーのため参照名(`StarBackground` 既定export・`TAROT_THEME`)が一致。
