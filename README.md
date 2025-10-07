# Joblet Admin

Web-based admin interface for [Joblet](https://github.com/ehsaniara/joblet) job orchestration system.

## Quick Start

```bash
# Install
npm install

# Start server (opens at http://localhost:5175)
npm run dev
```

## Features

- 📊 **Dashboard** - Real-time system metrics and job overview
- 🔧 **Job Management** - Create, monitor, stop, and delete jobs
- 🔄 **Workflows** - Visual workflow orchestration with YAML support
- 💾 **Resources** - Manage volumes, networks, and runtimes
- 📈 **Monitoring** - Live system metrics with CPU, memory, disk, and network stats
- 📝 **Real-time Logs** - Stream job logs via WebSocket

## Installation

### From Release

Download from [releases](https://github.com/ehsaniara/joblet-admin/releases):

```bash
tar -xzf joblet-admin-v1.0.0.tar.gz
cd dist-package
npm install --production
npm start
```

### From Source

```bash
git clone https://github.com/ehsaniara/joblet-admin.git
cd joblet-admin
npm install
npm run dev
```

## Configuration

Set environment variables or create `~/.rnx/rnx-config.yml`:

```bash
# Server settings
JOBLET_ADMIN_PORT=5175        # Admin UI port (default: 5175)
JOBLET_ADMIN_HOST=localhost   # Admin UI host (default: localhost)

# Joblet server connection
JOBLET_SERVER_HOST=localhost  # Joblet server host (default: localhost)
JOBLET_SERVER_PORT=50051      # Joblet gRPC port (default: 50051)
JOBLET_NODE=default           # Node to connect to (default: default)
```

## Usage

### Start Server

```bash
npm run dev          # Development mode with hot reload
npm start            # Production mode
./bin/joblet-admin   # Using CLI
```

Then open http://localhost:5175 in your browser.

### Create a Job

1. Go to **Jobs** page → **Create Job**
2. Fill in job details (command, runtime, resources)
3. Click **Execute Job**

### Run a Workflow

1. Go to **Workflows** page → **Execute New Workflow**
2. Browse and select a workflow YAML file
3. View real-time execution with visual graph

Example workflows are in [`examples/workflows/`](examples/workflows/).

## Architecture

```
Browser ←→ joblet-admin (HTTP/WebSocket) ←→ Joblet Server (gRPC)
```

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + gRPC client
- **Real-time**: WebSocket for logs and metrics

## Development

### Running Tests

The test suite includes comprehensive coverage of all gRPC service implementations. When the proto file changes, the tests automatically catch any breaking changes or missing methods.

```bash
# Run all tests
npm test

# Run tests in watch mode (great for development)
npm test -- --watch

# Run a specific test file
npm test -- src/grpc/client.test.ts

# Generate coverage report
npm test -- --coverage
```

**What's tested:**
- All 5 gRPC services (Job, Network, Volume, Monitoring, Runtime)
- 32 RPC methods across all services
- Proto file compatibility and method signatures

### Using the Makefile

A Makefile is included for convenient task automation:

```bash
# Install dependencies
make install

# Start development server
make dev

# Build for production
make build

# Run tests
make test

# Clean build artifacts
make clean

# Full build cycle (clean, install, test, and build)
make all
```

Run `make help` to see all available commands.

### Project Structure

```
├── src/
│   ├── grpc/           # gRPC client and proto handling
│   ├── server/         # Express.js API server
│   └── ui/             # React frontend
├── proto/              # Protocol buffer definitions
├── examples/           # Example workflows
├── .github/workflows/  # CI/CD pipelines
├── Makefile           # Build automation
└── vitest.config.ts   # Test configuration
```

## License

MIT
