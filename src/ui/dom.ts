type Attrs = Record<string, string | boolean | ((event: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') node.addEventListener(key.replace(/^on/, ''), value);
    else if (typeof value === 'boolean') node.toggleAttribute(key, value);
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}
