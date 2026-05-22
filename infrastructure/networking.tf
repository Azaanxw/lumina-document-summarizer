resource "aws_vpc" "lumina" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "lumina-vpc" }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.lumina.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "eu-west-2a"
  map_public_ip_on_launch = true
  tags = { Name = "lumina-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.lumina.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "eu-west-2b"
  map_public_ip_on_launch = true
  tags = { Name = "lumina-public-b" }
}

resource "aws_internet_gateway" "lumina" {
  vpc_id = aws_vpc.lumina.id
  tags   = { Name = "lumina-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.lumina.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.lumina.id
  }
  tags = { Name = "lumina-public-rt" }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "lumina-alb-sg"
  description = "Allow HTTP and HTTPS from internet"
  vpc_id      = aws_vpc.lumina.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "lumina-alb-sg" }
}

resource "aws_security_group" "ecs" {
  name        = "lumina-ecs-sg"
  description = "Allow inbound from ALB only"
  vpc_id      = aws_vpc.lumina.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "lumina-ecs-sg" }
}
