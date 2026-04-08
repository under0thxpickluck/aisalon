了解。
**既存の `music.md` を前提に、Whisper ASR → ElevenLabs Speech-to-Text(Scribe v2) へ差し替えるだけ**の、最小変更MDをそのまま貼る。
方針は **「無駄なコード追加なし・大型変更なし・既存フロー維持」**。今のフローでは Step 3 Phase 3 が Whisper ASR になっているので、そこだけを差し替えるのが最短。 
また、ElevenLabsの正式な用途として **Scribe v2 はバッチ文字起こし向け**、Realtime版は会話やライブ用途向けなので、今回の「生成後の曲ファイルを文字起こし」には通常の Speech-to-Text を使うのが適切。 ([ElevenLabs][1])

````md
# elevenlabs_scribe_swap_minimal.md

## 目的
LIFAI の music2 フローにおける歌詞書き起こしを、
**OpenAI Whisper ASR → ElevenLabs Speech-to-Text (Scribe v2)** に差し替える。

---

## 最重要方針
- 既存構造は壊さない
- 大型変更しない
- 新規ファイルは最小限
- 既存の `displayLyrics` / `distributionLyrics` / `lyricsGateResult` の流れはそのまま使う
- 変更範囲は **ASR層だけ** に限定する

---

## 現状認識
現行仕様では以下の流れになっている。

- Step 3 Phase 3: ASR（歌詞書き起こし）
- ファイル: `lib/music/asr.ts`
- 現在: OpenAI Whisper API で音声から歌詞を書き起こし
- その後:
  - `lyrics-compare.ts`
  - `lyrics-merge.ts`
  - `lyrics-repeat.ts`
  - `lyrics-quality.ts`
  - `lyrics-gate.ts`
  に流している

このため、**後段ロジックは維持**し、`lib/music/asr.ts` の実装だけ差し替える。  
`app/api/song/approve-structure/route.ts` 側は、呼び出し先が `transcribeLyrics(...)` のような形なら基本そのままにする。

---

## ElevenLabs採用理由
今回の用途は「完成済み音源をAPIへ投げてテキスト化するバッチ処理」である。  
ElevenLabs公式では以下の切り分けになっている。

- **Scribe v2**: バッチ文字起こし向け
- **Scribe v2 Realtime**: 低遅延リアルタイム向け

よって、LIFAIの音楽生成後の歌詞起こしは **Scribe v2** を使う。  
Talk / Agents 系は会話エージェント用途なので今回は使わない。

---

## 変更対象
1. `lib/music/asr.ts`
2. 必要なら `app/api/song/approve-structure/route.ts` の import / エラーログ文言のみ微修正
3. `.env` / 環境変数説明

---

## 変更内容

### 1) `lib/music/asr.ts` を ElevenLabs Scribe v2 実装へ差し替え

### やること
- 既存の公開関数名はなるべく維持する
- 返り値の型も今の後段が壊れない形を維持する
- OpenAI Whisper 呼び出しを削除し、
  ElevenLabs Speech-to-Text API 呼び出しに置換する

### 推奨方針
既存が例えばこうなら:

```ts
export async function transcribeLyrics(audioBuffer: Buffer): Promise<{
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}>
````

この **関数名と返り値構造は維持**する。

---

## 実装イメージ

```ts
// lib/music/asr.ts
export async function transcribeLyrics(
  audioBuffer: Buffer,
  filename = "audio.wav"
): Promise<{
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  provider?: string;
}> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append(
    "file",
    new Blob([audioBuffer], { type: "audio/wav" }),
    filename
  );

  // 日本語主体なら指定。自動判定にしたい場合は省略でも可
  form.append("language_code", "ja");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT failed: ${res.status} ${errText}`);
  }

  const data = await res.json();

  const text =
    typeof data.text === "string"
      ? data.text
      : typeof data.transcript === "string"
      ? data.transcript
      : "";

  // segments が無い可能性もあるので安全に扱う
  const segments = Array.isArray(data.words)
    ? data.words.map((w: any) => ({
        start: Number(w.start) || 0,
        end: Number(w.end) || 0,
        text: String(w.text || "").trim(),
      }))
    : undefined;

  return {
    text,
    segments,
    provider: "elevenlabs_scribe_v2",
  };
}
```

