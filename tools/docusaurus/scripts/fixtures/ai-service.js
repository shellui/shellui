/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  aiSidebar: [
    {type: 'doc', id: 'index', label: 'Overview'},
    {type: 'doc', id: 'getting-started', label: 'Getting started'},
    {type: 'doc', id: 'devstack', label: 'Local dev stack'},
    {type: 'doc', id: 'configuration', label: 'Configuration'},
    {type: 'doc', id: 'mcp', label: 'MCP gateway'},
    {type: 'doc', id: 'mcp-device-login', label: 'Device login'},
  ],
};

module.exports = sidebars;
