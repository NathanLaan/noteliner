<script>
  // Import the SVG's raw markup rather than a URL — inlining via {@html} avoids
  // any dev-server fs.allow / CSP / URL-resolution surprises that can leave the
  // image broken on load.
  import appIconSvg from '../../../assets/icon-n-purple-diamonds-2.svg?raw';

  let { onClose } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>About</h2>
    </div>
    <div class="modal-body">
      <div class="app-icon" role="img" aria-label="NoteLiner">{@html appIconSvg}</div>
      <p class="app-name">NoteLiner</p>
      <p class="version">Version {__APP_VERSION__}</p>
      <p class="desc">An outliner-style note-taking application built with Electron and Svelte.</p>
      <div class="modal-footer">
        <button class="close-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .app-icon {
    display: block;
    width: 96px;
    height: 96px;
    margin: 0 auto 16px;
  }

  /* The imported SVG has width/height="512" baked in; override via CSS so it
     scales to the container size rather than rendering at its intrinsic size. */
  .app-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .app-name {
    font-size: 22px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .version {
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .desc {
    color: var(--text-secondary);
    margin-bottom: 24px;
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
  }

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>
