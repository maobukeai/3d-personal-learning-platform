import type { Directive, DirectiveBinding } from 'vue';

interface LoadingElement extends HTMLElement {
  __loadingEl?: HTMLElement;
  __loadingOverlay?: HTMLElement;
}

const LoadingDirective: Directive<LoadingElement, boolean> = {
  mounted(el, binding: DirectiveBinding<boolean>) {
    el.style.position = el.style.position || 'relative';
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(4px);
      pointer-events: none;
      transition: opacity 0.2s ease;
    `;
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 32px;
      height: 32px;
      border: 2px solid var(--accent, #6366f1);
      border-top-color: transparent;
      border-radius: 50%;
      animation: v-loading-spin 0.6s linear infinite;
    `;
    /* Dark mode */
    if (document.documentElement.classList.contains('dark')) {
      overlay.style.background = 'rgba(15, 23, 42, 0.6)';
    }
    overlay.appendChild(spinner);
    el.__loadingOverlay = overlay;
    if (!binding.value) {
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
    }
    /* Inject keyframes if not present */
    if (!document.getElementById('v-loading-keyframes')) {
      const style = document.createElement('style');
      style.id = 'v-loading-keyframes';
      style.textContent = '@keyframes v-loading-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    el.appendChild(overlay);
  },
  updated(el, binding: DirectiveBinding<boolean>) {
    if (!el.__loadingOverlay) return;
    if (binding.value) {
      el.__loadingOverlay.style.opacity = '1';
      el.__loadingOverlay.style.pointerEvents = 'auto';
    } else {
      el.__loadingOverlay.style.opacity = '0';
      el.__loadingOverlay.style.pointerEvents = 'none';
    }
  },
  unmounted(el) {
    if (el.__loadingOverlay) {
      el.__loadingOverlay.remove();
      delete el.__loadingOverlay;
    }
  },
};

export default LoadingDirective;
