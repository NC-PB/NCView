<script>
  import { tokenizeLine } from "./gcode.js";

  /** @type {{ lines: string[], dialect: import("./gcode.js").Dialect }} */
  let { lines, dialect } = $props();

  // Rows have a fixed height so only the visible slice needs to be rendered.
  const LINE_HEIGHT = 22;
  const OVERSCAN = 20;

  /** @type {HTMLDivElement | undefined} */
  let viewport = $state();
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  let start = $derived(Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN));
  let end = $derived(
    Math.min(lines.length, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + OVERSCAN),
  );
  let visibleLines = $derived(
    lines.slice(start, end).map((text, i) => ({ number: start + i + 1, tokens: tokenizeLine(text, dialect) })),
  );

  // A new file starts at the top.
  $effect(() => {
    lines;
    scrollTop = 0;
    if (viewport) viewport.scrollTop = 0;
  });
</script>

<div
  class="viewport"
  style:--line-height="{LINE_HEIGHT}px"
  style:--digits={String(lines.length).length}
  bind:this={viewport}
  bind:clientHeight={viewportHeight}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
  <div
    class="rows"
    style:height="{lines.length * LINE_HEIGHT}px"
    style:padding-top="{start * LINE_HEIGHT}px"
  >
    {#each visibleLines as line (line.number)}
      <div class="line">
        <span class="line-number">{line.number}</span>
        <span class="line-content">{#each line.tokens as token}{#if token.kind}<span class={token.kind}>{token.text}</span>{:else}{token.text}{/if}{/each}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .viewport {
    height: 100%;
    overflow: auto;
    background: var(--code-bg);
    color: var(--code-text);
    font-family: var(--font-mono);
    font-size: 13px;
    font-variant-ligatures: none;
    line-height: var(--line-height);
  }

  .rows {
    box-sizing: border-box;
    width: max-content;
    min-width: 100%;
  }

  .line {
    display: flex;
    height: var(--line-height);
  }

  .line:hover {
    background: var(--line-hover);
  }

  .line:hover .line-number {
    color: var(--text-2);
  }

  .line-number {
    position: sticky;
    left: 0;
    box-sizing: content-box;
    width: calc(var(--digits) * 1ch);
    min-width: 3ch;
    padding: 0 14px 0 16px;
    background: var(--gutter-bg);
    color: var(--gutter-text);
    border-right: 1px solid var(--border);
    text-align: right;
    font-size: 12px;
    user-select: none;
  }

  .line-content {
    padding: 0 20px 0 16px;
    white-space: pre;
  }

  .g-code {
    color: var(--hl-g);
    font-weight: 600;
  }

  .coordinate {
    color: var(--hl-coord);
  }

  .m-code,
  .t-code {
    color: var(--hl-mt);
  }

  .f-code,
  .s-code {
    color: var(--hl-fs);
  }

  .comment {
    color: var(--hl-comment);
    font-style: italic;
  }

  .block {
    color: var(--hl-block);
  }

  .keyword {
    color: var(--hl-keyword);
  }

  .variable {
    color: var(--hl-variable);
  }

  .string {
    color: var(--hl-string);
  }

  /* Klartext structure blocks, Sinumerik labels and file headers. */
  .section {
    color: var(--text);
    font-weight: 700;
  }
</style>
