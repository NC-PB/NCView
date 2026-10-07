<script>
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { open } from "@tauri-apps/plugin-dialog";
  import CodeView from "#lib/CodeView.svelte";
  import { DIALECTS, detectDialect, formatSize, splitLines } from "#lib/gcode.js";

  /**
   * @typedef {{ name: string, path: string, size: number, encoding: string, content: string }} NcFile
   * @typedef {"light" | "dark"} Theme
   * @typedef {import("#lib/gcode.js").Dialect} Dialect
   */

  const APP_NAME = "NC-Code Viewer";
  const EXTENSIONS = ["nc", "cnc", "gcode", "g", "ngc", "tap", "h", "mpf", "spf", "iso", "eia", "txt"];
  const MOD_KEY = navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl";

  let file = $state(/** @type {NcFile | null} */ (null));
  // Detected when a file opens; the selector in the top bar can override it.
  let dialect = $state(/** @type {Dialect} */ ("iso"));
  let isLoading = $state(false);
  let error = $state("");
  let dragging = $state(false);

  // static/theme.js has already applied the saved or system theme before first paint.
  let theme = $state(/** @type {Theme} */ (document.documentElement.dataset.theme === "light" ? "light" : "dark"));
  let followSystem = $state(storedTheme() === null);

  let lines = $derived(file ? splitLines(file.content) : []);
  // Encoding only shows up when it is something other than plain UTF-8.
  let fileMeta = $derived(
    file
      ? [`${lines.length.toLocaleString()} lines`, formatSize(file.size), file.encoding !== "UTF-8" && file.encoding]
          .filter(Boolean)
          .join(" · ")
      : "",
  );

  /** The Tauri window, or null when running in a plain browser (e.g. `npm run dev`). */
  function appWindow() {
    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  }

  function storedTheme() {
    try {
      const value = localStorage.getItem("theme");
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    followSystem = false;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Not persisted; the choice still applies for this session.
    }
  }

  $effect(() => {
    document.documentElement.dataset.theme = theme;
    // Keep the native title bar in step. `null` lets it follow the system again.
    appWindow()?.setTheme(followSystem ? null : theme).catch(() => {});
  });

  $effect(() => {
    appWindow()?.setTitle(file ? `${file.name} — ${APP_NAME}` : APP_NAME).catch(() => {});
  });

  onMount(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    /** @param {MediaQueryListEvent} e */
    const onSystemChange = (e) => {
      if (followSystem) theme = e.matches ? "dark" : "light";
    };
    media.addEventListener("change", onSystemChange);

    /** @type {(() => void) | undefined} */
    let unlistenDrop;
    try {
      getCurrentWebview()
        .onDragDropEvent(({ payload }) => {
          if (payload.type === "enter" || payload.type === "over") {
            dragging = true;
          } else {
            dragging = false;
            if (payload.type === "drop" && payload.paths.length > 0) loadFile(payload.paths[0]);
          }
        })
        .then((unlisten) => (unlistenDrop = unlisten));
    } catch {
      // Not running inside Tauri.
    }

    return () => {
      media.removeEventListener("change", onSystemChange);
      unlistenDrop?.();
    };
  });

  async function openFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "NC programs", extensions: EXTENSIONS },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (selected) await loadFile(selected);
    } catch (err) {
      error = `Could not open file: ${err}`;
    }
  }

  /** @param {string} path */
  async function loadFile(path) {
    isLoading = true;
    error = "";
    try {
      /** @type {NcFile} */
      const opened = await invoke("open_nc_file", { path });
      dialect = detectDialect(opened.name, opened.content);
      file = opened;
    } catch (err) {
      error = String(err);
      console.error("Error opening file:", err);
    } finally {
      isLoading = false;
    }
  }

  function closeFile() {
    file = null;
    error = "";
  }

  /** @param {KeyboardEvent} e */
  function onKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
      e.preventDefault();
      openFile();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app">
  <header class="topbar">
    <div class="brand">
      <svg class="mark" width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="23" height="23" rx="5" stroke="currentColor" stroke-width="2" />
        <path d="M13 1.5V8m0 10v6.5M1.5 13H8m10 0h6.5" stroke="currentColor" stroke-width="2" />
        <circle cx="13" cy="13" r="3" fill="var(--accent)" />
      </svg>
      <span class="wordmark">NCView</span>
    </div>

    {#if file}
      <div class="file" title={file.path}>
        <span class="file-dot" aria-hidden="true"></span>
        <span class="file-name">{file.name}</span>
        <span class="file-meta">{fileMeta}</span>
        <select class="dialect" bind:value={dialect} aria-label="Control dialect" title="Control dialect (detected automatically)">
          {#each DIALECTS as option (option.id)}
            <option value={option.id}>{option.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="actions">
      {#if file}
        <button class="btn btn-primary" onclick={openFile} disabled={isLoading} title="Open file ({MOD_KEY}O)">
          {isLoading ? "Opening…" : "Open"}
        </button>
        <button class="icon-btn" onclick={closeFile} aria-label="Close file" title="Close file">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      {/if}
      <button
        class="icon-btn"
        onclick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {#if theme === "dark"}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        {/if}
      </button>
    </div>
  </header>

  {#if error}
    <div class="error" role="alert">
      <span>{error}</span>
      <button class="icon-btn small" onclick={() => (error = "")} aria-label="Dismiss error">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  {/if}

  <main class="content">
    {#if file}
      <CodeView {lines} {dialect} />
    {:else}
      <div class="empty">
        <p class="eyebrow">NC-Code · Viewer</p>
        <h1>Open an <span class="accent">NC program.</span></h1>
        <p class="hint">Drop a file anywhere, or press <kbd>{MOD_KEY}</kbd> <kbd>O</kbd></p>
        <button class="btn btn-primary btn-lg" onclick={openFile} disabled={isLoading}>
          {isLoading ? "Opening…" : "Open file"}
        </button>
      </div>
    {/if}

    {#if dragging}
      <div class="drop-overlay" aria-hidden="true">Drop to open</div>
    {/if}
  </main>
</div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Top bar */
  .topbar {
    flex: none;
    height: 48px;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 10px 0 16px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--text);
  }

  .wordmark {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .file {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
    padding-left: 20px;
    border-left: 1px solid var(--border);
    font-family: var(--font-mono);
  }

  .file-dot {
    flex: none;
    align-self: center;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
  }

  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .file-meta {
    flex: none;
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
  }

  .dialect {
    flex: none;
    align-self: center;
    appearance: none;
    padding: 2px 24px 2px 10px;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: transparent
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%237e8b99' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E")
      no-repeat right 9px center;
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .dialect:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }

  .dialect option {
    background: var(--bg-raised);
    color: var(--text);
  }

  .actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Buttons */
  .btn {
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    font-weight: 600;
    white-space: nowrap;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .btn-primary {
    padding: 6px 16px;
    margin-right: 4px;
    background: var(--primary);
    color: var(--on-primary);
    font-size: 13px;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.86;
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(1px);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-lg {
    margin: 8px 0 0;
    padding: 11px 26px;
    font-size: 14px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: var(--text-2);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .icon-btn.small {
    width: 26px;
    height: 26px;
    color: inherit;
  }

  .icon-btn.small svg {
    width: 15px;
    height: 15px;
  }

  /* Error */
  .error {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px 6px 16px;
    background: var(--danger-soft);
    color: var(--danger);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  /* Content */
  .content {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 24px 48px;
    text-align: center;
    background-image:
      radial-gradient(ellipse 50% 40% at 50% 45%, var(--accent-soft), transparent 70%),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
      linear-gradient(var(--grid-line) 1px, transparent 1px);
    background-size:
      100% 100%,
      40px 40px,
      40px 40px;
    background-position: center;
  }

  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }

  h1 {
    margin: 14px 0 12px;
    font-family: var(--font-display);
    font-size: clamp(34px, 5vw, 54px);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.025em;
    color: var(--text);
  }

  .accent {
    color: var(--accent);
  }

  .hint {
    margin: 0 0 20px;
    font-size: 15px;
    color: var(--text-2);
  }

  kbd {
    display: inline-block;
    min-width: 1.4em;
    padding: 1px 6px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 6px;
    background: var(--bg-raised);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
    text-align: center;
  }

  .drop-overlay {
    position: absolute;
    inset: 12px;
    display: grid;
    place-items: center;
    border: 2px dashed var(--accent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    backdrop-filter: blur(2px);
    color: var(--accent);
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    pointer-events: none;
  }
</style>
