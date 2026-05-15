/* ============================================================
   modal.js — Global modal system
   Replaces browser confirm() and alert() with styled modals.
   
   HOW TO USE in any page:
   
   // Simple confirm
   const yes = await Modal.confirm('Are you sure?', 'This cannot be undone.');
   if (yes) { ...do something... }
   
   // Alert / info
   await Modal.alert('Success!', 'Your changes were saved.');
   
   // Prompt (text input)
   const reason = await Modal.prompt('Reason?', 'Enter reason (optional)');
   
   // Danger confirm (red button)
   const yes = await Modal.danger('Delete this?', 'This is permanent.', 'Delete');
   ============================================================ */

// ── Inject Modal HTML into page ───────────────────────────────
(function injectModalHTML() {
  if (document.getElementById('sb-modal-overlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="sb-modal-overlay" style="
      position:fixed; inset:0;
      background:rgba(26,26,46,0.55);
      backdrop-filter:blur(6px);
      -webkit-backdrop-filter:blur(6px);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; padding:20px;
      opacity:0; transition:opacity 0.2s;
      pointer-events:none;
    ">
      <div id="sb-modal-box" style="
        background:#fff; border-radius:20px; padding:32px;
        width:100%; max-width:460px;
        box-shadow:0 24px 64px rgba(26,26,46,0.2);
        transform:scale(0.95); transition:transform 0.2s;
      ">
        <div id="sb-modal-icon"  style="font-size:40px; text-align:center; margin-bottom:12px;"></div>
        <div id="sb-modal-title" style="font-family:'Sora',sans-serif; font-size:1.2rem; font-weight:700; color:#2C2C54; margin-bottom:8px; text-align:center;"></div>
        <div id="sb-modal-body"  style="font-size:14px; color:#64748B; line-height:1.6; text-align:center; margin-bottom:20px;"></div>
        <div id="sb-modal-input-wrap" style="margin-bottom:16px; display:none;">
          <textarea id="sb-modal-input" rows="3" style="
            width:100%; padding:10px 14px;
            border:1.5px solid #E2E8F8; border-radius:12px;
            font-family:'Plus Jakarta Sans',sans-serif; font-size:14px;
            color:#2C2C54; outline:none; resize:vertical;
            transition:border-color 0.2s;
          " placeholder="Type here..."></textarea>
        </div>
        <div id="sb-modal-btns" style="display:flex; gap:10px; justify-content:center;"></div>
      </div>
    </div>
  `);

  // Focus style on textarea
  const ta = document.getElementById('sb-modal-input');
  if (ta) {
    ta.addEventListener('focus', () => ta.style.borderColor = '#2D5BE3');
    ta.addEventListener('blur',  () => ta.style.borderColor = '#E2E8F8');
  }
})();

// ── Core Modal Engine ─────────────────────────────────────────
const Modal = (() => {

  function show({ icon='', title='', body='', buttons=[], showInput=false, inputPlaceholder='', inputValue='' }) {
    return new Promise(resolve => {
      const overlay = document.getElementById('sb-modal-overlay');
      const box     = document.getElementById('sb-modal-box');

      document.getElementById('sb-modal-icon').textContent  = icon;
      document.getElementById('sb-modal-title').textContent = title;
      document.getElementById('sb-modal-body').innerHTML    = body;

      // Input
      const inputWrap = document.getElementById('sb-modal-input-wrap');
      const inputEl   = document.getElementById('sb-modal-input');
      inputWrap.style.display = showInput ? 'block' : 'none';
      if (showInput) {
        inputEl.value       = inputValue || '';
        inputEl.placeholder = inputPlaceholder || '';
      }

      // Buttons
      const btnsEl = document.getElementById('sb-modal-btns');
      btnsEl.innerHTML = '';
      buttons.forEach(btn => {
        const el = document.createElement('button');
        el.textContent = btn.label;
        el.style.cssText = `
          padding:10px 24px; border-radius:12px; font-size:14px;
          font-weight:600; cursor:pointer; border:none;
          font-family:'Plus Jakarta Sans',sans-serif;
          transition:all 0.2s; min-width:100px;
          ${btn.style || ''}
        `;
        el.addEventListener('mouseenter', () => el.style.opacity='0.85');
        el.addEventListener('mouseleave', () => el.style.opacity='1');
        el.addEventListener('click', () => {
          hide();
          if (btn.value === 'input') {
            resolve(inputEl.value.trim());
          } else {
            resolve(btn.value);
          }
        });
        btnsEl.appendChild(el);
      });

      // Show overlay
      overlay.style.pointerEvents = 'auto';
      requestAnimationFrame(() => {
        overlay.style.opacity  = '1';
        box.style.transform    = 'scale(1)';
      });

      // Close on backdrop click (only if there's a cancel button)
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          const cancelBtn = buttons.find(b => b.value === false || b.value === null);
          if (cancelBtn) { hide(); resolve(cancelBtn.value); }
        }
      };
    });
  }

  function hide() {
    const overlay = document.getElementById('sb-modal-overlay');
    const box     = document.getElementById('sb-modal-box');
    overlay.style.opacity    = '0';
    box.style.transform      = 'scale(0.95)';
    overlay.style.pointerEvents = 'none';
  }

  return {
    // ── Confirm (blue) ────────────────────────────────────
    confirm(title, body='', confirmLabel='Confirm') {
      return show({
        icon: '❓', title, body,
        buttons: [
          { label: 'Cancel',       value: false, style: 'background:#F1F5F9; color:#64748B;' },
          { label: confirmLabel,   value: true,  style: 'background:#2D5BE3; color:#fff; box-shadow:0 2px 8px rgba(45,91,227,0.3);' },
        ]
      });
    },

    // ── Danger confirm (red) ──────────────────────────────
    danger(title, body='', confirmLabel='Delete') {
      return show({
        icon: '⚠️', title, body,
        buttons: [
          { label: 'Cancel',      value: false, style: 'background:#F1F5F9; color:#64748B;' },
          { label: confirmLabel,  value: true,  style: 'background:#FF4757; color:#fff; box-shadow:0 2px 8px rgba(255,71,87,0.3);' },
        ]
      });
    },

    // ── Alert / info ──────────────────────────────────────
    alert(title, body='', icon='ℹ️') {
      return show({
        icon, title, body,
        buttons: [
          { label: 'OK', value: true, style: 'background:#2D5BE3; color:#fff;' }
        ]
      });
    },

    // ── Success ───────────────────────────────────────────
    success(title, body='') {
      return show({
        icon: '✅', title, body,
        buttons: [
          { label: 'Great!', value: true, style: 'background:#00C9A7; color:#fff;' }
        ]
      });
    },

    // ── Prompt (with textarea) ────────────────────────────
    prompt(title, body='', placeholder='', defaultValue='') {
      return show({
        icon: '✏️', title, body,
        showInput: true,
        inputPlaceholder: placeholder,
        inputValue: defaultValue,
        buttons: [
          { label: 'Cancel', value: null,    style: 'background:#F1F5F9; color:#64748B;' },
          { label: 'Submit', value: 'input', style: 'background:#2D5BE3; color:#fff;' },
        ]
      });
    },

    // ── Warning ───────────────────────────────────────────
    warning(title, body='', confirmLabel='OK') {
      return show({
        icon: '⚠️', title, body,
        buttons: [
          { label: 'Cancel',      value: false, style: 'background:#F1F5F9; color:#64748B;' },
          { label: confirmLabel,  value: true,  style: 'background:#FFB830; color:#fff;' },
        ]
      });
    },

    // ── Raw (full control) ────────────────────────────────
    custom(options) { return show(options); }
  };
})();

// Make globally available
window.Modal = Modal;
export default Modal;
export { Modal };
