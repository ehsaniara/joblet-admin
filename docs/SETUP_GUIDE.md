# Joblet Admin UI Setup Guide

This guide walks you through setting up and running the Joblet Admin web interface. We'll assume you already have your Joblet server configured with the `~/.rnx/rnx-config.yml` file.

## Prerequisites

Before you begin, make sure you have the following installed on your system:

- **Node.js** version 18.0.0 or higher
- **npm** (comes with Node.js)
- A running **Joblet server** instance
- Your **Joblet configuration file** at `~/.rnx/rnx-config.yml`

You can verify your Node.js version by running:

```bash
node --version
```

## Installation Options

You have two ways to get started with Joblet Admin: using a pre-built release or building from source.

### Option 1: Using a Pre-built Release (Recommended)

This is the quickest way to get up and running.

1. **Download the latest release** from the [releases page](https://github.com/ehsaniara/joblet-admin/releases)

2. **Extract the package:**

   ```bash
   tar -xzf joblet-admin-v1.0.0.tar.gz
   cd dist-package
   ```

3. **Install production dependencies:**

   ```bash
   npm install --production
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

That's it! The admin UI will start and automatically connect to your Joblet server.

### Option 2: Building from Source

If you want the latest features or plan to contribute, you can build from source.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ehsaniara/joblet-admin.git
   cd joblet-admin
   ```

2. **Install all dependencies:**

   ```bash
   npm install
   ```

3. **Start in development mode** (with hot reload):

   ```bash
   npm run dev
   ```

   Or **build for production** and run:

   ```bash
   npm run build
   npm start
   ```

## Configuration

The admin UI will automatically read your Joblet configuration from `~/.rnx/rnx-config.yml`. Here's what a typical configuration looks like:

```yaml
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: ""
    key: ""
    ca: ""

  production:
    address: "joblet.example.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ...
      -----END CERTIFICATE-----
```

### Configuration Explained

- **version**: Configuration file version (use "3.0")
- **nodes**: A map of Joblet server instances you can connect to
  - **address**: The gRPC endpoint of your Joblet server (host:port)
  - **cert**: Client certificate for mTLS (optional, leave empty for insecure connections)
  - **key**: Client private key for mTLS (optional)
  - **ca**: Certificate Authority for verifying server (optional)

### Optional Environment Variables

You can override the default admin UI settings using environment variables:

```bash
# Change the admin UI port (default: 5175)
export JOBLET_ADMIN_PORT=8080

# Change the admin UI host (default: localhost)
export JOBLET_ADMIN_HOST=0.0.0.0

# Specify a different config file location
export JOBLET_CONFIG_PATH=/path/to/custom-config.yml
```

## Running the Admin UI

### Starting the Server

Once configured, start the admin UI server:

**Development mode** (with hot reload for UI changes):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

You should see output similar to:

```
🚀 Joblet Admin Server running at http://localhost:5175
📡 API endpoints available at /api/*
🔍 Health check at /health
🧪 gRPC test at /api/test
🔗 WebSocket available at ws://localhost:5175/ws
```

### Accessing the Interface

Open your web browser and navigate to:

```
http://localhost:5175
```

If you changed the port or host, adjust the URL accordingly.

### Verifying the Connection

The admin UI should automatically connect to your Joblet server. You can verify the connection by:

1. **Opening the Dashboard** - You should see system metrics and job counts
2. **Checking the health endpoint** - Visit `http://localhost:5175/health` in your browser
3. **Testing the gRPC connection** - Visit `http://localhost:5175/api/test`

A successful gRPC test will return:

```json
{
  "status": "connected",
  "grpc": "ok",
  "jobCount": 0
}
```

## Using Multiple Nodes

If you have multiple Joblet servers configured in your `rnx-config.yml`, you can switch between them using the node selector in the admin UI:

1. Look for the **node selector dropdown** in the top navigation bar
2. Select the node you want to manage
3. The UI will automatically reconnect to the selected node

## Development Workflow

If you're developing or customizing the admin UI, here's a helpful workflow:

### Running in Development Mode

```bash
npm run dev
```

This starts two processes:
- **Backend server** on port 5175 (with auto-restart on changes)
- **Frontend dev server** on port 3000 (with hot module reload)

The frontend automatically proxies API requests to the backend.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (great for development)
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage
```

### Type Checking

```bash
npm run type-check
```

### Code Formatting

```bash
# Check formatting
npm run format:check

# Auto-fix formatting issues
npm run format
```

## Troubleshooting

### Admin UI Won't Start

**Problem**: Server fails to start or exits immediately

**Solutions**:
- Verify Node.js version: `node --version` (must be 18.0.0 or higher)
- Check if port 5175 is already in use: `lsof -i :5175`
- Review error messages in the console
- Try a different port: `JOBLET_ADMIN_PORT=8080 npm start`

### Cannot Connect to Joblet Server

**Problem**: Admin UI starts but shows connection errors

**Solutions**:

1. **Verify your config file exists:**
   ```bash
   cat ~/.rnx/rnx-config.yml
   ```

2. **Check if Joblet server is running:**
   ```bash
   # Test if the gRPC port is accessible
   nc -zv localhost 50051
   ```

3. **Test the gRPC connection:**
   ```bash
   curl http://localhost:5175/api/test
   ```

4. **Check for certificate issues** (if using mTLS):
   - Ensure cert, key, and ca are properly formatted in the YAML
   - Verify certificates haven't expired
   - Check file permissions if using file paths

### Logs Not Streaming

**Problem**: Job logs aren't showing in real-time

**Solutions**:
- Check browser console for WebSocket errors (F12 → Console tab)
- Verify the job is actually running and producing output
- Check firewall settings aren't blocking WebSocket connections
- Try refreshing the page

### Metrics Not Updating

**Problem**: System metrics appear stale or not updating

**Solutions**:
- Ensure the Joblet server's monitoring service is enabled
- Check the WebSocket connection status indicator (should show green/connected)
- Verify no proxy or firewall is interfering with WebSocket connections
- Check browser console for errors

## Security Considerations

### Running in Production

If you're deploying the admin UI in a production environment:

1. **Use mTLS** for secure communication with the Joblet server
2. **Run behind a reverse proxy** (nginx, Apache) for HTTPS
3. **Restrict network access** to the admin UI port
4. **Use strong authentication** at the proxy level
5. **Keep dependencies updated**: `npm audit` and `npm update`

### Exposing to Network

By default, the admin UI binds to `localhost` only. To make it accessible on your network:

```bash
JOBLET_ADMIN_HOST=0.0.0.0 npm start
```

**Warning**: Only do this on trusted networks or behind proper authentication/firewall.

## Next Steps

Now that you have the admin UI running, you can:

- **Explore the Dashboard** to see system metrics and job overview
- **Create and run jobs** using the job builder
- **Execute workflows** from YAML files
- **Manage resources** like volumes, networks, and runtimes
- **Monitor system health** in real-time

For more information, check out:
- [Joblet Documentation](https://github.com/ehsaniara/joblet)
- [Admin UI Features](../README.md#features)
- [Real-time System Architecture](../REALTIME-SYSTEM.md)

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/ehsaniara/joblet-admin/issues)
2. Review the [Joblet server logs](https://github.com/ehsaniara/joblet)
3. Open a new issue with:
   - Your Node.js version
   - Operating system details
   - Error messages or logs
   - Steps to reproduce the problem

Happy job orchestration! 🚀
