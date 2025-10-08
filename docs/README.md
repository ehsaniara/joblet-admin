# Joblet Admin Documentation

Welcome to the Joblet Admin UI documentation! This directory contains comprehensive guides to help you set up, configure, and use the admin interface.

## 📚 Documentation Overview

### Getting Started

- **[Quick Start Guide](./QUICK_START.md)** - Get up and running in under 5 minutes
- **[Setup Guide](./SETUP_GUIDE.md)** - Detailed installation and setup instructions
- **[Configuration Guide](./CONFIGURATION.md)** - Complete configuration reference

### Architecture & Features

- **[Real-time System Architecture](../REALTIME-SYSTEM.md)** - How WebSocket streaming works
- **[Main README](../README.md)** - Project overview and features

## 🚀 Quick Navigation

### I want to...

**Install and run the admin UI**
→ Start with the [Quick Start Guide](./QUICK_START.md)

**Understand the configuration file**
→ Read the [Configuration Guide](./CONFIGURATION.md)

**Set up for production with mTLS**
→ See the [Setup Guide](./SETUP_GUIDE.md#security-considerations)

**Connect to multiple Joblet servers**
→ Check [Configuration - Multi-Node Setup](./CONFIGURATION.md#multi-node-setup)

**Troubleshoot connection issues**
→ Visit [Setup Guide - Troubleshooting](./SETUP_GUIDE.md#troubleshooting)

**Understand how real-time features work**
→ Review [Real-time System Architecture](../REALTIME-SYSTEM.md)

## 📋 Prerequisites

Before using the admin UI, you'll need:

1. **Node.js 18+** installed on your system
2. **A running Joblet server** instance
3. **Configuration file** at `~/.rnx/rnx-config.yml`

If you don't have the Joblet server set up yet, visit the [Joblet project](https://github.com/ehsaniara/joblet).

## 🎯 Common Tasks

### First Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/ehsaniara/joblet-admin.git
cd joblet-admin

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open browser
# Navigate to http://localhost:5175
```

See the [Quick Start Guide](./QUICK_START.md) for more details.

### Running in Development

```bash
npm run dev
```

This starts the development server with hot reload. See the [Setup Guide](./SETUP_GUIDE.md#development-workflow) for the full development workflow.

### Deploying to Production

```bash
# Build the project
npm run build

# Start production server
npm start
```

For production deployment best practices, see [Setup Guide - Security Considerations](./SETUP_GUIDE.md#security-considerations).

## 🔧 Configuration Examples

### Local Development

```yaml
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: ""
    key: ""
    ca: ""
```

### Production with mTLS

```yaml
version: "3.0"
nodes:
  production:
    address: "joblet.company.com:50051"
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

For complete configuration options, see the [Configuration Guide](./CONFIGURATION.md).

## 🛠️ Development

### Project Structure

```
joblet-admin/
├── src/
│   ├── grpc/          # gRPC client and proto handling
│   ├── server/        # Express.js API server
│   └── ui/            # React frontend
├── proto/             # Protocol buffer definitions
├── docs/              # Documentation (you are here)
├── examples/          # Example workflows
└── dist/              # Build output
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Available Scripts

```bash
npm run dev          # Development mode with hot reload
npm run build        # Build for production
npm start            # Run production server
npm test             # Run test suite
npm run type-check   # TypeScript type checking
npm run lint         # Lint code
npm run format       # Format code with Prettier
```

Or use the Makefile:

```bash
make dev            # Start development
make build          # Build project
make test           # Run tests
make all            # Full build cycle
```

## 🌟 Features

The Joblet Admin UI provides:

- **📊 Dashboard** - Real-time system metrics and job overview
- **🔧 Job Management** - Create, monitor, stop, and delete jobs
- **🔄 Workflow Orchestration** - Visual workflow graphs with YAML support
- **💾 Resource Management** - Manage volumes, networks, and runtimes
- **📈 System Monitoring** - Live CPU, memory, disk, and network stats
- **📝 Real-time Logs** - Stream job logs via WebSocket
- **🌐 Multi-language Support** - 6 languages supported

## 🔐 Security

### Best Practices

1. **Always use mTLS in production** - Never use insecure connections for production Joblet servers
2. **Protect your config file** - Set permissions: `chmod 600 ~/.rnx/rnx-config.yml`
3. **Run behind a reverse proxy** - Use nginx or Apache for HTTPS termination
4. **Restrict network access** - Use firewalls and VPNs
5. **Keep dependencies updated** - Run `npm audit` regularly

For detailed security guidance, see the [Setup Guide - Security Considerations](./SETUP_GUIDE.md#security-considerations).

## 🆘 Troubleshooting

### Quick Fixes

| Issue | Solution |
|-------|----------|
| Can't connect to Joblet | Verify server is running: `nc -zv localhost 50051` |
| Port already in use | Change port: `JOBLET_ADMIN_PORT=8080 npm start` |
| Config file not found | Check: `cat ~/.rnx/rnx-config.yml` |
| Certificate errors | Verify PEM format and indentation in YAML |
| Logs not streaming | Check WebSocket connection in browser console |

For detailed troubleshooting, see:
- [Setup Guide - Troubleshooting](./SETUP_GUIDE.md#troubleshooting)
- [Configuration Guide - Troubleshooting](./CONFIGURATION.md#troubleshooting-configuration-issues)

## 📖 Additional Resources

### Joblet Project

- [Joblet GitHub](https://github.com/ehsaniara/joblet) - Main Joblet orchestration system
- [Joblet Documentation](https://github.com/ehsaniara/joblet) - Server setup and configuration

### Admin UI

- [GitHub Repository](https://github.com/ehsaniara/joblet-admin)
- [Issue Tracker](https://github.com/ehsaniara/joblet-admin/issues)
- [Releases](https://github.com/ehsaniara/joblet-admin/releases)

## 🤝 Contributing

We welcome contributions! If you'd like to help improve the documentation:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For code contributions, see the [Setup Guide - Development Workflow](./SETUP_GUIDE.md#development-workflow).

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

## 💬 Getting Help

Need assistance?

1. **Check the documentation** - Start with the guides in this directory
2. **Search existing issues** - Someone may have already asked your question
3. **Open a new issue** - Include:
   - Node.js version (`node --version`)
   - Operating system
   - Error messages or logs
   - Steps to reproduce

We're here to help! 🚀
