# Configuration Guide

This guide explains how the Joblet Admin UI connects to your Joblet server and how to configure different connection scenarios.

## Configuration File Location

The admin UI reads its configuration from:

```
~/.rnx/rnx-config.yml
```

You can override this location using the environment variable:

```bash
export JOBLET_CONFIG_PATH=/custom/path/to/config.yml
```

## Basic Configuration

### Insecure Connection (Development)

For local development or testing environments without TLS:

```yaml
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: ""
    key: ""
    ca: ""
```

This configuration:
- Connects to a Joblet server on `localhost` port `50051`
- Uses an **insecure gRPC connection** (no encryption)
- Is suitable for development environments only

### Secure Connection with mTLS (Production)

For production environments with mutual TLS authentication:

```yaml
version: "3.0"
nodes:
  production:
    address: "joblet.example.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      MIIDXTCCAkWgAwIBAgIJAKL0UG+... (your client certificate)
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      MIIEvQIBADANBgkqhkiG9w0BAQEF... (your private key)
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      MIIDXTCCAkWgAwIBAgIJAKL0UG+... (your CA certificate)
      -----END CERTIFICATE-----
```

This configuration:
- Connects to a remote Joblet server with **mTLS encryption**
- Authenticates the client using a certificate
- Verifies the server's certificate against the CA

## Multi-Node Setup

You can configure multiple Joblet servers and switch between them in the admin UI:

```yaml
version: "3.0"
nodes:
  local:
    address: "localhost:50051"
    cert: ""
    key: ""
    ca: ""

  staging:
    address: "staging.joblet.example.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ... staging client cert ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ... staging private key ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ... staging CA cert ...
      -----END CERTIFICATE-----

  production:
    address: "prod.joblet.example.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ... production client cert ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ... production private key ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ... production CA cert ...
      -----END CERTIFICATE-----
```

With this setup:
- The admin UI will show a **node selector dropdown**
- You can switch between `local`, `staging`, and `production`
- Each node can have different security configurations

## Configuration Fields Explained

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| `version` | Config file format version | Yes | `"3.0"` |
| `nodes` | Map of named Joblet server instances | Yes | See below |
| `address` | Joblet server gRPC endpoint | Yes | `"localhost:50051"` |
| `cert` | Client certificate (PEM format) | No | Leave empty for insecure |
| `key` | Client private key (PEM format) | No | Leave empty for insecure |
| `ca` | Certificate Authority (PEM format) | No | Leave empty for insecure |

### Address Format

The `address` field should be in the format:

```
hostname:port
```

Examples:
- `localhost:50051` - Local server
- `192.168.1.100:50051` - Server on local network
- `joblet.example.com:50051` - Remote server with domain name
- `10.0.0.5:443` - Custom port

### Certificate Format

Certificates must be in **PEM format** and embedded directly in the YAML using the pipe (`|`) character for multi-line strings:

```yaml
cert: |
  -----BEGIN CERTIFICATE-----
  MIIDXTCCAkWgAwIBAgIJAKL0UG+...
  ...
  -----END CERTIFICATE-----
```

**Important**:
- Include the `BEGIN` and `END` markers
- Maintain proper indentation (2 spaces after the pipe)
- Don't add extra quotes or escaping

## Admin UI Environment Variables

You can customize the admin UI behavior with these environment variables:

### Server Configuration

```bash
# Port the admin UI listens on (default: 5175)
export JOBLET_ADMIN_PORT=8080

# Host the admin UI binds to (default: localhost)
export JOBLET_ADMIN_HOST=0.0.0.0

# Config file path (default: ~/.rnx/rnx-config.yml)
export JOBLET_CONFIG_PATH=/etc/joblet/config.yml
```

### Connection Overrides

These environment variables can override values from the config file:

```bash
# Override the Joblet server address
export JOBLET_SERVER_HOST=joblet.example.com
export JOBLET_SERVER_PORT=50051

# Specify which node to connect to (from rnx-config.yml)
export JOBLET_NODE=production
```

## Example Configurations

### Example 1: Single Local Server

**Use case**: Development on your laptop

```yaml
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: ""
    key: ""
    ca: ""
```

Start admin UI:
```bash
npm start
```

### Example 2: Remote Server with mTLS

**Use case**: Connecting to a production Joblet cluster

```yaml
version: "3.0"
nodes:
  prod-cluster:
    address: "joblet-prod.company.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      MIIDXTCCAkWgAwIBAgIJAKL0UG+v8VjYMA0GCSqGSIb3DQEB...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIB...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      MIIDXTCCAkWgAwIBAgIJAKL0UG+v8VjYMA0GCSqGSIb3DQEB...
      -----END CERTIFICATE-----
```

Start admin UI and specify the node:
```bash
JOBLET_NODE=prod-cluster npm start
```

### Example 3: Multiple Data Centers

**Use case**: Managing Joblet clusters across different regions

```yaml
version: "3.0"
nodes:
  us-east:
    address: "joblet-us-east.company.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ... US East client cert ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ... US East private key ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ... US East CA ...
      -----END CERTIFICATE-----

  eu-west:
    address: "joblet-eu-west.company.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ... EU West client cert ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ... EU West private key ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ... EU West CA ...
      -----END CERTIFICATE-----

  ap-south:
    address: "joblet-ap-south.company.com:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ... AP South client cert ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ... AP South private key ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ... AP South CA ...
      -----END CERTIFICATE-----
```

