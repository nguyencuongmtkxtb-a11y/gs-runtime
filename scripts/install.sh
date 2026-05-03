# GS Runtime - Unix Install Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "\033[36m[gs] Installing GS Runtime...\033[0m"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "\033[31m[gs] ERROR: Node.js >= 18 is required\033[0m"
    exit 1
fi
echo -e "\033[32m[gs] Node.js detected: $(node --version)\033[0m"

# Install dependencies
echo -e "\033[36m[gs] Installing dependencies...\033[0m"
cd "$REPO_ROOT"
npm install

# Build
echo -e "\033[36m[gs] Building...\033[0m"
npm run build

# Link globally
echo -e "\033[36m[gs] Linking globally...\033[0m"
npm link

# Configure OpenCode
OP_ENCODE_CONFIG_DIR="${HOME}/.config/opencode"
OP_ENCODE_CONFIG_FILE="${OP_ENCODE_CONFIG_DIR}/config.json"
mkdir -p "$OP_ENCODE_CONFIG_DIR"

if [ -f "$OP_ENCODE_CONFIG_FILE" ]; then
    # Use node to merge JSON
    node -e "
        const fs = require('fs');
        let config = {};
        try { config = JSON.parse(fs.readFileSync('$OP_ENCODE_CONFIG_FILE', 'utf-8')); } catch(e) {}
        if (!config.mcp) config.mcp = {};
        config.mcp.gs = { type: 'local', command: ['gs', 'mcp-start'] };
        fs.writeFileSync('$OP_ENCODE_CONFIG_FILE', JSON.stringify(config, null, 2));
    "
else
    echo '{"mcp":{"gs":{"type":"local","command":["gs","mcp-start"]}}}' > "$OP_ENCODE_CONFIG_FILE"
fi
echo -e "\033[32m[gs] OpenCode MCP config written to: $OP_ENCODE_CONFIG_FILE\033[0m"

# Check GitNexus
if command -v gitnexus &> /dev/null; then
    echo -e "\033[32m[gs] GitNexus detected\033[0m"
else
    echo -e "\033[33m[gs] WARN: GitNexus not found. Graph features disabled.\033[0m"
    echo -e "\033[33m[gs] Install with: npm install -g gitnexus\033[0m"
fi

echo ""
echo -e "\033[36m[gs] ==========================================\033[0m"
echo -e "\033[32m[gs] Installation complete!\033[0m"
echo -e "\033[0m[gs] Next steps:\033[0m"
echo -e "\033[0m[gs]   cd your-project\033[0m"
echo -e "\033[0m[gs]   gs init\033[0m"
echo -e "\033[0m[gs]   gs agents-md\033[0m"
echo -e "\033[0m[gs]   gs brainstorm 'your feature'\033[0m"
echo -e "\033[36m[gs] ==========================================\033[0m"
