.PHONY: help install dev build test clean all proto

# Default target
help:
	@echo "Joblet Admin - Available Commands"
	@echo ""
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development server"
	@echo "  make build      - Build for production"
	@echo "  make test       - Run test suite"
	@echo "  make proto      - Download/update proto files"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make all        - Clean, install, test, and build"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	npm install

# Download/update proto files
proto:
	@echo "📋 Downloading proto files..."
	npm run ensure-proto

# Start development server
dev:
	@echo "🚀 Starting development server..."
	npm run dev

# Build for production
build:
	@echo "🔨 Building for production..."
	npm run build

# Run tests
test:
	@echo "🧪 Running tests..."
	npm test -- --run

# Run tests in watch mode
test-watch:
	@echo "🔍 Running tests in watch mode..."
	npm test

# Run tests with coverage
test-coverage:
	@echo "📊 Running tests with coverage..."
	npm test -- --coverage

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist
	rm -rf node_modules/.vite

# Full clean (including node_modules)
clean-all:
	@echo "🗑️  Removing all build artifacts and dependencies..."
	rm -rf dist
	rm -rf node_modules

# Full build cycle
all: clean install proto test build
	@echo "✅ Build complete!"

# Start production server
start:
	@echo "▶️  Starting production server..."
	npm start

# Type checking
type-check:
	@echo "🔍 Running TypeScript type check..."
	npm run type-check

# Linting
lint:
	@echo "🔍 Running ESLint..."
	npm run lint

# Fix linting issues
lint-fix:
	@echo "🔧 Fixing linting issues..."
	npm run lint:fix

# Format code
format:
	@echo "✨ Formatting code..."
	npm run format

# Check code formatting
format-check:
	@echo "🔍 Checking code formatting..."
	npm run format:check
