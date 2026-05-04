data "cloudflare_zones" "web" {
  filter {
    name   = var.domain
    status = "active"
  }
}

locals {
  cloudflare_zone_id = lookup(data.cloudflare_zones.web.zones[0], "id")
}

resource "cloudflare_record" "landing_page" {
  count           = var.manage_cloudflare_dns ? 1 : 0
  zone_id         = local.cloudflare_zone_id
  name            = local.landing_page_cloudflare_record_name
  content         = var.landing_page_dns_record_content
  type            = var.landing_page_dns_record_type
  proxied         = false
  ttl             = 1
  allow_overwrite = true
}

resource "cloudflare_record" "docs" {
  count           = var.manage_cloudflare_dns ? 1 : 0
  zone_id         = local.cloudflare_zone_id
  name            = local.docs_cloudflare_record_name
  content         = var.docs_dns_record_content
  type            = var.docs_dns_record_type
  proxied         = false
  ttl             = 1
  allow_overwrite = true
}
