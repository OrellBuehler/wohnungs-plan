# MCP Integration Guide

## Overview

The Wohnungs-Plan MCP (Model Context Protocol) server enables Claude to interact directly with your floor plan projects. Through this integration, Claude can:

- List and browse your projects
- Add furniture items to your floor plans
- Query project details and room configurations

This integration is designed for personal use and requires OAuth authentication to ensure secure access to your data.

## Setup Instructions

### Step 1: Get Your Credentials

1. **Generate OAuth Token**
   - Navigate to the Settings page in Wohnungs-Plan
   - Go to the "MCP Integration" section
   - Click "Generate Token"
   - Your Client ID and Client Secret will be displayed
   - **Important**: Copy both values immediately - the Client Secret will not be shown again

2. **Save Your Credentials**
   - Store these credentials securely
   - You'll need them for the next step

### Step 2: Configure Claude Desktop

1. **Locate Your Configuration File**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the MCP Server**

   Edit the configuration file to include:

   ```json
   {
     "mcpServers": {
       "wohnungs-plan": {
         "command": "npx",
         "args": [
           "-y",
           "@orell/wohnungs-plan-mcp-server"
         ],
         "env": {
           "WOHNUNGS_PLAN_CLIENT_ID": "your-client-id-here",
           "WOHNUNGS_PLAN_CLIENT_SECRET": "your-client-secret-here",
           "WOHNUNGS_PLAN_API_URL": "https://your-domain.com"
         }
       }
     }
   }
   ```

3. **Update the Configuration**
   - Replace `your-client-id-here` with your Client ID
   - Replace `your-client-secret-here` with your Client Secret
   - Replace `https://your-domain.com` with your Wohnungs-Plan instance URL
   - If running locally, use `http://localhost:5173`

4. **Restart Claude Desktop**
   - Completely quit and restart the Claude Desktop application
   - The MCP server will initialize on startup

### Step 3: Start Using

Once configured, you can ask Claude to interact with your floor plans:

**Example prompts:**
- "List my floor plan projects"
- "Add a sofa to the living room in my apartment project"
- "Show me the details of my project called 'New House'"
- "Add a dining table (180x90cm) to project X"

## Available Tools

### `list_projects`

Lists all projects accessible to the authenticated user.

**Usage:**
```
"Show me all my projects"
"What floor plans do I have?"
```

**Returns:**
- Project ID
- Project name
- Creation date
- Last modified date
- Number of items

### `add_furniture_item`

Adds a new furniture item to a specified project.

**Usage:**
```
"Add a bed (200x160cm) to my bedroom project"
"Create a desk in project ABC123"
```

**Parameters:**
- `projectId` - The ID of the target project
- `name` - Name of the furniture item
- `width` - Width in centimeters
- `height` - Height in centimeters
- `x` - X position (optional, defaults to center)
- `y` - Y position (optional, defaults to center)
- `rotation` - Rotation angle in degrees (optional, defaults to 0)
- `color` - Hex color code (optional, defaults to #3b82f6)

**Returns:**
- Created item details including assigned ID

## Security Notes

### Token Security

- **Client Secrets are sensitive**: Treat them like passwords
- **Rotate regularly**: Generate new tokens periodically from Settings
- **Revoke if compromised**: Delete tokens immediately if exposed
- **Single use per client**: Each token pair should only be used in one place

### Access Scope

- MCP tokens have **full access** to your projects
- They can create, read, and potentially modify data
- Only share credentials with trusted applications
- Never commit credentials to version control

### Token Management

**To revoke access:**
1. Go to Settings → MCP Integration
2. Find the token in the list
3. Click "Delete"
4. The token will be immediately invalidated

**Token lifecycle:**
- Tokens do not expire automatically
- They remain valid until manually deleted
- You can have multiple active tokens
- Each token can be identified by its Client ID

## Troubleshooting

### Q: Claude says the MCP server isn't responding

**A:** Check the following:
1. Verify the configuration file syntax is valid JSON
2. Ensure you've restarted Claude Desktop after configuration
3. Check that your credentials are correct
4. Verify the API URL is accessible
5. Look for errors in Claude Desktop's logs

### Q: "Authentication failed" error

**A:** This usually means:
- Client ID or Secret is incorrect
- Token has been deleted/revoked
- API URL is wrong or unreachable

**Solution:**
1. Verify credentials in Settings → MCP Integration
2. Generate a new token if needed
3. Update the configuration file
4. Restart Claude Desktop

### Q: Can I use the same token in multiple places?

**A:** While technically possible, it's **not recommended**:
- Each client should have its own token for security
- Revoking a shared token affects all clients
- Separate tokens provide better audit trails

Instead, generate multiple tokens from Settings.

### Q: The API URL is different for local vs. production

**A:** You can maintain multiple configurations:
1. Use different MCP server names (e.g., `wohnungs-plan-local` and `wohnungs-plan-prod`)
2. Each with its own API URL and credentials
3. Tell Claude which one to use: "Using the local server, list my projects"

### Q: How do I know if the integration is working?

**A:** Ask Claude a simple question:
```
"List my Wohnungs-Plan projects"
```

If configured correctly, Claude will:
1. Connect to your instance
2. Authenticate with your token
3. Return your project list

If you see project data, it's working!

### Q: Can I use this with Claude on the web (claude.ai)?

**A:** No, the MCP protocol is currently only supported in Claude Desktop. Web-based Claude cannot connect to local MCP servers.

### Q: What data does Claude have access to?

**A:** With MCP integration, Claude can:
- Read all your projects and their items
- Create new furniture items
- Query project metadata

Claude **cannot**:
- Delete projects or items (not implemented)
- Modify user settings
- Access other users' data
- Share your data with Anthropic

All data flows directly between Claude Desktop and your Wohnungs-Plan instance.

## Support

For additional help:
- Check the main project documentation
- Review logs in Claude Desktop's developer console
- Verify API accessibility with `curl` or browser
- Ensure your instance is running and accessible

## Advanced: Self-Hosted Deployment

If you're self-hosting Wohnungs-Plan:

1. **Ensure HTTPS**: OAuth requires secure connections in production
2. **CORS Configuration**: The API should allow requests from your domain
3. **Firewall Rules**: Allow Claude Desktop to reach your instance
4. **DNS Setup**: Use a proper domain name rather than IP addresses

For local development:
- HTTP is acceptable for `localhost`
- No DNS required
- Use `http://localhost:5173` as the API URL
