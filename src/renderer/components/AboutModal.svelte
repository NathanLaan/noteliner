<script>
  // Import the SVG's raw markup rather than a URL — inlining via {@html} avoids
  // any dev-server fs.allow / CSP / URL-resolution surprises that can leave the
  // image broken on load.
  import appIconSvg from '../../../assets/icon-hexagon.svg?raw';

  let { onClose } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }

  function openRepo(e) {
    e.preventDefault();
    window.api.openExternal('https://github.com/NathanLaan/noteliner');
  }
</script>

<div class="modal-overlay about-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal about-modal">
    <div class="modal-header">
      <h2>About</h2>
    </div>
    <div class="modal-body">
      <div class="header-row">
        <div class="header-left">
          <p class="app-name">NoteLiner</p>
          <p class="version">Version {__APP_VERSION__}</p>
          <p class="desc">An outliner-style note-taking application built with Electron and Svelte.</p>
          <p class="repo-link"><a href="https://github.com/NathanLaan/noteliner" onclick={openRepo}>github.com/NathanLaan/noteliner</a></p>
        </div>
        <div class="app-icon" role="img" aria-label="NoteLiner">{@html appIconSvg}</div>
      </div>
      <div class="modal-footer">
        <button class="close-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  /* About modal: 50% × 50% of the overlay's padded area, pinned to the bottom.
     The shared .modal class still applies the slide-up animation — overriding
     size/position here doesn't affect it. */
  .about-overlay {
    align-items: flex-end;
    justify-content: center;
  }

  .about-modal {
    width: 50%;
    height: 50%;
    min-width: 480px;
    min-height: 380px;
  }

  /* Flex-column the body so the OK button can be promoted to the bottom via
     margin-top: auto. The existing .modal-footer rule keeps it right-aligned. */
  .modal-body {
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    margin-top: auto;
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 8px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .app-icon {
    width: 96px;
    height: 96px;
    flex-shrink: 0;
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
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .repo-link {
    margin-bottom: 24px;
  }

  .repo-link a {
    color: var(--accent);
    text-decoration: none;
  }

  .repo-link a:hover {
    text-decoration: underline;
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
