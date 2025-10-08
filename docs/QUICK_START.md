# Quick Start Guide

Get up and running with Joblet Admin in under 5 minutes.

## Prerequisites Check

Make sure you have:
- ✅ Node.js 18+ installed (`node --version`)
- ✅ Joblet server running
- ✅ Config file at `~/.rnx/rnx-config.yml`

## Installation & Startup

### For End Users (Pre-built Release)

```bash
# Download and extract
tar -xzf joblet-admin-v1.0.0.tar.gz
cd dist-package

# Install and run
npm install --production
npm start
```

### For Developers (From Source)

```bash
# Clone and install
git clone https://github.com/ehsaniara/joblet-admin.git
cd joblet-admin
npm install

# Start development server
npm run dev
```

## Access the UI

Open your browser to:

```
http://localhost:5175
```

## Verify Connection

Check if everything's working:

```bash
# Health check
curl http://localhost:5175/health

# gRPC connection test
curl http://localhost:5175/api/test
```

You should see:
```json
{
  "status": "connected",
  "grpc": "ok",
  "jobCount": 0
}
```

## Common Commands

### Development

```bash
npm run dev          # Start with hot reload
npm test             # Run tests
npm run type-check   # TypeScript check
npm run format       # Format code
```

### Production

```bash
npm run build        # Build for production
npm start            # Run production server
```

### Using Make

```bash
make dev            # Start development
make build          # Build project
make test           # Run tests
make all            # Full build cycle
```

## Configuration Tips

### Change Port

```bash
JOBLET_ADMIN_PORT=8080 npm start
```

### Use Different Config

```bash
JOBLET_CONFIG_PATH=/path/to/config.yml npm start
```

### Allow Network Access

```bash
JOBLET_ADMIN_HOST=0.0.0.0 npm start
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | Change port: `JOBLET_ADMIN_PORT=8080 npm start` |
| Can't connect to Joblet | Verify server is running: `nc -zv localhost 50051` |
| Node version error | Upgrade to Node 18+: `nvm install 18` |
| Config not found | Check: `cat ~/.rnx/rnx-config.yml` |

## Next Steps

Once running, you can:

1. **View Dashboard** - See system metrics at a glance
2. **Create Jobs** - Go to Jobs → Create Job
3. **Run Workflows** - Go to Workflows → Execute New Workflow
4. **Monitor System** - Check the Monitoring page
5. **Manage Resources** - View Volumes, Networks, and Runtimes

## Need More Help?

- 📖 [Full Setup Guide](./SETUP_GUIDE.md)
- 🏗️ [Architecture Overview](../REALTIME-SYSTEM.md)
- 📝 [Main README](../README.md)
- 🐛 [Report Issues](https://github.com/ehsaniara/joblet-admin/issues)
