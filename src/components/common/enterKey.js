/* Enter does what a form's Enter does (2026-11-23, the owner: "엔터를 눌러도 될 것 같은데 굳이굳이 커서로 클릭해야 하는 항목들이 많음").
   The site has no <form>, so one listener stands in for it: Enter in a one-line field inside a sheet, or inside a page form marked
   data-enter, presses that place's main key (its .btn--main), unless the field handled Enter itself. In a many-line field Enter stays a
   new line and Ctrl or ⌘ with Enter presses the key. A Korean word still being composed is never sent half-made. */
const TEXT = /^(text|search|email|password|url|tel|number|)$/;

function mainKey(scope) {
  const keys = [...scope.querySelectorAll(".btn--main")].filter(b => !b.disabled && b.getAttribute("aria-disabled") !== "true" && b.offsetParent !== null);
  return keys.find(b => b.closest(".modal-actions")) || keys[0] || null;
}

export function watchEnter() {
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    const el = e.target;
    const many = el instanceof HTMLTextAreaElement;
    const one = el instanceof HTMLInputElement && TEXT.test(el.type);
    if (!(one || (many && (e.ctrlKey || e.metaKey)))) return;
    // a search filters what is under it; its Enter is its own (a picker takes the first row), never the place's main key
    if (el.type === "search" || el.closest("[data-enter='off'], .search, .tb-search-row")) return;
    const scope = el.closest(".sheet, [data-enter]");
    if (!scope) return;
    const key = mainKey(scope);
    if (!key) return;
    e.preventDefault();
    key.click();
  });
}
