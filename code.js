figma.showUI(__html__, { width: 460, height: 660, title: "Content Tool", themeColors: true });

function collectTextNodes() {
  const results = [];
  function walk(node) {
    if (node.type === 'TEXT') {
      results.push({ id: node.id, name: node.name, text: node.characters });
    }
    if ('children' in node) node.children.forEach(walk);
  }
  figma.currentPage.children.forEach(walk);
  return results;
}

async function init() {
  const rulesUrl    = await figma.clientStorage.getAsync('rulesUrl')    || '';
  const cachedRules = await figma.clientStorage.getAsync('cachedRules') || null;
  figma.ui.postMessage({ type: 'init', rulesUrl, cachedRules });
}

figma.on('documentchange', (event) => {
  const textChanges = event.documentChanges.filter(
    c => c.type === 'PROPERTY_CHANGE' && c.node && c.node.type === 'TEXT'
  );
  if (textChanges.length) {
    figma.ui.postMessage({
      type: 'live-update',
      nodes: textChanges.map(c => ({ id: c.node.id, name: c.node.name, text: c.node.characters }))
    });
  }
});

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'scan-page':
      figma.ui.postMessage({ type: 'scan-results', nodes: collectTextNodes() });
      break;
    case 'save-url':
      await figma.clientStorage.setAsync('rulesUrl', msg.url);
      break;
    case 'cache-rules':
      await figma.clientStorage.setAsync('cachedRules', msg.rules);
      break;
    case 'focus-node':
      try {
        const node = await figma.getNodeByIdAsync(msg.id);
        if (node) {
          figma.currentPage.selection = [node];
          figma.viewport.scrollAndZoomIntoView([node]);
        }
      } catch(e) {}
      break;
    case 'close':
      figma.closePlugin();
      break;
  }
};

init();
