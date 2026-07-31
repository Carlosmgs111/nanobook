import { visit } from 'unist-util-visit';

/**
 * Transform remark-directive container nodes into HTML elements.
 *
 * Supported directives:
 *   :::details[Summary title]
 *   :::note[Title]
 *   :::warning[Title]
 *   :::tip[Title]
 *   :::info[Title]
 */
export default function remarkDirectives() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'containerDirective') return;

      const name = node.name;
      if (name === 'details') {
        transformDetails(node);
      } else if (['note', 'warning', 'tip', 'info'].includes(name)) {
        transformCallout(node, name);
      }
    });
  };
}

function transformDetails(node) {
  const data = node.data || (node.data = {});
  const children = node.children || [];
  const [summaryNode, ...contentNodes] = children;
  const summaryText = extractText(summaryNode) || 'Details';

  const summary = {
    type: 'paragraph',
    data: { hName: 'summary', hProperties: { class: 'md-details-summary' } },
    children: [{ type: 'text', value: summaryText }],
  };

  const contentWrapper = {
    type: 'element',
    data: { hName: 'div', hProperties: { class: 'md-details-content' } },
    children: contentNodes,
  };

  data.hName = 'details';
  data.hProperties = { class: 'md-details' };
  node.children = [summary, contentWrapper];
}

function transformCallout(node, type) {
  const data = node.data || (node.data = {});
  const children = node.children || [];
  const [titleNode, ...contentNodes] = children;
  const titleText = extractText(titleNode) || type.charAt(0).toUpperCase() + type.slice(1);

  const title = {
    type: 'paragraph',
    data: { hName: 'div', hProperties: { class: 'callout-title' } },
    children: [{ type: 'text', value: titleText }],
  };

  const contentWrapper = {
    type: 'element',
    data: { hName: 'div', hProperties: { class: 'callout-content' } },
    children: contentNodes,
  };

  data.hName = 'aside';
  data.hProperties = {
    class: `callout callout-${type}`,
    role: 'note',
    'data-callout': type,
  };
  node.children = [title, contentWrapper];
}

function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.children) return node.children.map(extractText).join('').trim();
  return '';
}
