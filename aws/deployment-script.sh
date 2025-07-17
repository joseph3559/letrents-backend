#!/bin/bash

# AWS ECS Deployment Script for LetRents Backend
set -e

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
CLUSTER_NAME=${CLUSTER_NAME:-"letrents-production"}
SERVICE_NAME=${SERVICE_NAME:-"backend"}
ECR_REGISTRY=${ECR_REGISTRY}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check required environment variables
check_env_vars() {
    log "Checking required environment variables..."
    
    if [ -z "$ECR_REGISTRY" ]; then
        error "ECR_REGISTRY environment variable is not set"
    fi
    
    if [ -z "$AWS_ACCESS_KEY_ID" ]; then
        error "AWS_ACCESS_KEY_ID environment variable is not set"
    fi
    
    if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        error "AWS_SECRET_ACCESS_KEY environment variable is not set"
    fi
}

# Update ECS service
update_service() {
    log "Updating ECS service: $SERVICE_NAME in cluster: $CLUSTER_NAME"
    
    # Create new task definition revision
    TASK_DEFINITION=$(aws ecs describe-task-definition \
        --task-definition letrents-backend \
        --query 'taskDefinition' \
        --region $AWS_REGION)
    
    # Update the image in task definition
    NEW_TASK_DEFINITION=$(echo $TASK_DEFINITION | jq --arg IMAGE "$ECR_REGISTRY/letrents-backend:$IMAGE_TAG" \
        '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.placementConstraints) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)')
    
    # Register new task definition
    NEW_TASK_DEFINITION_ARN=$(echo $NEW_TASK_DEFINITION | aws ecs register-task-definition \
        --region $AWS_REGION \
        --cli-input-json file:///dev/stdin \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    log "Created new task definition: $NEW_TASK_DEFINITION_ARN"
    
    # Update service
    aws ecs update-service \
        --region $AWS_REGION \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $NEW_TASK_DEFINITION_ARN \
        --force-new-deployment
    
    log "Service update initiated"
}

# Wait for deployment to complete
wait_for_deployment() {
    log "Waiting for deployment to complete..."
    
    aws ecs wait services-stable \
        --region $AWS_REGION \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME
    
    log "Deployment completed successfully!"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Get service endpoint (this would need to be customized based on your load balancer setup)
    SERVICE_URL=${SERVICE_URL:-"http://your-load-balancer-url"}
    
    if curl -f "$SERVICE_URL/health" >/dev/null 2>&1; then
        log "Health check passed!"
    else
        warn "Health check failed, but deployment may still be in progress"
    fi
}

# Main deployment function
main() {
    log "Starting LetRents Backend deployment..."
    
    check_env_vars
    update_service
    wait_for_deployment
    health_check
    
    log "Deployment completed successfully!"
}

# Run main function
main "$@" 