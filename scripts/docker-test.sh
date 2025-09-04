#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="shaman"
TAG="latest"
CONTAINER_NAME="shaman-test"
NETWORK_NAME="shaman-test-network"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--tag TAG] [--name IMAGE_NAME]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}Testing Docker image: ${IMAGE_NAME}:${TAG}${NC}"

# Cleanup function
cleanup() {
  echo -e "${YELLOW}Cleaning up...${NC}"
  docker stop ${CONTAINER_NAME} 2>/dev/null || true
  docker rm ${CONTAINER_NAME} 2>/dev/null || true
  docker network rm ${NETWORK_NAME} 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Create test network
echo "Creating test network..."
docker network create ${NETWORK_NAME} 2>/dev/null || true

# Start PostgreSQL container for testing
echo "Starting PostgreSQL for testing..."
docker run -d \
  --name ${CONTAINER_NAME}-postgres \
  --network ${NETWORK_NAME} \
  -e POSTGRES_USER=shaman \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=shaman_test \
  postgres:15-alpine

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Run the Shaman container
echo "Starting Shaman container..."
docker run -d \
  --name ${CONTAINER_NAME} \
  --network ${NETWORK_NAME} \
  -p 5002:5002 \
  -p 8080:8080 \
  -p 50051:50051 \
  -e NODE_ENV=development \
  -e SHAMAN_DB_HOST=${CONTAINER_NAME}-postgres \
  -e SHAMAN_DB_PORT=5432 \
  -e SHAMAN_DB_NAME=shaman_test \
  -e SHAMAN_DB_USER=shaman \
  -e SHAMAN_DB_PASSWORD=testpass \
  -e SHAMAN_AUTO_MIGRATE=true \
  -e PORT=5002 \
  ${IMAGE_NAME}:${TAG}

# Wait for container to start
echo "Waiting for container to start..."
sleep 10

# Check if container is running
if docker ps | grep -q ${CONTAINER_NAME}; then
  echo -e "${GREEN}Container is running${NC}"
else
  echo -e "${RED}Container failed to start${NC}"
  docker logs ${CONTAINER_NAME}
  exit 1
fi

# Check health endpoint
echo "Checking health endpoint..."
if curl -f http://localhost:5002/health 2>/dev/null; then
  echo -e "${GREEN}Health check passed${NC}"
else
  echo -e "${RED}Health check failed${NC}"
  docker logs ${CONTAINER_NAME}
  exit 1
fi

# Show logs
echo -e "${GREEN}Container logs:${NC}"
docker logs ${CONTAINER_NAME} --tail 20

echo -e "${GREEN}Docker test completed successfully!${NC}"

# Cleanup PostgreSQL container
docker stop ${CONTAINER_NAME}-postgres 2>/dev/null || true
docker rm ${CONTAINER_NAME}-postgres 2>/dev/null || true