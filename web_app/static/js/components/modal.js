/**
 * Modal 弹窗组件
 */
const Modal = {
  overlay: null,
  titleEl: null,
  bodyEl: null,
  footerEl: null,

  init() {
    this.overlay = document.getElementById('globalModal');
    this.titleEl = document.getElementById('modalTitle');
    this.bodyEl = document.getElementById('modalBody');
    this.footerEl = document.getElementById('modalFooter');
  },

  show(title, bodyHtml, footerHtml = '') {
    if (!this.overlay) this.init();
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = bodyHtml;
    this.footerEl.innerHTML = footerHtml || '<button class="btn" onclick="Modal.hide()">关闭</button>';
    this.overlay.style.display = 'flex';
  },

  hide() {
    if (this.overlay) this.overlay.style.display = 'none';
  },

  showConfirm(title, message, onConfirm) {
    this.show(
      title,
      `<p>${message}</p>`,
      `<button class="btn" onclick="Modal.hide()">取消</button>
       <button class="btn btn-danger" id="modalConfirmBtn">确认</button>`
    );
    document.getElementById('modalConfirmBtn').addEventListener('click', () => {
      this.hide();
      if (onConfirm) onConfirm();
    });
  },
};
