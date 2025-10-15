<script>
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";

  let gcodeContent = $state("");
  let fileName = $state("");
  let fileInfo = $state(null);
  let isLoading = $state(false);
  let error = $state("");

  async function openFile() {
    try {
      isLoading = true;
      error = "";
      
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "G-Code Files",
            extensions: ["nc", "cnc", "gcode", "g", "tap", "txt"]
          },
          {
            name: "All Files",
            extensions: ["*"]
          }
        ]
      });

      if (selected) {
        // Get file info
        const info = await invoke("get_file_info", { filePath: selected });
        fileInfo = info;
        fileName = info.name;

        // Read file content
        const content = await invoke("read_file_content", { filePath: selected });
        gcodeContent = content;
      }
    } catch (err) {
      error = `Error opening file: ${err}`;
      console.error("Error opening file:", err);
    } finally {
      isLoading = false;
    }
  }

  function highlightGCode(content) {
    if (!content) return "";
    
    return content
      .split('\n')
      .map((line, index) => {
        const lineNumber = index + 1;
        const highlightedLine = line
          // G-codes (motion commands)
          .replace(/\b([Gg]\d+(?:\.\d+)?)/g, '<span class="g-code">$1</span>')
          // M-codes (machine functions)
          .replace(/\b([Mm]\d+(?:\.\d+)?)/g, '<span class="m-code">$1</span>')
          // F-codes (feed rate)
          .replace(/\b([Ff]\d+(?:\.\d+)?)/g, '<span class="f-code">$1</span>')
          // S-codes (spindle speed)
          .replace(/\b([Ss]\d+(?:\.\d+)?)/g, '<span class="s-code">$1</span>')
          // T-codes (tool selection)
          .replace(/\b([Tt]\d+(?:\.\d+)?)/g, '<span class="t-code">$1</span>')
          // Coordinates (X, Y, Z, A, B, C)
          .replace(/\b([XYZABCIJK][+\-]?(?:\d+\.?\d*|\.\d+))/g, '<span class="coordinate">$1</span>')
          // Comments
          .replace(/(\([^)]*\))/g, '<span class="comment">$1</span>')
          .replace(/(;.*$)/g, '<span class="comment">$1</span>');
          // Numbers (general)
          //.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="number">$1</span>');
        
        return `<div class="line"><span class="line-number">${lineNumber}</span><span class="line-content">${highlightedLine}</span></div>`;
      })
      .join('');
  }

  function clearFile() {
    gcodeContent = "";
    fileName = "";
    fileInfo = null;
    error = "";
  }
</script>

