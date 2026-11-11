#!/bin/bash
# SHARED-004:  Deployment Script (No AI Mode) - Bash Version
# 
# Deploys all apps with AI features disabled.
# Usage:  ./deploy-no-ai.sh --environment dev|staging|prod --apps all|app1,app2

set -e

# ============================================================================
# Configuration
# ============================================================================

ALL_APPS=(
    "trend-brief-ai"
    "smartbuy-ai"
    "fin-tax-ai"
    "doctorcar-ai"
    "caremate-ai"
)

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Default values
ENVIRONMENT=""
APPS="all"
SKIP_BUILD=false
SKIP_TESTS=false
DRY_RUN=false

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo "============================================================"
    echo -e "\033[36m$1\033[0m"
    echo "============================================================"
}

print_step() {
    echo -e "\033[33m[STEP] $1\033[0m"
}

print_success() {
    echo -e "\033[32m[OK] $1\033[0m"
}

print_error() {
    echo -e "\033[31m[ERROR] $1\033[0m"
}

print_info() {
    echo -e "\033[90m[INFO] $1\033[0m"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --environment, -e   Environment (dev|staging|prod) [required]
    --apps, -a          Apps to deploy (all|app1,app2) [default: all]
    --skip-build        Skip build step
    --skip-tests        Skip test step
    --dry-run           Show what would be done without executing
    --help, -h          Show this help message

Examples:
    $0 --environment dev --apps all
    $0 -e staging -a trend-brief-ai,smartbuy-ai --skip-tests
    $0 -e prod --dry-run
EOF
    exit 1
}

# ============================================================================
# Parse Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -a|--apps)
            APPS="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    print_error "Environment is required"
    usage
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    usage
fi

# ============================================================================
# Get Apps List
# ============================================================================

get_apps_to_deploy() {
    if [[ "$APPS" == "all" ]]; then
        echo "${ALL_APPS[@]}"
    else
        echo "$APPS" | tr ',' ' '
    fi
}

# ============================================================================
# Build Functions
# ============================================================================

build_app() {
    local app_name=$1
    local app_path="$WORKSPACE_ROOT/$app_name"
    
    print_step "Building $app_name..."
    
    local service_name="${app_name//-ai/ai}-service"
    local ui_name="${app_name//-ai/ai}-ui"
    local service_path="$app_path/$service_name"
    local ui_path="$app_path/$ui_name"
    
    # Build service
    if [[ -d "$service_path" ]]; then
        print_info "Building service..."
        pushd "$service_path" > /dev/null
        
        if [[ -f "package.json" ]]; then
            npm ci --silent
            npm run build --silent
        elif [[ -f "requirements.txt" ]]; then
            pip install -r requirements.txt -q
        fi
        
        popd > /dev/null
        print_success "Service built"
    fi
    
    # Build UI
    if [[ -d "$ui_path" ]]; then
        print_info "Building UI..."
        pushd "$ui_path" > /dev/null
        
        npm ci --silent
        npm run build -- --configuration=production 2>&1 > /dev/null
        
        popd > /dev/null
        print_success "UI built"
    fi
}

run_tests() {
    local app_name=$1
    local app_path="$WORKSPACE_ROOT/$app_name"
    
    print_step "Running tests for $app_name..."
    
    local service_name="${app_name//-ai/ai}-service"
    local service_path="$app_path/$service_name"
    
    if [[ -d "$service_path" && -f "$service_path/package.json" ]]; then
        pushd "$service_path" > /dev/null
        npm test --silent
        popd > /dev/null
        print_success "Tests passed"
    fi
}

# ============================================================================
# Docker Functions
# ============================================================================

deploy_with_docker() {
    local app_name=$1
    local app_path="$WORKSPACE_ROOT/$app_name"
    local compose_file="$app_path/docker-compose.no-ai.yml"
    
    print_step "Deploying $app_name with Docker..."
    
    if [[ ! -f "$compose_file" ]]; then
        print_error "docker-compose.no-ai.yml not found for $app_name"
        return 1
    fi
    
    pushd "$app_path" > /dev/null
    
    # Build images
    print_info "Building Docker images..."
    local build_cmd="docker-compose -f docker-compose.no-ai.yml build"
    
    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would run:  $build_cmd"
    else
        eval "$build_cmd"
    fi
    
    # Deploy
    print_info "Starting containers..."
    local up_cmd="docker-compose -f docker-compose.no-ai.yml up -d"
    
    local env_file="$app_path/.env.$ENVIRONMENT.no-ai"
    if [[ -f "$env_file" ]]; then
        up_cmd="docker-compose -f docker-compose.no-ai.yml --env-file $env_file up -d"
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would run:  $up_cmd"
    else
        eval "$up_cmd"
    fi
    
    popd > /dev/null
    print_success "$app_name deployed"
    return 0
}

get_container_health() {
    local app_name=$1
    docker ps --filter "name=$app_name" --format "{{.Names}}:{{.Status}}"
}

# ============================================================================
# Main Deployment Flow
# ============================================================================

main() {
    print_header "No-AI Deployment Script"
    print_info "Environment:  $ENVIRONMENT"
    print_info "Apps:  $APPS"
    print_info "Skip Build:  $SKIP_BUILD"
    print_info "Skip Tests:  $SKIP_TESTS"
    print_info "Dry Run:  $DRY_RUN"
    echo ""
    
    local apps_to_deploy
    read -r -a apps_to_deploy <<< "$(get_apps_to_deploy)"
    
    local success_count=0
    local fail_count=0
    
    for app in "${apps_to_deploy[@]}"; do
        print_header "Deploying $app"
        
        local app_path="$WORKSPACE_ROOT/$app"
        
        if [[ ! -d "$app_path" ]]; then
            print_error "App path not found:  $app_path"
            ((fail_count++))
            continue
        fi
        
        # Check for docker-compose file
        if [[ ! -f "$app_path/docker-compose.no-ai.yml" ]]; then
            print_error "No docker-compose.no-ai.yml found for $app"
            ((fail_count++))
            continue
        fi
        
        # Build
        if [[ "$SKIP_BUILD" != true ]]; then
            if ! build_app "$app"; then
                print_error "Build failed"
                ((fail_count++))
                continue
            fi
        fi
        
        # Tests
        if [[ "$SKIP_TESTS" != true ]]; then
            if ! run_tests "$app"; then
                print_error "Tests failed"
                ((fail_count++))
                continue
            fi
        fi
        
        # Deploy
        if deploy_with_docker "$app"; then
            ((success_count++))
        else
            ((fail_count++))
        fi
    done
    
    # Summary
    print_header "Deployment Summary"
    print_info "Total Apps:  ${#apps_to_deploy[@]}"
    print_success "Successful:  $success_count"
    if [[ $fail_count -gt 0 ]]; then
        print_error "Failed:  $fail_count"
    fi
    
    # Health check
    if [[ "$DRY_RUN" != true && $success_count -gt 0 ]]; then
        print_header "Container Health"
        for app in "${apps_to_deploy[@]}"; do
            local health
            health=$(get_container_health "$app")
            if [[ -n "$health" ]]; then
                print_info "$app:"
                echo "$health" | while read -r line; do
                    print_info "  $line"
                done
            fi
        done
    fi
    
    if [[ $fail_count -gt 0 ]]; then
        exit 1
    fi
}

# Run main
main
