import { useState, useEffect, useRef } from "react";

const INDENT = "　"; // 全角スペース
const KINSOKU_HEAD = ["、", "。", "）", "」", "』"];

export default function App() {
  const [cols, setCols] = useState(20);
  const [rows, setRows] = useState(20);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);

  const per = cols * rows;

  // cells: ページごとのセル配列
  const [cells, setCells] = useState(() =>
    Array(pages).fill(null).map(() => Array(per).fill(""))
  );
  // kinsokuRight: ページごとの行ごとの禁則スペース配列
  const [kinsokuRight, setKinsokuRight] = useState(() =>
    Array(pages).fill(null).map(() => Array(rows).fill(""))
  );

  const [cursor, setCursor] = useState(0); // カーソルはページ内インデックス
  const [composition, setComposition] = useState(""); // composition のプレビュー

  const gridRef = useRef(null);
  const imeRef = useRef(null);
  const composingRef = useRef(false);

  // サイズ／ページ数変更時にデータをリサイズして保持
  useEffect(() => {
    setCells(prev => {
      const next = Array(pages).fill(null).map(() => Array(per).fill(""));
      for (let p = 0; p < Math.min(prev.length, pages); p++) {
        const src = prev[p] || [];
        for (let i = 0; i < Math.min(src.length, per); i++) next[p][i] = src[i] || "";
      }
      return next;
    });
    setKinsokuRight(prev => {
      const next = Array(pages).fill(null).map(() => Array(rows).fill(""));
      for (let p = 0; p < Math.min(prev.length, pages); p++) {
        const src = prev[p] || [];
        for (let i = 0; i < Math.min(src.length, rows); i++) next[p][i] = src[i] || "";
      }
      return next;
    });
    if (cursor >= per) setCursor(per - 1);
    if (currentPage >= pages) setCurrentPage(Math.max(0, pages - 1));
  }, [cols, rows, pages]); // eslint-disable-line

  function isLineStart(pos) {
    return pos % cols === 0;
  }

  function targetKinsokuLineForPos(pos) {
    const line = Math.floor(pos / cols);
    return line === 0 ? 0 : line - 1; // 前行に入れる（先頭行は0行目）
  }

  // ページ内操作ユーティリティ
  function getPageCellsCopy() {
    const cp = cells.map(arr => [...arr]);
    return cp;
  }
  function getPageKCopy() {
    const kp = kinsokuRight.map(arr => [...arr]);
    return kp;
  }

  // 文字挿入（禁則は前行の右ガターへ）
  function insertChar(ch) {
    const nextCells = getPageCellsCopy();
    const nextK = getPageKCopy();
    const pageArr = nextCells[currentPage];
    const kArr = nextK[currentPage];
    let pos = cursor;

    for (const char of Array.from(ch)) {
      if (isLineStart(pos) && KINSOKU_HEAD.includes(char)) {
        const targetLine = targetKinsokuLineForPos(pos);
        if (targetLine >= 0 && targetLine < kArr.length) {
          kArr[targetLine] = char; // 上書き方針（必要なら変更可）
        }
        pos = Math.min(pos + 1, per - 1);
      } else {
        if (pos < pageArr.length) pageArr[pos] = char;
        pos = Math.min(pos + 1, per - 1);
      }
    }

    nextCells[currentPage] = pageArr;
    nextK[currentPage] = kArr;
    setCells(nextCells);
    setKinsokuRight(nextK);
    setCursor(pos);
  }

  function deleteChar() {
    if (cursor === 0) return;
    const prevPos = cursor - 1;
    const lineOfCursor = Math.floor(cursor / cols);
    const prevLineForKinsoku = lineOfCursor === 0 ? 0 : lineOfCursor - 1;

    const nextCells = getPageCellsCopy();
    const nextK = getPageKCopy();
    const pageArr = nextCells[currentPage];
    const kArr = nextK[currentPage];

    if (cursor % cols === 0) {
      // 行頭：まず前行の禁則右ガターをチェックして削除
      if (prevLineForKinsoku >= 0 && prevLineForKinsoku < kArr.length && kArr[prevLineForKinsoku]) {
        kArr[prevLineForKinsoku] = "";
      } else {
        if (prevPos >= 0 && prevPos < pageArr.length) pageArr[prevPos] = "";
      }
    } else {
      if (prevPos >= 0 && prevPos < pageArr.length) pageArr[prevPos] = "";
    }

    nextCells[currentPage] = pageArr;
    nextK[currentPage] = kArr;
    setCells(nextCells);
    setKinsokuRight(nextK);
    setCursor(c => Math.max(0, c - 1));
  }

  function newlineWithIndent() {
    const line = Math.floor(cursor / cols);
    const nextLineStart = (line + 1) * cols;
    if (nextLineStart >= per) return;

    const nextCells = getPageCellsCopy();
    const pageArr = nextCells[currentPage];
    pageArr[nextLineStart] = INDENT;
    nextCells[currentPage] = pageArr;
    setCells(nextCells);
    setCursor(nextLineStart + 1);
  }

  function handleKey(e) {
    if (e.isComposing || composingRef.current) return;

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      insertChar(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      deleteChar();
    } else if (e.key === "Enter") {
      e.preventDefault();
      newlineWithIndent();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCursor(c => Math.max(0, c - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setCursor(c => Math.min(per - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(0, c - cols));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(per - 1, c + cols));
    }
  }

  // プレビュー用マップ（現在ページのみ）
  const pageCells = cells[currentPage] || Array(per).fill("");
  const pageK = kinsokuRight[currentPage] || Array(rows).fill("");

  const previewMap = new Map();
  const previewK = Array(rows).fill("");

  if (composition) {
    let pos = cursor;
    for (const ch of Array.from(composition)) {
      if (isLineStart(pos) && KINSOKU_HEAD.includes(ch)) {
        const targetLine = targetKinsokuLineForPos(pos);
        if (targetLine >= 0 && targetLine < previewK.length) previewK[targetLine] = ch;
        pos = Math.min(pos + 1, per - 1);
      } else {
        if (pos < per) previewMap.set(pos, ch);
        pos = Math.min(pos + 1, per - 1);
      }
    }
  }

  // ページ操作
  function addPage() {
    setCells(prev => {
      const next = prev.map(arr => [...arr]);
      next.push(Array(per).fill(""));
      return next;
    });
    setKinsokuRight(prev => {
      const next = prev.map(arr => [...arr]);
      next.push(Array(rows).fill(""));
      return next;
    });
    setPages(p => p + 1);
    setCurrentPage(pages); // move to new page
  }
  function removePage() {
    if (pages <= 1) return;
    setCells(prev => {
      const next = prev.map(arr => [...arr]);
      next.splice(currentPage, 1);
      return next;
    });
    setKinsokuRight(prev => {
      const next = prev.map(arr => [...arr]);
      next.splice(currentPage, 1);
      return next;
    });
    setPages(p => p - 1);
    setCurrentPage(cp => Math.max(0, cp - 1));
  }
  function gotoPage(idx) {
    if (idx < 0 || idx >= pages) return;
    setCurrentPage(idx);
    setCursor(c => Math.min(c, per - 1));
  }

  // 文章全体をテキストのみで取得してクリップボードにコピー
  function copyPlainText() {
    const lines = [];
    for (let p = 0; p < pages; p++) {
      const pageArr = cells[p] || Array(per).fill("");
      const kArr = kinsokuRight[p] || Array(rows).fill("");
      for (let r = 0; r < rows; r++) {
        const base = r * cols;
        let line = "";
        for (let c = 0; c < cols; c++) {
          const ch = pageArr[base + c] || "";
          line += ch;
        }
        // 行末の禁則文字があれば追加
        if (kArr[r]) line += kArr[r];
        lines.push(line);
      }
      if (p < pages - 1) lines.push(""); // ページ間に空行を入れる
    }
    const text = lines.join("\n");
    // コピー
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        window.alert("本文をコピーしました（行番号なし）。");
      }, () => {
        window.alert("コピーに失敗しました。");
      });
    } else {
      // フォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        window.alert("本文をコピーしました（行番号なし）。");
      } catch {
        window.alert("コピーに失敗しました。");
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "serif" }}>
      <h1>原稿用紙シミュレータ（ベータ版）</h1>

      <div style={{ marginBottom: 10 }}>
        横
        <input
          type="number"
          value={cols}
          onChange={e => setCols(Math.max(1, +e.target.value))}
        />
        縦
        <input
          type="number"
          value={rows}
          onChange={e => setRows(Math.max(1, +e.target.value))}
        />
        <span style={{ marginLeft: 12 }}>
          ページ
          <button onClick={() => gotoPage(Math.max(0, currentPage - 1))} style={{ marginLeft: 6 }}>前</button>
          <strong style={{ margin: "0 6px" }}>{currentPage + 1} / {pages}</strong>
          <button onClick={() => gotoPage(Math.min(pages - 1, currentPage + 1))}>次</button>
          <button onClick={addPage} style={{ marginLeft: 8 }}>ページ追加</button>
          <button onClick={removePage} style={{ marginLeft: 6 }}>ページ削除</button>
          <button onClick={copyPlainText} style={{ marginLeft: 12 }}>本文をコピー（行番号なし）</button>
        </span>
      </div>

      {/* 隠し input（IME受け取り） */}
      <input
        ref={imeRef}
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none"
        }}
        onKeyDown={handleKey}
        onCompositionStart={() => {
          composingRef.current = true;
          setComposition("");
        }}
        onCompositionUpdate={e => {
          const data = e.data ?? (e.target && e.target.value) ?? "";
          setComposition(data || "");
        }}
        onCompositionEnd={e => {
          composingRef.current = false;
          const data = e.data ?? (e.target && e.target.value) ?? "";
          if (data) insertChar(data);
          setComposition("");
          if (e.target) e.target.value = "";
        }}
        onInput={e => {
          const v = e.target && e.target.value;
          if (v && !composingRef.current) {
            insertChar(v);
            if (e.target) e.target.value = "";
          }
        }}
      />

      {/* グリッド表示（現在ページのみ） */}
      <div
        ref={gridRef}
        tabIndex={0}
        onClick={() => imeRef.current && imeRef.current.focus()}
        style={{
          outline: "none",
          border: "2px solid green",
          display: "inline-block",
          background: "white"
        }}
      >
        {/* top gap */}
        <div
          style={{
            height: "0.8em",
            display: "grid",
            gridTemplateColumns: `1em repeat(${cols}, 2em) 1em`,
            borderTop: "1px solid green",
            borderBottom: "1px solid green",
            boxSizing: "border-box",
            background: "white"
          }}
        >
          <div />
          {Array.from({ length: cols }).map((_, c) => <div key={`t-${c}`} />)}
          <div />
        </div>

        {Array.from({ length: rows }).map((_, r) => {
          const rowBase = r * cols;
          const globalLine = currentPage * rows + (r + 1); // 続き番号
          return (
            <div key={r}>
              {/* text row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `1em repeat(${cols}, 2em) 1em`,
                  boxSizing: "border-box",
                  background: "white",
                  alignItems: "center"
                }}
              >
                {/* left gutter: 継続行番号（1em） */}
                <div
                  style={{
                    width: "1em",
                    height: "2em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                    fontSize: "0.75em",
                    boxSizing: "border-box",
                    borderLeft: "1px solid rgba(0,128,0,0.15)",
                    borderRight: "1px solid rgba(0,128,0,0.15)"
                  }}
                >
                  {globalLine}
                </div>

                {/* text cells */}
                {Array.from({ length: cols }).map((__, c) => {
                  const idx = rowBase + c;
                  const isPreview = previewMap.has(idx);
                  const content = isPreview ? previewMap.get(idx) : pageCells[idx];
                  const isCursor = idx === cursor;
                  return (
                    <div
                      key={idx}
                      style={{
                        width: "2em",
                        height: "2em",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isCursor ? "#cce5ff" : "white",
                        color: isPreview ? "#666" : "black",
                        fontStyle: isPreview ? "italic" : "normal",
                        boxSizing: "border-box",
                        borderLeft: "1px solid rgba(0,128,0,0.15)",
                        borderRight: "1px solid rgba(0,128,0,0.15)"
                      }}
                    >
                      {content}
                    </div>
                  );
                })}

                {/* right kinsoku column (幅1em) */}
                <div
                  style={{
                    width: "1em",
                    height: "2em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: previewK[r] ? "#666" : "#000",
                    fontStyle: previewK[r] ? "italic" : "normal",
                    fontSize: "0.9em",
                    boxSizing: "border-box",
                    borderLeft: "1px solid rgba(0,128,0,0.15)"
                  }}
                >
                  {previewK[r] || pageK[r]}
                </div>
              </div>

              {/* gap (行間) */}
              <div
                style={{
                  height: "0.8em",
                  display: "grid",
                  gridTemplateColumns: `1em repeat(${cols}, 2em) 1em`,
                  background: "white",
                  borderTop: "1px solid green",
                  borderBottom: "1px solid green",
                  boxSizing: "border-box"
                }}
              >
                <div />
                {Array.from({ length: cols }).map((_, c) => <div key={`g-${r}-${c}`} />)}
                <div />
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 10, fontSize: "0.9em" }}>
        Enter：段落＋字下げ / Backspace：削除 / 矢印キー：移動
      </p>
    </div>
  );
}