Use the node selector in the UI to switch between regions.

## Security Best Practices

### 1. Use mTLS in Production

Always use mutual TLS authentication for production environments:

```yaml
nodes:
  production:
    address: "prod.example.com:50051"
    cert: |
      ... client certificate ...
    key: |
      ... private key ...
    ca: |
      ... CA certificate ...
```

### 2. Protect Your Config File

Set appropriate file permissions:

```bash
chmod 600 ~/.rnx/rnx-config.yml
```

This ensures only you can read the file containing certificates.

### 3. Use Environment Variables for Sensitive Data

For extra security, you can use environment variables instead of embedding certificates:

```bash
export JOBLET_CLIENT_CERT=$(cat /path/to/client.crt)
export JOBLET_CLIENT_KEY=$(cat /path/to/client.key)
export JOBLET_CA_CERT=$(cat /path/to/ca.crt)
```

Then reference them in scripts (admin UI doesn't directly support this, but you can modify the config dynamically).

### 4. Rotate Certificates Regularly

Set up certificate rotation:
- Use certificates with reasonable expiration dates (e.g., 90 days)
- Automate certificate renewal
- Update the config file when certificates are rotated

### 5. Restrict Network Access

Even with mTLS:
- Run the admin UI behind a firewall
- Use VPN for remote access
- Consider running it on a bastion host

## Troubleshooting Configuration Issues

### Config File Not Found

**Error**: `Failed to load config from /Users/you/.rnx/rnx-config.yml`

**Solution**:
```bash
# Check if file exists
ls -la ~/.rnx/rnx-config.yml

# Create directory if needed
mkdir -p ~/.rnx

# Create or copy config file
cat > ~/.rnx/rnx-config.yml << 'EOF'
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: ""
    key: ""
    ca: ""
EOF
```

### Certificate Errors

**Error**: `Error creating SSL credentials`

**Common causes**:
1. **Malformed PEM format** - Ensure proper formatting with BEGIN/END markers
2. **Wrong indentation** - YAML is sensitive to indentation
3. **Encoded certificates** - Use plain PEM, not base64-encoded separately
4. **Missing newlines** - Each line should end with a newline

**Solution**: Verify certificate format:
```bash
# Test certificate validity
openssl x509 -in client.crt -text -noout

# Test private key validity
openssl rsa -in client.key -check
```

### Connection Refused

**Error**: `gRPC connection test failed` or `UNAVAILABLE`

**Solutions**:
1. **Check if Joblet server is running**:
   ```bash
   nc -zv localhost 50051
   ```

2. **Verify the address in config**:
   ```bash
   cat ~/.rnx/rnx-config.yml | grep address
   ```

3. **Test with insecure connection first** to isolate certificate issues

### Wrong Node

**Error**: Connecting to the wrong Joblet server

**Solution**: Specify the node explicitly:
```bash
JOBLET_NODE=production npm start
```

Or check the config file for the correct node name:
```bash
cat ~/.rnx/rnx-config.yml | grep -A 5 "nodes:"
```

## Configuration Migration

If you're upgrading from an older version, you may need to migrate your config.

### From Version 2.0 to 3.0

Version 3.0 uses embedded certificates instead of file paths:

**Old format (v2.0)**:
```yaml
version: "2.0"
nodes:
  default:
    address: "localhost:50051"
    certFile: "/path/to/client.crt"
    keyFile: "/path/to/client.key"
    caFile: "/path/to/ca.crt"
```

**New format (v3.0)**:
```yaml
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: |
      -----BEGIN CERTIFICATE-----
      ... contents of client.crt ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ... contents of client.key ...
      -----END PRIVATE KEY-----
    ca: |
      -----BEGIN CERTIFICATE-----
      ... contents of ca.crt ...
      -----END CERTIFICATE-----
```

**Migration script**:
```bash
#!/bin/bash
# Embed certificates into config

CERT=$(cat /path/to/client.crt)
KEY=$(cat /path/to/client.key)
CA=$(cat /path/to/ca.crt)

cat > ~/.rnx/rnx-config.yml << EOF
version: "3.0"
nodes:
  default:
    address: "localhost:50051"
    cert: |
$(echo "$CERT" | sed 's/^/      /')
    key: |
$(echo "$KEY" | sed 's/^/      /')
    ca: |
$(echo "$CA" | sed 's/^/      /')
EOF
```

## Getting Help

If you're still having configuration issues:

1. Check the admin UI logs for detailed error messages
2. Test your Joblet server connection manually with `grpcurl`
3. Verify your certificates with `openssl` commands
4. Review the [setup guide](./SETUP_GUIDE.md) for additional context
5. Open an issue on [GitHub](https://github.com/ehsaniara/joblet-admin/issues) with your configuration (redact sensitive data)

## Related Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Complete installation and setup
- [Quick Start](./QUICK_START.md) - Get running in 5 minutes
- [Joblet Server Docs](https://github.com/ehsaniara/joblet) - Server configuration
