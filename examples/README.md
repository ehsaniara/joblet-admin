# Joblet Workflow Examples

This directory contains example workflows to help you get started with Joblet Admin. These examples demonstrate various workflow patterns, features, and use cases.

## Directory Structure

```
examples/
├── workflows/              # Workflow examples organized by use case
│   ├── basic-usage/       # Simple workflows for getting started
│   ├── data-pipeline/     # Data processing pipeline examples
│   ├── etl-processing/    # ETL workflow examples
│   ├── ml-pipeline/       # Machine learning workflow examples
│   ├── parallel-jobs/     # Parallel processing examples
│   └── ...
```

## Quick Start Examples

### 1. Simple Commands (01-simple-commands.yaml)
The simplest workflow with independent jobs running basic shell commands.

**Use case**: Quick health checks, system information gathering

```bash
# Execute via Joblet Admin UI:
# 1. Go to http://localhost:3000/workflows
# 2. Click "New Workflow"
# 3. Browse to examples/workflows/01-simple-commands.yaml
# 4. Click "Execute Workflow"
```

### 2. Sequential Pipeline (02-sequential-pipeline.yaml)
Jobs that depend on each other, forming a sequential processing pipeline.

**Use case**: ETL processes, data validation pipelines

**Key features**:
- Job dependencies using `requires`
- Sequential execution flow

### 3. Parallel Processing (03-parallel-processing.yaml)
Multiple jobs running in parallel, then converging to a final aggregation job.

**Use case**: Multi-region data processing, parallel computations

**Key features**:
- Fan-out/fan-in pattern
- Parallel execution for performance
- Multiple job dependencies

### 4. With Volumes (04-with-volumes.yaml)
Demonstrates persistent volume usage for sharing data between jobs.

**Use case**: Data sharing, intermediate results storage

**Key features**:
- Volume mounting
- Data persistence across jobs
- Shared storage patterns

**Prerequisites**: Create the `data-pipeline` volume first:
```bash
# Via Joblet Admin UI:
# 1. Go to Resources page
# 2. Click "Create Volume"
# 3. Name: data-pipeline, Size: 100MB
```

## Featured Workflow Examples

### ML Pipeline (`ml-pipeline/`)
Complete machine learning workflow with Python scripts.

**Includes**:
- Data validation and preparation
- Feature engineering
- Model training
- Model evaluation
- Deployment testing

**Requirements**:
- Runtime: `python-3.11-ml`
- Volume: `ml-pipeline`
- Python scripts provided in directory

### Data Pipeline (`data-pipeline/`)
Real-world data processing pipeline example.

**Includes**:
- Data ingestion
- Validation
- Transformation
- Loading

### Java Microservices (`java-microservices/`)
Demonstrates Java-based workflow execution.

**Requirements**:
- Runtime: `openjdk-21` or `graalvmjdk-21`

### Parallel Jobs (`parallel-jobs/`)
Advanced parallel processing patterns.

**Includes**:
- Matrix-style parallel execution
- Dynamic fan-out patterns
- Resource-intensive parallel tasks

## Workflow File Structure

All workflows follow the Joblet YAML format:

```yaml
version: "3.0"

jobs:
  job-name:
    command: "command-to-execute"
    args: ["arg1", "arg2"]
    runtime: "python-3.11-ml"      # Optional: specific runtime
    volumes: ["volume-name:/path"]  # Optional: volume mounts
    uploads:                        # Optional: file uploads
      files: ["script.py"]
    requires:                       # Optional: dependencies
      - previous-job: "COMPLETED"
    env:                            # Optional: environment variables
      VAR_NAME: "value"
    resources:                      # Optional: resource limits
      max_cpu: 80
      max_memory: 512
```

## Common Workflow Patterns

### 1. Sequential Processing
```yaml
job-b:
  requires:
    - job-a: "COMPLETED"
```

### 2. Parallel with Convergence
```yaml
final-job:
  requires:
    - parallel-job-1: "COMPLETED"
    - parallel-job-2: "COMPLETED"
    - parallel-job-3: "COMPLETED"
```

### 3. Conditional Execution
```yaml
cleanup-job:
  requires:
    - main-job: "FAILED"  # Run only if main job fails
```

### 4. File Upload with Execution
```yaml
python-job:
  command: "python3"
  args: ["script.py"]
  runtime: "python-3.11-ml"
  uploads:
    files: ["script.py", "config.json"]
```

## Testing Workflows

### Via Joblet Admin UI
1. Navigate to http://localhost:3000/workflows
2. Click "New Workflow"
3. Browse to the example workflow file
4. Review validation results
5. Click "Execute Workflow" (or "Create Volumes & Execute" if needed)
6. Monitor progress in real-time

### Via Joblet CLI
```bash
# Execute a workflow
joblet workflow run -f examples/workflows/basic-usage/hello-world.yaml

# Check workflow status
joblet workflow status <workflow-id>

# View workflow jobs
joblet workflow jobs <workflow-id>
```

## Creating Your Own Workflows

### Best Practices

1. **Start Simple**: Begin with basic commands before adding complexity
2. **Use Descriptive Names**: Job names should clearly indicate their purpose
3. **Test Incrementally**: Add one job at a time and test
4. **Volume Management**: Create volumes before referencing them
5. **File Organization**: Keep related files (scripts, configs) in the same directory as the workflow YAML
6. **Error Handling**: Design workflows to handle failures gracefully
7. **Resource Limits**: Set appropriate CPU and memory limits to prevent resource exhaustion

### Workflow Development Checklist

- [ ] All required volumes exist or are created automatically
- [ ] All required runtimes are installed on your nodes
- [ ] Referenced files (uploads) exist in the workflow directory
- [ ] Job dependencies form a valid directed acyclic graph (no cycles)
- [ ] Resource requirements are specified where needed
- [ ] Environment variables are properly set
- [ ] Test with simple examples first

## Troubleshooting

### Common Issues

**Workflow gets CANCELED immediately**:
- Check if referenced files exist (e.g., Python scripts in `uploads.files`)
- Verify volume names match existing volumes
- Ensure runtime is available on the target node

**Jobs fail with "file not found"**:
- Verify files are listed in `uploads.files`
- Check file paths are relative to the workflow YAML location
- Ensure file permissions are correct

**Volume mounting errors**:
- Create the volume first via Resources page
- Check volume name spelling
- Verify volume mount path syntax: `volume-name:/mount/path`

**Runtime not found**:
- List available runtimes in Monitoring > Runtimes
- Install missing runtime or use an available one
- Check runtime name spelling (case-sensitive)

## Additional Resources

- [Joblet Documentation](https://github.com/ehsaniara/joblet)
- [Workflow YAML Specification](https://github.com/ehsaniara/joblet/blob/main/docs/workflow-spec.md)
- [Admin UI Guide](../README.md)

## Contributing Examples

We welcome contributions of additional workflow examples! Please:

1. Place examples in appropriate subdirectories
2. Include a README.md in the subdirectory explaining the workflow
3. Ensure all required files are included
4. Test the workflow before submitting
5. Document any prerequisites (volumes, runtimes, etc.)