<main class="container">
 {#if !gcodeContent}
  <header>
    <h1>NC-Code Viewer</h1>
    <p>G-Code viewer with syntax highlighting</p>
  </header>
  {/if}

  <div class="toolbar">
    <button onclick={openFile} disabled={isLoading} class="primary-btn">
      {isLoading ? "Loading..." : "📁 Open G-Code File"}
    </button>
    
    {#if gcodeContent}
      <button onclick={clearFile} class="secondary-btn">
        🗑️ Clear
      </button>
    {/if}
  </div>

  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  {#if fileInfo}
    <div class="file-info">
      <div class="info-item">
        <strong>File:</strong> {fileInfo.name}
      </div>
      <div class="info-item">
        <strong>Size:</strong> {(fileInfo.size / 1024).toFixed(2)} KB
      </div>
      <div class="info-item">
        <strong>Lines:</strong> {gcodeContent.split('\n').length}
      </div>
    </div>
  {/if}

  {#if gcodeContent}
    <div class="code-viewer">
      <div class="code-header">
        <h3>{fileName || "G-Code Content"}</h3>
        <div class="legend">
          <span class="legend-item"><span class="g-code">G##</span> Motion</span>
          <span class="legend-item"><span class="m-code">M##</span> Machine</span>
          <span class="legend-item"><span class="f-code">F##</span> Feed</span>
          <span class="legend-item"><span class="s-code">S##</span> Spindle</span>
          <span class="legend-item"><span class="t-code">T##</span> Tool</span>
          <span class="legend-item"><span class="coordinate">XYZ</span> Coordinates</span>
          <span class="legend-item"><span class="comment">()</span> Comments</span>
        </div>
      </div>
      <div class="code-content">
        {@html highlightGCode(gcodeContent)}
      </div>
    </div>
  {:else if !isLoading}
    <div class="empty-state">
      <div class="empty-icon">📄</div>
      <h3>No G-Code file loaded</h3>
      <p>Click "Open G-Code File" to load and view a file with syntax highlighting</p>
    </div>
  {/if}
</main>

<style>
  :root {
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #2d3748;
    background-color: #f7fafc;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
  }

  header {
    text-align: center;
    margin-bottom: 30px;
  }

  header h1 {
    color: #1a202c;
    margin-bottom: 8px;
    font-size: 2.5rem;
    font-weight: 700;
  }

  header p {
    color: #718096;
    font-size: 1.1rem;
  }

  .toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    align-items: center;
    justify-content: center;
  }

  .primary-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .primary-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .secondary-btn {
    background: #e2e8f0;
    color: #4a5568;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .secondary-btn:hover {
    background: #cbd5e0;
  }

  .error-message {
    background: #fed7d7;
    color: #c53030;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 4px solid #e53e3e;
  }

  .file-info {
    background: #edf2f7;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .info-item {
    color: #4a5568;
    font-size: 14px;
  }

  .info-item strong {
    color: #2d3748;
  }

  .code-viewer {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }

  .code-header {
    background: #f8f9fa;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .code-header h3 {
    margin: 0 0 12px 0;
    color: #2d3748;
    font-size: 18px;
  }

  .legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #718096;
  }

  .code-content {
    background: #1a202c;
    color: #e2e8f0;
    padding: 0;
    max-height: 600px;
    overflow: auto;
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #718096;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 20px;
  }

  .empty-state h3 {
    color: #4a5568;
    margin-bottom: 8px;
  }

  .empty-state p {
    max-width: 400px;
    margin: 0 auto;
  }

  /* G-Code Syntax Highlighting */
  :global(.line) {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  :global(.line:hover) {
    background-color: rgba(255, 255, 255, 0.05);
  }

  :global(.line-number) {
    background: #2d3748;
    color: #718096;
    padding: 8px 12px;
    min-width: 60px;
    text-align: right;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    user-select: none;
    font-size: 12px;
  }

  :global(.line-content) {
    padding: 8px 16px;
    flex: 1;
    white-space: pre;
  }

  :global(.g-code) {
    color: #48bb78;
    font-weight: 600;
  }

  :global(.m-code) {
    color: #ed8936;
    font-weight: 600;
  }

  :global(.f-code) {
    color: #4299e1;
    font-weight: 600;
  }

  :global(.s-code) {
    color: #9f7aea;
    font-weight: 600;
  }

  :global(.t-code) {
    color: #38b2ac;
    font-weight: 600;
  }

  :global(.coordinate) {
    color: #f6e05e;
    font-weight: 500;
  }

  :global(.comment) {
    color: #a0aec0;
    font-style: italic;
  }

  :global(.number) {
    color: #fc8181;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color: #e2e8f0;
      background-color: #1a202c;
    }

    .file-info {
      background: #2d3748;
    }

    .code-header {
      background: #2d3748;
      border-bottom-color: #4a5568;
    }

    .code-viewer {
      border-color: #4a5568;
    }

    .empty-state h3 {
      color: #e2e8f0;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding: 15px;
    }

    .file-info {
      flex-direction: column;
      gap: 8px;
    }

    .legend {
      justify-content: center;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .code-content {
      font-size: 12px;
    }

    :global(.line-number) {
      min-width: 50px;
      padding: 6px 8px;
    }

    :global(.line-content) {
      padding: 6px 12px;
    }
  }
</style>
