figma.showUI(__html__, { width: 460, height: 680, title: "Content Tool", themeColors: true });

function collectTextNodes() {
  var results = [];
  function walk(node) {
    if (node.type === 'TEXT') {
      results.push({ id: node.id, name: node.name, text: node.characters });
    }
    if ('children' in node) {
      for (var i = 0; i < node.children.length; i++) walk(node.children[i]);
    }
  }
  for (var i = 0; i < figma.currentPage.children.length; i++) {
    walk(figma.currentPage.children[i]);
  }
  return results;
}

async function init() {
  var apiUrl     = await figma.clientStorage.getAsync('apiUrl')     || '';
  var writeSecret = await figma.clientStorage.getAsync('writeSecret') || '';
  figma.ui.postMessage({ type: 'init', apiUrl: apiUrl, writeSecret: writeSecret });
}

figma.on('documentchange', function(event) {
  var textChanges = [];
  for (var i = 0; i < event.documentChanges.length; i++) {
    var c = event.documentChanges[i];
    if (c.type === 'PROPERTY_CHANGE' && c.node && c.node.type === 'TEXT') {
      textChanges.push({ id: c.node.id, name: c.node.name, text: c.node.characters });
    }
  }
  if (textChanges.length) {
    figma.ui.postMessage({ type: 'live-update', nodes: textChanges });
  }
});

figma.ui.onmessage = async function(msg) {
  if (msg.type === 'scan-page') {
    figma.ui.postMessage({ type: 'scan-results', nodes: collectTextNodes() });
  } else if (msg.type === 'save-settings') {
    await figma.clientStorage.setAsync('apiUrl', msg.apiUrl);
    await figma.clientStorage.setAsync('writeSecret', msg.writeSecret);
    figma.ui.postMessage({ type: 'settings-saved' });
  } else if (msg.type === 'focus-node') {
    try {
      var node = await figma.getNodeByIdAsync(msg.id);
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    } catch(e) {}
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

init();