---

## 重要な実装ルール

* **既存の関数名は変えない**
* 呼び出し側が `text` を参照しているならそれを維持
* `segments` が後段で未使用なら無理に加工しない
* ElevenLabsの返却仕様差分に備え、`text` / `transcript` の両対応にしておく
* `words` が無ければ `segments` は `undefined` でよい

---

### 2) `app/api/song/approve-structure/route.ts`

ここは原則変更最小。

### やること

* 既存の `transcribeLyrics(...)` 呼び出しをそのまま使う
* ログ文言だけ必要なら修正

#### 例

変更前:

```ts
console.log("[music] whisper transcription start");
```

変更後:

```ts
console.log("[music] elevenlabs scribe transcription start");
```

変更前:

```ts
const asrResult = await transcribeLyrics(finalAudioBuffer);
```

変更後:

```ts
const asrResult = await transcribeLyrics(finalAudioBuffer);
```

※ 呼び出し自体は変えないのが理想

---

### 3) 環境変数

既存で `ELEVENLABS_API_KEY` は音楽生成でも使っているため、**新規 env の追加は不要**。
これはかなり大きい。

つまり今回の差し替えは、

* `OPENAI_API_KEY` を ASR用途で使わなくなる
* `ELEVENLABS_API_KEY` を ASRにも使う
  だけで済む

---

## 変更しないもの

以下は触らない。

* `lyrics-compare.ts`
* `lyrics-merge.ts`
* `lyrics-repeat.ts`
* `lyrics-quality.ts`
* `lyrics-gate.ts`
* `app/music2/page.tsx`
* `app/api/song/result/route.ts`
* R2保存周り
* ジョブ永続化

理由:
ASRの出力として **最終的にテキストが返れば後段はそのまま使える** ため。

---

## エラー時方針

既存の Whisper 時代のエラーハンドリングを流用する。

推奨:

* ElevenLabs STT失敗時はそのまま例外
* 既存の `review_required` / fallback ロジックがあるならそこに乗せる
* 追加で独自の大きなリトライ制御は入れない

---

## 完了条件

以下を満たしたらDone。

1. 音楽生成後、ASRが ElevenLabs に差し替わっている
2. `displayLyrics` / `distributionLyrics` の生成フローが壊れていない
3. 既存の品質判定フローがそのまま動く
4. 追加ファイルを増やさず、主な変更が `lib/music/asr.ts` に収まっている
5. OpenAI Whisper を ASR用途で呼ばなくなる

---

## Claude Codeへの実装指示

* 既存コード削除は最小限
* `lib/music/asr.ts` の中だけを置換する方針で進める
* 関数シグネチャはなるべく維持
* `approve-structure/route.ts` は import とログ文言の最小修正のみ
* 新しい抽象化レイヤー、provider切替機構、設定テーブルは追加しない
* まず最短で ElevenLabs Scribe v2 へ差し替えることを優先する

---

## 備考

ElevenLabs公式では Scribe v2 はバッチ文字起こし向け、Realtime版はライブ用途。
今回の music2 では完成済み音源に対する後処理なので、Realtimeは使わない。

```

この方針なら、**実質 `lib/music/asr.ts` の差し替えだけ**で済む。  
今の `music.md` の流れも壊さない。 :contentReference[oaicite:2]{index=2}

必要なら次に、**お前の既存ファイル名に合わせた“前後コードつきパッチ形式”**で出す。
::contentReference[oaicite:3]{index=3}
```

[1]: https://elevenlabs.io/docs/overview/capabilities/speech-to-text?utm_source=chatgpt.com "Transcription | ElevenLabs Documentation"
