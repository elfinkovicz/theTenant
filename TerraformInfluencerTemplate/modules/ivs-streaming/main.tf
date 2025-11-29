# IVS Channel (Stream Key wird automatisch erstellt)
resource "aws_ivs_channel" "main" {
  name         = "${var.project_name}-${var.channel_name}"
  latency_mode = "LOW"
  type         = var.channel_type
  authorized   = false

  tags = {
    Name = "${var.project_name}-${var.channel_name}"
  }
}

# IVS Recording Configuration (optional)
resource "aws_s3_bucket" "recordings" {
  bucket = "${var.project_name}-ivs-recordings-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "delete-old-recordings"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
  }
}

resource "aws_ivs_recording_configuration" "main" {
  name = "${var.project_name}-recording"

  destination_configuration {
    s3 {
      bucket_name = aws_s3_bucket.recordings.id
    }
  }

  thumbnail_configuration {
    recording_mode          = "INTERVAL"
    target_interval_seconds = 60
  }
}

data "aws_caller_identity" "current" {}
