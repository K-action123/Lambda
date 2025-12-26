provider "aws" {
  region  = var.aws_region
  profile = "fintech"
}

variable "aws_region" {
  default = "us-east-1"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# DynamoDB Table for Time-Series Data
resource "aws_dynamodb_table" "price_history" {
  name         = "FintechPriceHistory"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Symbol"
  range_key    = "Timestamp"

  attribute {
    name = "Symbol"
    type = "S"
  }

  attribute {
    name = "Timestamp"
    type = "N"
  }
  # --- TTL ADDED HERE ---
  # This tells DynamoDB to look for a field named 'ExpiresAt' 
  # and delete the row when that timestamp is reached.
  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  tags = {
    Environment = "Dev"
    Project     = "FintechMonitor"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_exec_role" {
  name = "fintech_lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

# IAM Policy for DynamoDB and SNS access
resource "aws_iam_role_policy" "lambda_policy" {
  name = "fintech_lambda_policy"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.price_history.arn
      },
      {
        Action = [
          "sns:Publish"
        ]
        Effect   = "Allow"
        Resource = "*" # Restrict this to specific SNS ARN later
      },
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Robust way: Install dependencies locally into a build folder before zipping
resource "null_resource" "prepare_lambda_package" {
  provisioner "local-exec" {
    command = <<EOT
      mkdir -p ${path.module}/../backend/build
      cp ${path.module}/../backend/lambda_function.py ${path.module}/../backend/build/
      pip install -r ${path.module}/../backend/requirements.txt -t ${path.module}/../backend/build/ --upgrade
    EOT
  }

  triggers = {
    dependencies_hash = filesha256("${path.module}/../backend/requirements.txt")
    source_hash       = filesha256("${path.module}/../backend/lambda_function.py")
  }
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/build"
  output_path = "${path.module}/lambda_function_payload.zip"

  depends_on = [null_resource.prepare_lambda_package]
}

# S3 Bucket for Lambda Code (Robust way)
resource "aws_s3_bucket" "lambda_code" {
  bucket = "fintech-lambda-code-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_ownership_controls" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.lambda_code.id
  key    = "v${data.archive_file.lambda_zip.output_md5}/lambda_function_payload.zip"
  source = data.archive_file.lambda_zip.output_path
  etag   = data.archive_file.lambda_zip.output_md5
}

# Lambda Function
resource "aws_lambda_function" "price_monitor" {
  s3_bucket        = aws_s3_bucket.lambda_code.id
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "FintechPriceMonitor"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.price_history.name
      SNS_TOPIC_ARN  = aws_sns_topic.rsi_alerts.arn
    }
  }
}

# SNS Topic for RSI Alerts
resource "aws_sns_topic" "rsi_alerts" {
  name = "FintechRSIAlerts"
}

# EventBridge Trigger every 5 minutes
resource "aws_cloudwatch_event_rule" "every_five_minutes" {
  name                = "every-five-minutes"
  description         = "Trigger Lambda every 5 minutes"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.every_five_minutes.name
  target_id = "price_monitor_lambda"
  arn       = aws_lambda_function.price_monitor.arn
}

# API Gateway (v2 HTTP API)
resource "aws_apigatewayv2_api" "fintech_api" {
  name          = "FintechAnalyticsAPI"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"] # In production, restrict this to your frontend domain
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token"]
  }
}

resource "aws_apigatewayv2_stage" "api_stage" {
  api_id      = aws_apigatewayv2_api.fintech_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.fintech_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.price_monitor.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_stats" {
  api_id    = aws_apigatewayv2_api.fintech_api.id
  route_key = "GET /stats"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.price_monitor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.fintech_api.execution_arn}/*/*"
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.fintech_api.api_endpoint
}
